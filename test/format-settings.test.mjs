import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from '../lib/core.mjs';
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

const {default:handler}=await import('../api/format-settings.js');
const {DEFAULTS,PRESETS,LIMITS,validateFormat,formatCss}=await import('../lib/format.mjs');
const {mirrorFormat,MIRROR_PATH}=await import('../lib/format-mirror.mjs');
const {renderHomeArticle}=await import('../lib/ai/template-home.mjs');
const {mockArticle}=await import('../lib/ai/mock-article.mjs');

const cookie='studio_session='+session(env);
async function call(op,{method='GET',body,ck=cookie,origin=env.APP_ORIGIN}={}){
 const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
 await handler({method,query:{op},body,headers:{cookie:ck,origin}},r);return r;
}
const realFetch=globalThis.fetch;
function mockGithub({privateRepo=true,putStatus=200}={}){
 const calls=[];
 globalThis.fetch=async(url,opt={})=>{
  const method=opt.method||'GET';calls.push({url:String(url),method,body:opt.body?JSON.parse(opt.body):null});
  const json=(status,data)=>({ok:status<300,status,json:async()=>data});
  if(String(url).endsWith('/contents/'+MIRROR_PATH))return method==='PUT'?json(putStatus,{}):json(404,{});
  return json(200,{private:privateRepo});
 };
 return calls;
}
const ghEnv={CONTENT_GITHUB_REPO:'owner/guide-content',CONTENT_GITHUB_TOKEN:'ghp_test_token_value'};

test('기본값과 두 가지 묶음은 모두 허용 범위 안이다',()=>{
 assert.deepEqual(validateFormat(DEFAULTS),DEFAULTS);
 for(const p of Object.values(PRESETS))assert.deepEqual(validateFormat(p.values),p.values);
 assert.equal(DEFAULTS.headingAlign,'left');
});

test('잘못된 값은 거부한다(모르는 항목·범위 밖·글자·정렬 값)',()=>{
 assert.throws(()=>validateFormat({evil:1}),{status:400});
 assert.throws(()=>validateFormat({bodySize:LIMITS.bodySize.max+1}),{status:400});
 assert.throws(()=>validateFormat({bodySize:LIMITS.bodySize.min-1}),{status:400});
 assert.throws(()=>validateFormat({bodySize:'abc'}),{status:400});
 assert.throws(()=>validateFormat({bodySize:''}),{status:400});
 assert.throws(()=>validateFormat({lineHeight:Infinity}),{status:400});
 assert.throws(()=>validateFormat({headingAlign:'right'}),{status:400});
 assert.throws(()=>validateFormat({headingAlign:'left;}body{display:none'}),{status:400});
 assert.throws(()=>validateFormat(null),{status:400});
 assert.throws(()=>validateFormat([]),{status:400});
 assert.equal(validateFormat({bodySize:'17',lineHeight:'1.654'}).bodySize,17);
 assert.equal(validateFormat({lineHeight:1.654}).lineHeight,1.65);
});

