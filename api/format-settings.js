import {authenticated,fail} from '../lib/core.mjs';
import {loadFormat,saveFormat} from '../lib/format-store.mjs';
import {DEFAULTS,PRESETS,LIMITS,LABELS,ALIGN_OPTIONS} from '../lib/format.mjs';
import {mirrorFormat} from '../lib/format-mirror.mjs';

const MAX_BODY=5_000;

const view=state=>({
 version:state.version,values:state.values,updatedAt:state.updatedAt,
 history:(state.history||[]).slice(-10).reverse().map(h=>({version:h.version,updatedAt:h.updatedAt,changed:(h.changed||[]).map(k=>LABELS[k]||k),preset:h.preset||null}))
});
const meta={defaults:DEFAULTS,presets:Object.fromEntries(Object.entries(PRESETS).map(([k,v])=>[k,{label:v.label,values:v.values}])),limits:LIMITS,labels:LABELS,alignOptions:ALIGN_OPTIONS};

export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env;const op=String(req.query?.op||'get');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(!['GET','POST'].includes(req.method))fail(405,'허용되지 않은 요청입니다.');
  if(!env.STUDIO_PASSWORD||env.STUDIO_PASSWORD.length<16||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.APP_ORIGIN||!env.S3_BUCKET||!env.AWS_REGION)fail(503,'사이트 연결 설정이 필요합니다.');
  if(req.method==='POST'&&req.headers.origin!==new URL(env.APP_ORIGIN).origin)fail(403,'사이트 주소를 확인한 뒤 다시 접속해 주세요.');
  if(!authenticated(req.headers.cookie,env))fail(401,'로그인이 필요합니다.');

  if(op==='get'){
   if(req.method!=='GET')fail(405,'GET 요청이 필요합니다.');
   return send(200,{...view(await loadFormat()),...meta});
  }
  if(op==='save'||op==='reset'){
   if(req.method!=='POST')fail(405,'POST 요청이 필요합니다.');
   let body=req.body||{};
   if(typeof body==='string'){
    if(Buffer.byteLength(body)>MAX_BODY)fail(413,'전송 용량이 너무 큽니다.');
    try{body=JSON.parse(body);}catch{fail(400,'잘못된 요청입니다.');}
   }
   if(Buffer.byteLength(JSON.stringify(body))>MAX_BODY)fail(413,'전송 용량이 너무 큽니다.');
   const state=await saveFormat(op==='reset'?{preset:String(body.preset||''),expectedVersion:body.expectedVersion}:{values:body.values,expectedVersion:body.expectedVersion});
   const mirror=state.unchanged?{ok:true,skipped:true}:await mirrorFormat(env,state);
   return send(200,{...view(state),unchanged:!!state.unchanged,mirror});
  }
  fail(404,'알 수 없는 요청입니다.');
 }catch(e){
  if([409,412].includes(e.$metadata?.httpStatusCode))return send(409,{error:'다른 사람이 먼저 저장했습니다. 화면을 새로고침한 뒤 다시 바꿔 주세요.'});
  if(e.status)return send(e.status,{error:e.message});
  console.error('Format settings failed',e.name);
  return send(503,{error:'서식 설정을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
