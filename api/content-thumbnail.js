import {equal,fail,slug,path,nextRecord,MAX_BYTES} from '../lib/core.mjs';
import {read,write} from '../lib/storage.mjs';
import {pickThumbnails} from '../public/thumb-helpers.mjs';

// 외부 도구가 글을 등록한 뒤 썸네일 이미지만 따로 붙이는 API.
// 상세용 대표 이미지(16:9): assets/thumbnails/{slug}.{svg|png|jpg|webp}
// 목록용 1:1 썸네일:       assets/thumbnails/{slug}-square.{svg|png|jpg|webp}
// 본문과 상태는 바꾸지 않고, 본문이 가리키던 썸네일 경로가 달라졌을 때만 그 경로를 새 파일로 맞춘다.
const MIME_BY_EXT={svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
const MAX_SVG_BYTES=500_000;
const MAX_RASTER_BYTES=1_200_000;
const BASE64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function describe(assetPath,id){
 const match=String(assetPath).match(new RegExp('^assets/thumbnails/'+id+'(-square)?\\.(svg|png|jpe?g|webp)$'));
 return match?{variant:match[1]?'square':'cover',ext:match[2]}:null;
}
// 파일 이름과 실제 내용이 같은 형식인지 확인한다(다른 형식을 이름만 바꿔 올리는 것을 막는다).
function looksLike(ext,bytes){
 if(ext==='png')return bytes.length>8&&bytes[0]===0x89&&bytes.toString('latin1',1,4)==='PNG';
 if(ext==='jpg'||ext==='jpeg')return bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(ext==='webp')return bytes.length>12&&bytes.toString('latin1',0,4)==='RIFF'&&bytes.toString('latin1',8,12)==='WEBP';
 if(ext==='svg'){const text=bytes.toString('utf8');return /<svg[\s>]/i.test(text)&&!/<script|\son\w+\s*=|javascript:/i.test(text);}
 return false;
}

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
  const kind=describe(assetPath,id);
  if(!kind)fail(400,'이 글에 사용할 수 있는 썸네일 파일이 아닙니다. assets/thumbnails/'+id+'.(svg|png|jpg|webp) 또는 '+id+'-square.(…) 이름을 써 주세요.');
  if(asset.mime!==MIME_BY_EXT[kind.ext])fail(400,'파일 형식(mime)이 확장자와 맞지 않습니다. '+MIME_BY_EXT[kind.ext]+' 으로 보내 주세요.');
  if(typeof asset.base64!=='string'||!BASE64.test(asset.base64))fail(400,'썸네일 데이터가 올바르지 않습니다.');
  const bytes=Buffer.from(asset.base64,'base64');
  if(bytes.byteLength>(kind.ext==='svg'?MAX_SVG_BYTES:MAX_RASTER_BYTES))fail(413,kind.ext==='svg'?'SVG 썸네일은 500KB 이내로 올려 주세요.':'썸네일 이미지는 1.2MB 이내로 올려 주세요.');
  if(!looksLike(kind.ext,bytes))fail(400,'파일 내용이 '+kind.ext.toUpperCase()+' 형식이 아닙니다.');

  // 같은 종류(상세용/목록용)의 기존 썸네일만 교체하고, 다른 종류는 그대로 둔다. 새 파일을 맨 앞에 두어 대표 이미지로 먼저 고르게 한다.
  const sameKind=a=>{const found=describe(a.path,id);return found&&found.variant===kind.variant;};
  const assets=[{path:assetPath,mime:asset.mime,base64:asset.base64},...(current.assets||[]).filter(item=>!sameKind(item))];
  // 본문이 같은 글의 다른 확장자 썸네일(예: .webp)을 가리키고 있으면 새 파일 경로로 맞춘다. 파일이 없어 이미지가 빠져 보이던 경우를 바로잡는다.
  const stem='assets/thumbnails/'+id+(kind.variant==='square'?'-square':'');
  const reference=new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.(?:svg|png|jpe?g|webp)(?![\\w-])','g');
  const html=typeof current.html==='string'?current.html.replace(reference,assetPath):current.html;
  const next=nextRecord({...current,assets,html,author:current.author},current,current.revision);
  try{await write('studio/versions/'+id+'/'+current.revision+'.json',current);}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}
  await write(key,next,stored.etag);
  const {cover,square}=pickThumbnails(next.assets);
  return send(200,{ok:true,item:{slug:id,title:next.title,variant:kind.variant,thumbnailPath:assetPath,coverPath:cover?.path||null,squarePath:square?.path||null,status:next.status,reviewStatus:next.reviewStatus,updatedAt:next.updatedAt,htmlUpdated:html!==current.html}});
 }catch(e){
  if(e.$metadata?.httpStatusCode===412)return send(409,{error:'다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.'});
  if(e.status)return send(e.status,{error:e.message});
  console.error('Content thumbnail update failed',e.name);
  return send(503,{error:'썸네일을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
