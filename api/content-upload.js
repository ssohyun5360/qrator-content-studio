import {equal,fail,nextRecord,MAX_BYTES} from '../lib/core.mjs';
import {read,write} from '../lib/storage.mjs';

export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(req.method!=='POST')fail(405,'POST 요청만 허용됩니다.');
  const token=process.env.CONTENT_UPLOAD_TOKEN;
  if(!token||token.length<32)fail(503,'콘텐츠 등록 연결 설정이 필요합니다.');
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer ')||!equal(authorization.slice(7),token))fail(401,'콘텐츠 등록 키가 올바르지 않습니다.');

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
  if(current)fail(409,'같은 상세 주소의 글이 이미 있습니다. 관리 화면에서 기존 글을 확인해 주세요.');

  const next=nextRecord(record,null,null);
  await write(key,next);
  return send(201,{ok:true,item:{slug:next.slug,title:next.title,status:next.status,reviewStatus:next.reviewStatus,createdAt:next.createdAt}});
 }catch(e){
  if([409,412].includes(e.$metadata?.httpStatusCode))return send(409,{error:'같은 글이 동시에 등록되었습니다. 목록을 확인해 주세요.'});
  if(e.status)return send(e.status,{error:e.message});
  console.error('Content upload failed',e.name);
  return send(503,{error:'콘텐츠를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
