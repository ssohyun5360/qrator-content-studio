import test from 'node:test';
import assert from 'node:assert/strict';
import {S3Client} from '@aws-sdk/client-s3';

Object.assign(process.env,{AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket'});
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

const {advanceJob,STEP_NAMES}=await import('../lib/ai/pipeline.mjs');
const {newJob,createJob,loadJob}=await import('../lib/ai/jobs.mjs');
const {mockRunners,similarity}=await import('../lib/ai/runners.mjs');
const {RULE_VERSION}=await import('../lib/ai/checks.mjs');
const {validate}=await import('../lib/core.mjs');

const records=()=>[...store.keys()].filter(k=>k.startsWith('studio/records/')).map(k=>JSON.parse(store.get(k).body));
async function runAll(job,runners=mockRunners()){
 let latest=job;
 for(let i=0;i<STEP_NAMES.length+1&&latest.status!=='done'&&latest.status!=='failed';i++)latest=await advanceJob(job.id,{runners});
 return latest;
}
const make=async(meta={mock:true},input={mode:'auto',topic:''})=>createJob(newJob({stepNames:STEP_NAMES,input,meta}));

test('끝까지 실행: 주제 → 중복검사 → 원고 → 검사 → 템플릿 → 썸네일 → 저장',async()=>{
 store.clear();
 const done=await runAll(await make());
 assert.equal(done.status,'done',JSON.stringify(done.steps.filter(s=>s.status==='failed')));
 const [record]=records();assert.equal(records().length,1);
 assert.match(record.title,/^\[테스트\] /);
 assert.equal(record.status,'draft');assert.equal(record.reviewStatus,'pending');
 assert.equal(record.generatedBy,'ai');assert.equal(record.ruleVersion,RULE_VERSION);assert.equal(record.jobId,done.id);
 assert.equal(record.verification,'AI 생성 초안 · 관리자 검토 전');
 assert.ok(record.aiReview&&typeof record.aiReview==='object');
 assert.match(record.slug,/^mock-sample-/);
 assert.ok(record.tags.length>=2&&record.tags.length<=4,'주제 태그는 2~4개');
 assert.ok(record.keywords.length>=5,'해시태그는 검색 키워드로 남는다');
});

test('저장된 글은 썸네일 API 규칙과 같은 경로·형식의 16:9 SVG 를 가진다',async()=>{
 store.clear();await runAll(await make());
 const [record]=records();
 const thumb=record.assets.find(a=>a.path===`assets/thumbnails/${record.slug}.svg`);
 assert.ok(thumb,'썸네일 경로');assert.equal(thumb.mime,'image/svg+xml');
 const svg=Buffer.from(thumb.base64,'base64').toString('utf8');
 assert.match(svg,/^<svg[^>]*width="1280"[^>]*height="720"/);
 assert.ok(Buffer.byteLength(svg)<500_000);
 assert.ok(record.html.includes(`assets/thumbnails/${record.slug}.svg`),'본문 HTML 의 커버가 같은 파일을 가리킨다');
});

test('저장된 글은 상세용 16:9 와 별도로 목록용 1:1 SVG(-square)를 함께 가지고, 목록은 1:1 쪽을 고른다',async()=>{
 store.clear();await runAll(await make());
 const [record]=records();
 const square=record.assets.find(a=>a.path===`assets/thumbnails/${record.slug}-square.svg`);
 assert.ok(square,'목록용 1:1 썸네일');assert.equal(square.mime,'image/svg+xml');
 const svg=Buffer.from(square.base64,'base64').toString('utf8');
 assert.match(svg,/^<svg[^>]*width="720"[^>]*height="720"/);
 assert.ok(Buffer.byteLength(svg)<500_000);
 assert.ok(!record.html.includes('-square'),'본문(상세)에는 16:9 만 쓴다');
 const {summary}=await import('../lib/core.mjs');
 const row=summary(record);
 assert.equal(row.thumbnailPath,`assets/thumbnails/${record.slug}.svg`,'상세용은 16:9');
 assert.equal(row.thumbnailSquarePath,`assets/thumbnails/${record.slug}-square.svg`,'목록용은 1:1');
});

test('본문 HTML: 면책 작성일이 오늘이고, 확인 필요 항목이 검토 메모에 남는다',async()=>{
 store.clear();await runAll(await make());
 const [record]=records();
 const now=new Date(Date.now()+9*3600*1000);
 const today=`${now.getUTCFullYear()}. ${now.getUTCMonth()+1}. ${now.getUTCDate()}.`;
 assert.ok(record.html.includes('작성일 '+today),'작성일 '+today);
 assert.match(record.note,/사람 검토 필요/);
 assert.ok(!/<script/i.test(record.html));
});

test('저장 결과는 스튜디오 저장 규칙(validate)을 그대로 통과한다',async()=>{
 store.clear();await runAll(await make());
 assert.doesNotThrow(()=>validate(records()[0]));
});

test('중복 주제 검사: 비슷한 기존 글을 찾아 알려 준다',async()=>{
 store.clear();
 store.set('studio/records/existing.json',{etag:'1',body:JSON.stringify({slug:'existing',title:'법인 영문 상호 바꾸려면? 상호 변경 등기 전 표기 규칙',html:'',assets:[]})});
 const done=await runAll(await make({mock:true},{mode:'manual',topic:'법인 영문 상호 바꾸려면 상호 변경 등기 전 표기 규칙'}));
 assert.equal(done.status,'done');
 const out=(await loadJob(done.id)).value.outputs.dup_check;
 assert.equal(out.similar[0].slug,'existing');assert.ok(out.similar[0].score>=0.4);
 assert.ok(similarity('임원 변경 등기','본점 이전 등기')<0.4);
});

test('검사 뒤 다른 요청이 같은 상세 주소를 먼저 저장하면 저장 단계에서 멈추고 기존 글은 그대로다',async()=>{
 store.clear();
 const runners=mockRunners();
 const original=runners.template;
 runners.template=async(ctx)=>{
  const out=await original(ctx);
  store.set('studio/records/'+out.slug+'.json',{etag:'9',body:JSON.stringify({slug:out.slug,title:'먼저 저장된 글',html:'<p>기존</p>',assets:[]})});
  return out;
 };
 const result=await runAll(await make(),runners);
 assert.equal(result.status,'failed');
 const failed=result.steps.find(s=>s.status==='failed');
 assert.equal(failed.name,'save');assert.match(failed.error,/이미 있습니다/);
 assert.equal(records().length,1);assert.equal(records()[0].html,'<p>기존</p>');
});

test('검사 단계에서 상세 주소 후보가 모두 이미 쓰이고 있으면 저장 전에 멈춘다',async()=>{
 store.clear();
 const runners=mockRunners();
 const original=runners.assemble;
 runners.assemble=async()=>{const r=await original();r.article.slugCandidates=['taken-slug'];return r;};
 store.set('studio/records/taken-slug.json',{etag:'9',body:JSON.stringify({slug:'taken-slug',title:'기존 글',html:'<p>기존</p>',assets:[]})});
 const result=await runAll(await make(),runners);
 assert.equal(result.status,'failed');
 assert.equal(result.steps.find(s=>s.status==='failed').name,'check_fix');
 assert.equal(records().length,1);
});

test('법령 근거나 규칙 위반으로 검사가 실패하면 저장하지 않는다',async()=>{
 store.clear();
 const runners=mockRunners();
 const original=runners.assemble;
 runners.assemble=async()=>{const r=await original();r.article.title='법인설립 안내';r.article.sections=r.article.sections.slice(0,1);return r;};
 const result=await runAll(await make(),runners);
 assert.equal(result.status,'failed');
 assert.equal(result.steps.find(s=>s.status==='failed').name,'check_fix');
 assert.equal(records().length,0);
});

test('저장된 글: 본문이 가리키는 모든 상대 이미지 경로(커버·로고)가 첨부 파일에 있다',async()=>{
 store.clear();await runAll(await make());
 const [record]=records();
 const paths=new Set(record.assets.map(a=>a.path));
 const used=[...record.html.matchAll(/src="\.\/([^"]+)"/g)].map(m=>m[1]);
 assert.ok(used.includes('assets/qrator-logo.svg'),'서비스 소개 박스 로고를 쓴다');
 for(const p of used)assert.ok(paths.has(p),`첨부 파일 없음: ${p}`);
 assert.doesNotMatch(record.html,/(상법|상업등기규칙|대법원예규)\.[\d가-힣]/);
 assert.match(record.note,/법령 링크 확인 필요: 대법원 예규\(상호 로마자 병기 기준\)/);
});