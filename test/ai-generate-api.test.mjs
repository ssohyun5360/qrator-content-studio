import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from '../lib/core.mjs';
import {S3Client} from '@aws-sdk/client-s3';

const env={STUDIO_PASSWORD:'test-password-123456789',SESSION_SECRET:'x'.repeat(40),AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket',APP_ORIGIN:'https://studio.example',AI_GENERATION_ENABLED:'1',AI_MOCK:'1'};
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
const {default:ai}=await import('../api/ai-generate.js');
const cookie='studio_session='+session(env);
async function call(op,body,method='POST',query={}){const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};await ai({method,query:{op,...query},body,headers:{cookie,origin:env.APP_ORIGIN}},r);return r;}

test('화면 연결: 생성 요청(주제·카테고리) → 단계별 진행 → 작성 중·검토 전 글 저장',async()=>{
 store.clear();
 const st=await call('status',{},'GET');
 assert.equal(st.data.enabled,true);assert.equal(st.data.mock,true);
 const c=await call('create',{topic:'대표이사가 재선임됐을 때도 변경등기를 해야 하나요?',category:'임원 변경',brief:'[소재] 임기 만료 뒤 필요한 절차\nㄴ 실무 순서 중심',planning:{month:'11월',progress:'소재 제안',publishDate:'11-24',weekday:'화',series:'임원 변경',keywords:'임원·중임',references:'https://example.com/reference'}});
 assert.equal(c.code,201);assert.equal(c.data.job.input.category,'임원 변경');assert.equal(c.data.job.input.mode,'manual');
 assert.equal(c.data.job.input.brief,'[소재] 임기 만료 뒤 필요한 절차\nㄴ 실무 순서 중심');
 assert.equal(c.data.job.input.planning.publishDate,'11-24');assert.equal(c.data.job.input.planning.series,'임원 변경');
 let job=c.data.job,guard=0;
 while(job.status!=='done'&&guard++<30){const r=await call('advance',{id:job.id});assert.equal(r.code,200);job=r.data.job;assert.notEqual(job.status,'failed',JSON.stringify(job.steps.filter(s=>s.error)));}
 assert.equal(job.status,'done');assert.equal(job.steps.length,9);
 const got=await call('get',{},'GET',{id:job.id});
 const slug=got.data.outputs.save.slug;
 const rec=JSON.parse(store.get('studio/records/'+slug+'.json').body);
 assert.equal(rec.status,'draft');assert.equal(rec.reviewStatus,'pending');assert.equal(rec.generatedBy,'ai');
 assert.match(rec.title,/^\[테스트\]/);
 assert.ok(rec.tags.length>=2&&rec.tags.length<=4);
});

test('카테고리는 정해진 5개만 받고, 비워 두면 자동이다',async()=>{
 store.clear();
 assert.equal((await call('create',{topic:'',category:'없는 분류'})).code,400);
 const auto=await call('create',{topic:'',category:''});
 assert.equal(auto.code,201);assert.equal(auto.data.job.input.mode,'auto');
});

test('엑셀 기획 정보는 허용된 필드만 저장하고 길이를 검사한다',async()=>{
 store.clear();
 const made=await call('create',{topic:'본점 이전 일정',planning:{assignee:'담당자',unknown:'저장 금지'}});
 assert.equal(made.code,201);assert.equal(made.data.job.input.planning.assignee,'담당자');assert.equal(made.data.job.input.planning.unknown,undefined);
 const tooLong=await call('create',{topic:'본점 이전 일정',brief:'a'.repeat(8001)});
 assert.equal(tooLong.code,400);
});

test('기능이 꺼져 있으면 status 는 알려 주고 create 는 막는다',async()=>{
 store.clear();process.env.AI_GENERATION_ENABLED='0';
 try{
  assert.equal((await call('status',{},'GET')).data.enabled,false);
  const c=await call('create',{topic:''});assert.equal(c.code,503);
 }finally{process.env.AI_GENERATION_ENABLED='1';}
});

test('로그인하지 않으면 생성할 수 없다',async()=>{
 const r={headers:{},setHeader(){},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
 await ai({method:'POST',query:{op:'create'},body:{},headers:{origin:env.APP_ORIGIN}},r);
 assert.equal(r.code,401);
});
