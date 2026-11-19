import test from 'node:test';
import assert from 'node:assert/strict';
import {session,validate,nextRecord} from '../lib/core.mjs';
import {S3Client} from '@aws-sdk/client-s3';

const env={STUDIO_PASSWORD:'test-password-123456789',SESSION_SECRET:'x'.repeat(40),AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket',APP_ORIGIN:'https://studio.example'};
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

const {default:handler}=await import('../api/ai-generate.js');
const {advanceJob,retryJob,sanitizeError,STEP_NAMES}=await import('../lib/ai/pipeline.mjs');
const {newJob,createJob,loadJob}=await import('../lib/ai/jobs.mjs');
const {mockRunners}=await import('../lib/ai/runners.mjs');

const cookie='studio_session='+session(env);
async function call(op,{method='GET',body={},query={},ck=cookie,origin=env.APP_ORIGIN}={}){
 const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
 await handler({method,query:{op,...query},body,headers:{cookie:ck,origin}},r);
 return r;
}
function setFlags(flags){for(const k of ['AI_GENERATION_ENABLED','AI_MOCK','AI_DAILY_LIMIT'])delete process.env[k];Object.assign(process.env,flags);}

test('로그인·출처 확인: 쿠키가 없거나 다른 출처면 거부한다',async()=>{
 setFlags({AI_GENERATION_ENABLED:'1',AI_MOCK:'1'});
 assert.equal((await call('status',{ck:''})).code,401);
 assert.equal((await call('create',{method:'POST',origin:'https://evil.example'})).code,403);
 assert.equal((await call('create')).code,405);
 assert.equal((await call('create',{method:'POST',ck:''})).code,401);
});

test('기능 스위치가 꺼져 있으면 상태만 볼 수 있고 생성은 막힌다',async()=>{
 setFlags({AI_GENERATION_ENABLED:'0'});
 const status=await call('status');assert.equal(status.code,200);assert.equal(status.data.enabled,false);
 assert.equal((await call('create',{method:'POST',body:{}})).code,503);
});

test('실제 단계가 준비되기 전에는 가짜 모드가 아니면 생성이 막힌다',async()=>{
 setFlags({AI_GENERATION_ENABLED:'1',AI_MOCK:'0'});
 assert.equal((await call('create',{method:'POST',body:{}})).code,503);
});

test('가짜 모드: 한 번 호출에 한 단계씩 진행해 완료되고 글은 저장되지 않는다',async()=>{
 store.clear();setFlags({AI_GENERATION_ENABLED:'1',AI_MOCK:'1',AI_DAILY_LIMIT:'5'});
 const created=await call('create',{method:'POST',body:{topic:'임원 변경 등기 비용'}});
 assert.equal(created.code,201);
 const id=created.data.job.id;
 assert.equal(created.data.job.steps.length,STEP_NAMES.length);
 assert.equal(created.data.job.input.mode,'manual');
 let done=null;
 for(let i=0;i<STEP_NAMES.length;i++){
  const r=await call('advance',{method:'POST',body:{id}});assert.equal(r.code,200);
  const doneCount=r.data.job.steps.filter(s=>s.status==='done').length;
  assert.equal(doneCount,i+1);
  done=r.data.job;
 }
 assert.equal(done.status,'done');
 assert.equal([...store.keys()].some(k=>k.startsWith('studio/records/')),false);
 const got=await call('get',{query:{id}});assert.equal(Object.keys(got.data.outputs).length,STEP_NAMES.length);
 assert.equal((await call('list')).data.items.length,1);
});

test('하루 한도를 넘으면 429',async()=>{
 store.clear();setFlags({AI_GENERATION_ENABLED:'1',AI_MOCK:'1',AI_DAILY_LIMIT:'2'});
 assert.equal((await call('create',{method:'POST',body:{}})).code,201);
 assert.equal((await call('create',{method:'POST',body:{}})).code,201);
 assert.equal((await call('create',{method:'POST',body:{}})).code,429);
});

test('주제 길이 제한과 잘못된 작업 번호',async()=>{
 store.clear();setFlags({AI_GENERATION_ENABLED:'1',AI_MOCK:'1'});
 assert.equal((await call('create',{method:'POST',body:{topic:'가'.repeat(201)}})).code,400);
 assert.equal((await call('advance',{method:'POST',body:{id:'../secret'}})).code,400);
 assert.equal((await call('get',{query:{id:'20260101000000-deadbeef'}})).code,404);
});

test('실패하면 그 단계에서 멈추고, 재시도하면 그 단계부터 이어간다(키는 가려진다)',async()=>{
 store.clear();
 const job=await createJob(newJob({stepNames:STEP_NAMES,input:{mode:'auto',topic:''}}));
 let calls=0;
 const runners={...mockRunners(),outline:async()=>{calls++;if(calls===1)throw new Error('호출 실패 sk-ant-api03-SECRETSECRET Bearer abc.def-123');return {ok:true};}};
 await advanceJob(job.id,{runners});await advanceJob(job.id,{runners});
 const failed=await advanceJob(job.id,{runners});
 assert.equal(failed.status,'failed');
 const step=failed.steps.find(s=>s.status==='failed');
 assert.equal(step.name,'outline');assert.doesNotMatch(step.error,/SECRETSECRET|abc\.def/);
 await assert.rejects(()=>advanceJob(job.id,{runners}),{status:409});
 await retryJob(job.id);
 let latest=null;
 for(let i=0;i<STEP_NAMES.length;i++){latest=await advanceJob(job.id,{runners});if(latest.status==='done')break;}
 assert.equal(latest.status,'done');
 assert.equal(latest.steps.find(s=>s.name==='outline').attempts,2);
 assert.equal(calls,2);
});

test('같은 단계를 동시에 두 번 호출해도 한 번만 실행한다',async()=>{
 store.clear();
 const job=await createJob(newJob({stepNames:STEP_NAMES,input:{mode:'auto',topic:''}}));
 let runs=0;let release;const gate=new Promise(r=>{release=r;});
 const runners={...mockRunners(),topic:async()=>{runs++;await gate;return {ok:true};}};
 const first=advanceJob(job.id,{runners});
 await new Promise(r=>setTimeout(r,20));
 const second=await advanceJob(job.id,{runners});
 assert.equal(second.steps[0].status,'running');
 release();await first;
 assert.equal(runs,1);
 assert.equal((await loadJob(job.id)).value.steps[0].status,'done');
});

test('실행 중 끊겨 임대 시간이 지나면 같은 단계를 다시 이어서 실행한다',async()=>{
 store.clear();
 const job=await createJob(newJob({stepNames:STEP_NAMES,input:{mode:'auto',topic:''}}));
 const t0=Date.now();
 const stuck={...mockRunners(),topic:async()=>new Promise(()=>{})};
 void advanceJob(job.id,{runners:stuck,now:()=>t0});
 await new Promise(r=>setTimeout(r,20));
 const later=await advanceJob(job.id,{runners:mockRunners(),now:()=>t0+200_000});
 assert.equal(later.steps[0].status,'done');
 assert.equal(later.steps[0].attempts,2);
});

test('오류 문구에서 키·토큰이 지워진다',()=>{
 const text=sanitizeError(new Error('401 Bearer sk-ant-api03-ABCDEFGHIJ token'));
 assert.doesNotMatch(text,/ABCDEFGHIJ/);
});

test('AI 표시 필드는 저장되고, 사람이 수정해도 유지된다',()=>{
 const base={slug:'ai-post',title:'제목',category:'상호',html:'<p>a</p>',assets:[],status:'draft',author:'클로드 자동화'};
 const first=nextRecord({...base,generatedBy:'ai',ruleVersion:'v1',aiReview:{pass:4}},null,null);
 assert.equal(first.generatedBy,'ai');assert.equal(first.ruleVersion,'v1');assert.deepEqual(first.aiReview,{pass:4});
 const edited=nextRecord({...base,title:'수정한 제목'},first,first.revision);
 assert.equal(edited.title,'수정한 제목');assert.equal(edited.generatedBy,'ai');assert.equal(edited.ruleVersion,'v1');
 assert.throws(()=>validate({...base,aiReview:{x:'a'.repeat(20001)}}),{status:400});
 assert.equal(validate(base).generatedBy,undefined);
});
