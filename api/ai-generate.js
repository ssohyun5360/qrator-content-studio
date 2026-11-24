import {authenticated,fail} from '../lib/core.mjs';
import {createJob,loadJob,recentJobs,newJob} from '../lib/ai/jobs.mjs';
import {STEP_NAMES,advanceJob,retryJob,publicJob} from '../lib/ai/pipeline.mjs';
import {getRunners} from '../lib/ai/runners.mjs';
import {reserve,usedToday,dailyLimit} from '../lib/ai/usage.mjs';

const MAX_BODY=20_000;
const CATEGORIES=['상호 변경','본점 이전','목적 변경','임원 변경','지점 변경'];
const PLANNING_FIELDS=['sequence','month','progress','assignee','publishDate','weekday','series','keywords','blogUrl','references'];
const textValue=(value,max,label)=>{const text=value===undefined||value===null?'':String(value).trim();if(text.length>max)fail(400,`${label}은(는) ${max}자 이내로 입력해 주세요.`);return text;};
function planningValue(value){
 if(value===undefined||value===null)return {};
 if(typeof value!=='object'||Array.isArray(value))fail(400,'콘텐츠 일정 정보를 확인해 주세요.');
 return Object.fromEntries(PLANNING_FIELDS.map(name=>[name,textValue(value[name],name==='references'?2000:500,'콘텐츠 일정 정보')]).filter(([,text])=>text));
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env;const op=String(req.query?.op||'');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(!['GET','POST'].includes(req.method))fail(405,'허용되지 않은 요청입니다.');
  if(!env.STUDIO_PASSWORD||env.STUDIO_PASSWORD.length<16||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.APP_ORIGIN||!env.S3_BUCKET||!env.AWS_REGION)fail(503,'사이트 연결 설정이 필요합니다.');
  if(req.method==='POST'&&req.headers.origin!==new URL(env.APP_ORIGIN).origin)fail(403,'사이트 주소를 확인한 뒤 다시 접속해 주세요.');
  if(!authenticated(req.headers.cookie,env))fail(401,'로그인이 필요합니다.');

  let body=req.body||{};
  if(typeof body==='string'){
   if(Buffer.byteLength(body)>MAX_BODY)fail(413,'전송 용량이 너무 큽니다.');
   try{body=JSON.parse(body);}catch{fail(400,'잘못된 요청입니다.');}
  }
  if(Buffer.byteLength(JSON.stringify(body))>MAX_BODY)fail(413,'전송 용량이 너무 큽니다.');
  const posts=['create','advance','retry'];
  if(posts.includes(op)&&req.method!=='POST')fail(405,'POST 요청이 필요합니다.');

  const enabled=env.AI_GENERATION_ENABLED==='1';
  if(op==='status'){
   return send(200,{enabled,mock:env.AI_MOCK==='1',dailyLimit:dailyLimit(env),usedToday:await usedToday(),steps:STEP_NAMES});
  }
  if(!enabled)fail(503,'AI 콘텐츠 생성 기능이 아직 켜져 있지 않습니다.');

  if(op==='create'){
   const runners=getRunners(env);
   if(!runners)fail(503,'AI 생성 단계가 준비되지 않았습니다.');
   const topic=textValue(body.topic,200,'주제');
   const category=body.category===undefined||body.category===null||body.category===''?'':String(body.category);
   if(category&&!CATEGORIES.includes(category))fail(400,'카테고리를 확인해 주세요.');
   const brief=textValue(body.brief,8000,'소재·기획방향');
   const planning=planningValue(body.planning);
   await reserve(env);
   const job=await createJob(newJob({stepNames:STEP_NAMES,input:{mode:topic?'manual':'auto',topic,category,brief,planning},meta:{mock:env.AI_MOCK==='1'}}));
   return send(201,{job:publicJob(job)});
  }
  if(op==='advance'){
   const job=await advanceJob(String(body.id||''),{runners:getRunners(env)});
   return send(200,{job:publicJob(job)});
  }
  if(op==='retry'){
   return send(200,{job:publicJob(await retryJob(String(body.id||'')))});
  }
  if(op==='get'){
   const {value}=await loadJob(String(req.query.id||''));
   return send(200,{job:publicJob(value),outputs:value.outputs});
  }
  if(op==='list'){
   return send(200,{items:(await recentJobs(20)).map(publicJob)});
  }
  fail(404,'알 수 없는 요청입니다.');
 }catch(e){
  if([409,412].includes(e.$metadata?.httpStatusCode))return send(409,{error:'같은 작업을 다른 요청이 처리 중입니다. 잠시 후 다시 확인해 주세요.'});
  if(e.status)return send(e.status,{error:e.message});
  console.error('AI generate failed',e.name);
  return send(503,{error:'AI 생성 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
