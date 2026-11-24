import {createHash} from 'node:crypto';
import {fail,slug,verifyThumbnailSignature} from '../lib/core.mjs';
import {read} from '../lib/storage.mjs';
import {thumbnailAsset} from '../public/thumb-helpers.mjs';

// 로그인 없이 썸네일 이미지만 내려주는 주소: /api/thumbnail?slug=…&variant=cover|square&sig=…
// 서명이 맞는 주소만 열리고, 본문·다른 첨부는 이 주소로 읽을 수 없다. HTML 의 <img src> 에 그대로 넣어 쓴다.
export default async function handler(req,res){
 const env=process.env;
 res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,message)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');return res.status(code).json({error:message});};
 try{
  if(!['GET','HEAD'].includes(req.method))fail(405,'GET 요청만 허용됩니다.');
  if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.S3_BUCKET||!env.AWS_REGION)fail(503,'사이트 연결 설정이 필요합니다.');
  const id=slug(req.query?.slug);
  const variant=String(req.query?.variant||'cover');
  if(!['cover','square'].includes(variant))fail(400,'썸네일 종류를 확인해 주세요.');
  if(!verifyThumbnailSignature(id,variant,String(req.query?.sig||''),env))fail(403,'이미지 주소가 올바르지 않습니다.');
  const stored=await read('studio/records/'+id+'.json');
  // 휴지통·비공개 글의 이미지는 서명이 맞아도 내려주지 않는다.
  if(!stored||stored.value.deletedAt||stored.value.status==='private')fail(404,'이미지를 찾을 수 없습니다.');
  const asset=thumbnailAsset(stored.value.assets||[],variant);
  if(!asset||!String(asset.mime||'').startsWith('image/'))fail(404,variant==='square'?'1:1 썸네일이 없는 글입니다.':'대표 이미지가 없는 글입니다.');
  const bytes=Buffer.from(asset.base64,'base64');
  const etag='"'+createHash('sha1').update(bytes).digest('hex')+'"';
  res.setHeader('Content-Type',asset.mime);
  res.setHeader('ETag',etag);
  // 이미지를 바꾸면 5분 안에 새 이미지로 바뀐다. 다른 사이트의 <img> 에서도 쓸 수 있게 열어 두되, 이미지 자체가 스크립트를 못 돌리게 막는다.
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
  if(req.headers?.['if-none-match']===etag)return res.status(304).end();
  res.setHeader('Content-Length',String(bytes.length));
  return req.method==='HEAD'?res.status(200).end():res.status(200).send(bytes);
 }catch(e){
  if(e.status)return send(e.status,e.message);
  console.error('Thumbnail request failed',e.name);
  return send(503,'이미지를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
 }
}
