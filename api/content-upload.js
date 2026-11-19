import {equal,fail,nextRecord,MAX_BYTES} from '../lib/core.mjs';
import {read,write} from '../lib/storage.mjs';

const COMPARE_KEYS=['title','category','summary','author','note','verification','seoTitle','seoDescription','html','entryPath','assets','tags','sourceUrls','status','reviewStatus'];
function sameContent(a,b){return JSON.stringify(COMPARE_KEYS.map(k=>a[k]??null))===JSON.stringify(COMPARE_KEYS.map(k=>b[k]??null));}

export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(req.method!=='POST')fail(405,'POST 요청만 허용됩니다.');
const tokens=[process.env.CONTENT_UPLOAD_TOKEN,process.env.CONTENT_UPLOAD_TOKEN_GITHUB].filter(t=>t&&t.length>=32);
if(!tokens.length)fail(503,'콘텐츠 등록 연결 설정이 필요합니다.');
const authorization=String(req.headers.authorization||'');
if(!authorization.startsWith('Bearer ')||!tokens.some(t=>equal(authorization.slice(7),t)))fail(401,'콘텐츠 등록 키가 올바르지 않습니다.');

  let body=req.body||{};
  if(typeof body==='string'){
   if(Buffer.byteLength(body)>MAX_BYTES+10000)fail(413,'전송 용량이 너무 큽니다.');
   try{body=JSON.parse(body);}catch{fail(400,'잘못된 요청입니다.');}
  }
  if(Buffer.byteLength(JSON.stringify(body))>MAX_BYTES+10000)fail(413,'전송 용량이 너무 큽니다.');

  const record={
   ...(body.record||body),
   status:'draft',
   reviewStatus:'pending',
   verification:'검토 전',
   author:String(body.record?.author||body.author||'ChatGPT').trim()||'ChatGPT'
  };
  const key='studio/records/'+String(record.slug||'')+'.json';
  const current=await read(key);
  const wantsReplace=body.replace===true||body.record?.replace===true;
  if(current&&!wantsReplace)fail(409,'같은 상세 주소의 글이 이미 있습니다. 관리 화면에서 기존 글을 확인해 주세요.');

  const next=nextRecord(record,null,null);
  if(current){
   // 덮어쓰기는 '자동 등록 이후 아무도 손대지 않은 글'에만 허용한다(수정 이력 0건·작성 중·검토 전·휴지통 아님).
   const old=current.value;
   if(old.deletedAt||(old.history||[]).length>0||old.status!=='draft'||old.reviewStatus!=='pending')fail(409,'이미 수정되었거나 휴지통에 있는 글이라 덮어쓰지 않았습니다.');
   const item={slug:next.slug,title:next.title,status:next.status,reviewStatus:next.reviewStatus,createdAt:old.createdAt};
   if(sameContent(old,next))return send(200,{ok:true,unchanged:true,item});
   await write(key,{...next,createdAt:old.createdAt},current.etag);
   return send(200,{ok:true,replaced:true,item});
  }
  await write(key,next);
  return send(201,{ok:true,item:{slug:next.slug,title:next.title,status:next.status,reviewStatus:next.reviewStatus,createdAt:next.createdAt}});
 }catch(e){
  if([409,412].includes(e.$metadata?.httpStatusCode))return send(409,{error:'같은 글이 동시에 등록되었습니다. 목록을 확인해 주세요.'});
  if(e.status)return send(e.status,{error:e.message});
  console.error('Content upload failed',e.name);
  return send(503,{error:'콘텐츠를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
