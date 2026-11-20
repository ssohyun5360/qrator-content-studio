import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from '../lib/core.mjs';
import {S3Client} from '@aws-sdk/client-s3';
import seed from '../lib/ai/rules/v1/tags.json' with {type:'json'};
import {norm,classify,computeTags,resolveUnknown,topicLabels,tagGroups} from '../lib/tags.mjs';

const TOKEN='t'.repeat(40);
const env={STUDIO_PASSWORD:'test-password-123456789',SESSION_SECRET:'x'.repeat(40),AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket',APP_ORIGIN:'https://studio.example',CONTENT_UPLOAD_TOKEN:TOKEN};
Object.assign(process.env,env);
const store=new Map();let counter=0;
S3Client.prototype.send=async function(command){
 const p=command.input;
 switch(command.constructor.name){
  case 'GetObjectCommand':{const r=store.get(p.Key);if(!r)throw Object.assign(new Error(),{name:'NoSuchKey'});return {ETag:r.etag,Body:{transformToString:async()=>r.body}};}
  case 'PutObjectCommand':{const old=store.get(p.Key);if((p.IfNoneMatch&&old)||(p.IfMatch&&old?.etag!==p.IfMatch))throw {$metadata:{httpStatusCode:412}};store.set(p.Key,{etag:String(++counter),body:p.Body});return {};}
  case 'ListObjectsV2Command':return {Contents:[...store.keys()].filter(k=>k.startsWith(p.Prefix)).map(Key=>({Key}))};
  default:throw new Error(command.constructor.name);
 }
};
const {default:upload}=await import('../api/content-upload.js');
const {default:studio}=await import('../api/studio.js');
const cookie='studio_session='+session(env);
const stored=slug=>JSON.parse(store.get('studio/records/'+slug+'.json').body);
const dictStored=()=>JSON.parse(store.get('studio/settings/tag-dictionary.json').body);
async function callUpload(body){const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};await upload({method:'POST',headers:{authorization:'Bearer '+TOKEN},body},r);return r;}
async function callStudio(op,body,method='POST'){const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};await studio({method,query:{op},body,headers:{cookie,origin:env.APP_ORIGIN}},r);return r;}
const rec=(slug,extra={})=>({slug,title:'제목 '+slug,category:'상호 변경',summary:'요약',html:'<p>본문</p>',entryPath:'index.html',assets:[],tags:[],sourceUrls:[],...extra});
const dict=()=>structuredClone({...seed});

test('시작 사전: 용어(라벨·동의어)가 서로 겹치지 않고, 태그는 개념 하나에 하나다',()=>{
 const seen=new Map();
 for(const t of seed.tags)for(const term of [t.label,...t.aliases]){const k=norm(term);assert.ok(!seen.has(k)||seen.get(k)===t.id,`충돌 ${term}: ${seen.get(k)}/${t.id}`);seen.set(k,t.id);}
 const labels=seed.tags.map(t=>t.label);
 assert.equal(new Set(labels).size,labels.length);
 for(const t of seed.tags)assert.ok(seed.groups.includes(t.group),t.id);
 assert.ok(!labels.some(l=>/정관 |정관변경|4대보험 변경/.test(l)),'정관·4대보험은 변형마다 태그를 만들지 않는다');
 assert.equal(seed.tags.find(t=>t.label==='정관').aliases.includes('정관변경효력'),true);
 assert.ok(!seed.tags.some(t=>[t.label,...t.aliases].some(x=>/^2주( 내)?$/.test(x))),'"2주"는 태그·동의어에 두지 않는다');
});

test('분류: 정관변경·정관 변경·정관변경효력은 모두 "정관" 하나로 모인다',()=>{
 const r=classify(['정관변경','정관 변경','정관변경효력','4대보험변경','4대보험'],dict(),{category:'상호 변경'});
 assert.deepEqual(r.topic.map(t=>t.label),['정관','4대보험']);
});

test('공통 키워드와 분류와 같은 뜻의 태그는 주제 태그에서 빠지고 검색 키워드로만 남는다',()=>{
 const r=computeTags({inputs:['법인등기','변경등기','셀프등기','큐레이터','등기가이드','상호변경','상호변경등기','영문상호','정관변경'],dict:dict(),category:'상호 변경'});
 assert.deepEqual(r.tags,['영문 상호','정관']);
 assert.ok(r.keywords.includes('법인등기')&&r.keywords.includes('상호변경'));
});

