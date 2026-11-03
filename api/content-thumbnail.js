import {equal,fail,slug,path,nextRecord,MAX_BYTES} from '../lib/core.mjs';
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
   if(Buffer.byteLength(body)>MAX_BYTES)fail(413,'전송 용량이 너무 큽니다.');
   try{body=JSON.parse(body);}catch{fail(400,'잘못된 요청입니다.');}
  }
  if(Buffer.byteLength(JSON.stringify(body))>MAX_BYTES)fail(413,'전송 용량이 너무 큽니다.');

  const id=slug(body.slug);
  const key='studio/records/'+id+'.json';
  const stored=await read(key);
  if(!stored)fail(404,'썸네일을 추가할 글을 찾을 수 없습니다.');
  const current=stored.value;
  if(current.deletedAt)fail(409,'휴지통의 글에는 썸네일을 추가할 수 없습니다.');

  const asset=body.asset||{};
  const assetPath=path(asset.path);
  if(assetPath!=='assets/thumbnails/'+id+'.svg'||asset.mime!=='image/svg+xml')fail(400,'이 글에 사용할 수 있는 썸네일 파일이 아닙니다.');
  if(typeof asset.base64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.base64))fail(400,'썸네일 데이터가 올바르지 않습니다.');
  if(Buffer.from(asset.base64,'base64').byteLength>500_000)fail(413,'썸네일은 500KB 이내로 올려 주세요.');

  const assets=[...(current.assets||[]).filter(item=>!String(item.path||'').startsWith('assets/thumbnails/')),asset];
  const next=nextRecord({...current,assets,author:current.author},current,current.revision);
  try{await write('studio/versions/'+id+'/'+current.revision+'.json',current);}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}
  await write(key,next,stored.etag);
  return send(200,{ok:true,item:{slug:id,title:next.title,thumbnailPath:assetPath,status:next.status,reviewStatus:next.reviewStatus,updatedAt:next.updatedAt}});
 }catch(e){
  if(e.$metadata?.httpStatusCode===412)return send(409,{error:'다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.'});
  if(e.status)return send(e.status,{error:e.message});
  console.error('Content thumbnail update failed',e.name);
  return send(503,{error:'썸네일을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