test('CSS: 정렬·크기가 값대로 만들어지고 모바일(600px 이하)은 크기를 건드리지 않는다',()=>{
 const css=formatCss({...DEFAULTS,headingAlign:'left',bodyAlign:'center',headingSize:26,bodySize:18});
 assert.match(css,/\.article-section h2[^{]*\{text-align:left\}/);
 assert.match(css,/\.qbe-intro p[^{]*\{text-align:center\}/);
 const media=css.match(/@media\(min-width:601px\)\{.*\}\n/)[0];
 assert.match(media,/font-size:26px/);assert.match(media,/font-size:18px/);
 assert.ok(!css.includes('max-width:600px'));
 assert.ok(!/<|javascript/i.test(css));
});

test('홈페이지 글 HTML: 서식을 넘기면 원본 CSS 뒤에 덧붙고, 안 넘기면 원본 그대로다',()=>{
 const base=renderHomeArticle(mockArticle(),{date:new Date('2026-11-20T10:00:00+09:00'),slug:'fmt-test'});
 const withFmt=renderHomeArticle(mockArticle(),{date:new Date('2026-11-20T10:00:00+09:00'),slug:'fmt-test',format:{headingAlign:'left',headingSize:24}});
 assert.ok(!base.includes('홈페이지 글 서식'));
 assert.ok(withFmt.includes('홈페이지 글 서식(스튜디오 설정)'));
 assert.ok(withFmt.indexOf('qbv-toc{')<withFmt.indexOf('홈페이지 글 서식(스튜디오 설정)'),'원본 CSS 다음에 덧붙는다');
 assert.ok(withFmt.includes('font-size:24px'));
});

test('API: 로그인·출처 확인',async()=>{
 assert.equal((await call('get',{ck:''})).code,401);
 assert.equal((await call('save',{method:'POST',origin:'https://evil.example',body:{values:{},expectedVersion:0}})).code,403);
 assert.equal((await call('save',{body:{}})).code,405);
});

test('API: 처음에는 기본값을 돌려주고, 항목 범위·묶음 목록도 함께 준다',async()=>{
 store.clear();
 const r=await call('get');
 assert.equal(r.code,200);assert.equal(r.data.version,0);
 assert.deepEqual(r.data.values,DEFAULTS);
 assert.ok(r.data.presets.original&&r.data.presets.studio);assert.ok(r.data.limits.bodySize);
});

test('API: 저장하면 버전이 올라가고 이력이 남으며 GitHub 파일로도 복사된다',async()=>{
 store.clear();const calls=mockGithub();Object.assign(process.env,ghEnv);
 try{
  const r=await call('save',{method:'POST',body:{values:{bodyAlign:'left',bodySize:18},expectedVersion:0}});
  assert.equal(r.code,200,JSON.stringify(r.data));
  assert.equal(r.data.version,1);assert.equal(r.data.values.bodyAlign,'left');assert.equal(r.data.values.bodySize,18);
  assert.equal(r.data.values.headingAlign,'left');
  assert.deepEqual(r.data.history[0].changed,['본문 정렬','본문 글자 크기']);
  assert.equal(r.data.mirror.ok,true);
  const put=calls.find(c=>c.method==='PUT');
  assert.ok(put&&put.url.endsWith('/contents/'+MIRROR_PATH));
  const file=JSON.parse(Buffer.from(put.body.content,'base64').toString('utf8'));
  assert.equal(file.version,1);assert.equal(file.values.bodySize,18);
  assert.equal((await call('get')).data.values.bodySize,18);
 }finally{globalThis.fetch=realFetch;delete process.env.CONTENT_GITHUB_REPO;delete process.env.CONTENT_GITHUB_TOKEN;}
});

test('API: GitHub 복사가 실패해도 저장은 성공이고 이유를 알려 준다',async()=>{
 store.clear();mockGithub({putStatus:500});Object.assign(process.env,ghEnv);
 try{
  const r=await call('save',{method:'POST',body:{values:{titleSize:28},expectedVersion:0}});
  assert.equal(r.code,200);assert.equal(r.data.version,1);
  assert.equal(r.data.mirror.ok,false);assert.match(r.data.mirror.reason,/500/);
 }finally{globalThis.fetch=realFetch;delete process.env.CONTENT_GITHUB_REPO;delete process.env.CONTENT_GITHUB_TOKEN;}
});

test('GitHub 연결 설정이 없거나 공개 저장소·사이트 코드 저장소면 복사하지 않는다',async()=>{
 const v={version:1,values:DEFAULTS,updatedAt:'x'};
 assert.equal((await mirrorFormat({},v)).ok,false);
 mockGithub({privateRepo:false});
 try{
  assert.match((await mirrorFormat(ghEnv,v)).reason,/비공개/);
  assert.equal((await mirrorFormat({...ghEnv,CONTENT_GITHUB_REPO:'ssohyun5360/qrator-content-studio'},v)).ok,false);
 }finally{globalThis.fetch=realFetch;}
});

test('API: 다른 사람이 먼저 저장했으면(버전 불일치) 409, 잘못된 값은 400',async()=>{
 store.clear();
 assert.equal((await call('save',{method:'POST',body:{values:{titleSize:28},expectedVersion:0}})).code,200);
 const stale=await call('save',{method:'POST',body:{values:{titleSize:29},expectedVersion:0}});
 assert.equal(stale.code,409);assert.match(stale.data.error,/먼저 저장/);
 assert.equal((await call('get')).data.values.titleSize,28);
 assert.equal((await call('save',{method:'POST',body:{values:{titleSize:999},expectedVersion:1}})).code,400);
 assert.equal((await call('save',{method:'POST',body:{values:{headingAlign:'right'},expectedVersion:1}})).code,400);
});

test('API: 바뀐 게 없으면 버전을 올리지 않고, 묶음 적용은 한 번에 바뀐다',async()=>{
 store.clear();
 const same=await call('save',{method:'POST',body:{values:{},expectedVersion:0}});
 assert.equal(same.data.unchanged,true);assert.equal(same.data.version,0);
 const preset=await call('reset',{method:'POST',body:{preset:'original',expectedVersion:0}});
 assert.equal(preset.code,200);assert.equal(preset.data.version,1);
 assert.deepEqual(preset.data.values,PRESETS.original.values);
 assert.equal(preset.data.history[0].preset,'original');
 assert.equal((await call('reset',{method:'POST',body:{preset:'nope',expectedVersion:1}})).code,400);
});

test('AI 생성 파이프라인: 저장된 서식이 만들어진 글의 HTML과 메모에 들어간다',async()=>{
 store.clear();
 assert.equal((await call('save',{method:'POST',body:{values:{headingSize:27,bodyAlign:'left'},expectedVersion:0}})).code,200);
 const {advanceJob,STEP_NAMES}=await import('../lib/ai/pipeline.mjs');
 const {newJob,createJob}=await import('../lib/ai/jobs.mjs');
 const {mockRunners}=await import('../lib/ai/runners.mjs');
 Object.assign(process.env,{AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket'});
 const job=await createJob(newJob({stepNames:STEP_NAMES,input:{mode:'auto',topic:''},meta:{mock:true}}));
 let j=job;for(let i=0;i<STEP_NAMES.length+1&&j.status!=='done'&&j.status!=='failed';i++)j=await advanceJob(job.id,{runners:mockRunners()});
 assert.equal(j.status,'done',JSON.stringify(j.steps.filter(s=>s.status==='failed')));
 const key=[...store.keys()].find(k=>k.startsWith('studio/records/'));
 const record=JSON.parse(store.get(key).body);
 assert.ok(record.html.includes('font-size:27px'));
 assert.match(record.html,/\.qbe-intro p[^{]*\{text-align:left\}/);
 assert.match(record.note,/서식 v1/);
});