test('글당 주제 태그는 최대 4개이고, 넘친 것은 overflow 로 남는다',()=>{
 const r=computeTags({inputs:['등기기한','과태료','정관변경','주주총회','사업자등록정정','4대보험'],dict:dict(),category:'상호 변경'});
 assert.equal(r.tags.length,4);assert.equal(r.overflow.length,2);
});

test('분류 범위: 임원 전용 태그는 상호 변경 글에서 고르지 않는다',()=>{
 const r=classify(['이사 사임','영문상호'],dict(),{category:'상호 변경'});
 assert.deepEqual(r.topic.map(t=>t.label),['영문 상호']);
});

test('사전에 없는 주제는 승인 없이 새 태그로 추가되고, 비슷한 말은 기존 태그의 동의어로 합쳐진다',()=>{
 const r=resolveUnknown(['해외법인 등기','정관 변경안'],dict(),{category:'상호 변경'});
 assert.deepEqual(r.added.map(t=>t.label),['해외법인 등기']);
 assert.equal(r.merged.length,1);assert.equal(r.merged[0].into,'정관');
 assert.ok(r.dict.tags.find(t=>t.label==='정관').aliases.includes('정관 변경안'));
 assert.equal(r.dict.tags.find(t=>t.label==='해외법인 등기').group,'기타');
});

test('새 태그 제한: 글당 2개까지, 이름 길이·숫자·특수문자는 거부된다',()=>{
 const r=resolveUnknown(['가나다라 업무','마바사아 절차서','자차카타 용어','1234','<b>태그</b>','가'],dict(),{maxNew:2});
 assert.equal(r.added.length,2);
 const reasons=r.skipped.map(s=>s.reason).join('|');
 assert.match(reasons,/글당 2개/);assert.match(reasons,/숫자만/);assert.match(reasons,/쓸 수 없는 문자/);assert.match(reasons,/2~14자/);
});

test('주제 태그가 2개 미만이면 입력의 사전에 없는 말을 새 태그로 채운다',()=>{
 const r=computeTags({inputs:['영문상호','해외지사 서류'],dict:dict(),category:'상호 변경'});
 assert.equal(r.tags.length,2);assert.ok(r.tags.includes('영문 상호'));assert.ok(r.changed);
});

test('기존 글(긴 태그 목록)도 목록 필터에서는 동의어로 맞춰진다',()=>{
 const old={category:'본점 이전',tags:['본점이전','본점이전등기','사업자등록정정','4대보험변경','법인세납세지','사무실이전','법인등기','큐레이터'],keywords:[]};
 assert.deepEqual(topicLabels(old,dict()),['사업자등록','4대보험','법인세·세무','임대차계약']);
 const groups=tagGroups([{topicTags:['정관','영문 상호']},{topicTags:['정관']}],dict());
 assert.deepEqual(groups.map(g=>[g.group,g.tags.map(t=>`${t.label}:${t.count}`)]),[['의사결정·정관',['정관:2']],['상호',['영문 상호:1']]]);
});

test('자동 등록: 해시태그는 주제 태그 2~4개 + 검색 키워드로 나뉘어 저장된다',async()=>{
 store.clear();
 const tags=['상호변경','상호변경등기','영문상호','법인영문명','상호표기','로마자병기','주식회사위치','정관변경','주주총회특별결의','법인상호','법인등기','변경등기','셀프등기','큐레이터','등기가이드'];
 assert.equal((await callUpload(rec('t-1',{tags}))).code,201);
 const s=stored('t-1');
 assert.deepEqual(s.tags,['영문 상호','정관','결의·의사록']);
 assert.equal(s.keywords.length,tags.length);assert.ok(s.keywords.includes('큐레이터'));
 assert.equal(store.has('studio/settings/tag-dictionary.json'),false,'새 태그가 없으면 사전을 저장하지 않는다');
});

test('자동 등록: 새 주제가 나오면 사전이 저장되고 다음 글에서 같은 태그로 쓰인다',async()=>{
 store.clear();
 await callUpload(rec('t-2',{tags:['영문상호','해외지사 서류']}));
 assert.ok(stored('t-2').tags.includes('해외지사 서류'));
 assert.ok(dictStored().tags.some(t=>t.label==='해외지사 서류'&&t.source==='auto'));
 await callUpload(rec('t-3',{tags:['영문상호','해외지사 서류']}));
 assert.deepEqual(stored('t-3').tags.sort(),stored('t-2').tags.sort());
 assert.equal(dictStored().tags.filter(t=>t.label==='해외지사 서류').length,1);
});

test('replace 로 다시 올려도 같은 내용이면 변경 없음으로 처리된다(태그 계산이 매번 같다)',async()=>{
 store.clear();
 const r=rec('t-4',{tags:['영문상호','정관변경','주주총회']});
 await callUpload(r);
 const again=await callUpload({...r,replace:true});
 assert.equal(again.code,200);assert.equal(again.data.unchanged,true);
});

test('목록: 주제 태그 필터용 topicTags 와 그룹별 개수를 돌려준다',async()=>{
 store.clear();
 await callUpload(rec('t-5',{tags:['영문상호','정관변경']}));
 await callUpload(rec('t-6',{tags:['정관','등기기한']}));
 const r=await callStudio('list',{},'GET');
 assert.equal(r.code,200);
 const by=Object.fromEntries(r.data.items.map(i=>[i.slug,i.topicTags]));
 assert.deepEqual(by['t-5'].sort(),['영문 상호','정관'].sort());
 const flat=r.data.tagGroups.flatMap(g=>g.tags.map(t=>`${t.label}:${t.count}`));
 assert.ok(flat.includes('정관:2'));
});

test('스튜디오에서 직접 저장: 태그를 바꾸면 사전 표기로 맞추고 넘친 것은 키워드로 보낸다',async()=>{
 store.clear();
 await callUpload(rec('t-7',{tags:['영문상호']}));
 const cur=stored('t-7');
 const save=await callStudio('save',{record:{...cur,tags:['정관변경','주주총회','과태료','등기기한','사업자등록정정'],keywords:['직접 쓴 키워드']},expectedRevision:cur.revision});
 assert.equal(save.code,200);
 const s=stored('t-7');
 assert.deepEqual(s.tags,['정관','결의·의사록','과태료','등기 기한']);
 assert.ok(s.keywords.includes('직접 쓴 키워드')&&s.keywords.includes('사업자등록정정'));
});

test('스튜디오에서 직접 저장: 태그를 건드리지 않으면 예전 글의 긴 태그를 그대로 둔다',async()=>{
 store.clear();
 const long=['본점이전','사업자등록정정','4대보험변경','법인세납세지','사무실이전','법인등기','변경등기'];
 await callStudio('save',{record:rec('t-8',{category:'본점 이전',tags:long,status:'draft'}),expectedRevision:null});
 store.set('studio/records/t-8.json',{etag:'9',body:JSON.stringify({...stored('t-8')})});
 const cur=stored('t-8');
 const save=await callStudio('save',{record:{...cur,title:'제목만 변경'},expectedRevision:cur.revision});
 assert.equal(save.code,200);
 assert.deepEqual(stored('t-8').tags,cur.tags);
});

test('일괄 정리: 미리보기는 저장하지 않고, 실행하면 긴 태그가 주제 태그 + 키워드로 정리된다(이력·검토 상태 유지)',async()=>{
 store.clear();
 const long=['본점이전','본점이전등기','사업자등록정정','4대보험변경','법인세납세지','사무실이전','법인등기','변경등기','셀프등기','큐레이터'];
 await callStudio('save',{record:rec('old-1',{category:'본점 이전',tags:long,status:'draft'}),expectedRevision:null});
 await callStudio('save',{record:rec('old-2',{category:'상호 변경',tags:['영문 상호','정관'],status:'draft'}),expectedRevision:null});
 store.set('studio/records/old-1.json',{etag:'50',body:JSON.stringify({...stored('old-1'),tags:long,keywords:[]})});
 const before=stored('old-1');
 const dry=await callStudio('retagAll',{dryRun:true});
 assert.equal(dry.code,200);assert.equal(dry.data.dryRun,true);
 assert.equal(dry.data.count,1,'이미 정리된 글(old-2)은 건드리지 않는다');
 assert.deepEqual(stored('old-1').tags,long,'미리보기는 저장하지 않는다');
 const run=await callStudio('retagAll',{dryRun:false});
 assert.equal(run.data.done,1);assert.deepEqual(run.data.failed,[]);
 const after=stored('old-1');
 assert.deepEqual(after.tags,['사업자등록','4대보험','법인세·세무','임대차계약']);
 assert.equal(after.keywords.length,long.length);assert.ok(after.keywords.includes('큐레이터'));
 assert.equal(after.revision,before.revision);assert.equal(after.reviewStatus,before.reviewStatus);assert.equal(after.updatedAt,before.updatedAt);
 assert.equal((await callStudio('retagAll',{dryRun:true})).data.count,0,'다시 실행해도 바뀌는 글이 없다');
});
