import {createHash} from 'node:crypto';
import {authenticated,session,equal,fail,slug,validate,nextRecord,summary,MAX_BYTES} from '../lib/core.mjs';
import {read,write,list,remove,removePrefix} from '../lib/storage.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env;const op=String(req.query?.op||'');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(!['GET','POST'].includes(req.method))fail(405,'허용되지 않은 요청입니다.');
  if(!env.STUDIO_PASSWORD||env.STUDIO_PASSWORD.length<16||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.APP_ORIGIN||!env.S3_BUCKET||!env.AWS_REGION)fail(503,'사이트 연결 설정이 필요합니다. Vercel 환경변수와 AWS S3 설정을 완료해 주세요.');
  if(req.method==='POST'&&req.headers.origin!==new URL(env.APP_ORIGIN).origin)fail(403,'사이트 주소를 확인한 뒤 다시 접속해 주세요.');
  let body=req.body||{};if(typeof body==='string'){if(Buffer.byteLength(body)>MAX_BYTES+10000)fail(413,'전송 용량이 너무 큽니다.');try{body=JSON.parse(body);}catch{fail(400,'잘못된 요청입니다.');}}
  if(Buffer.byteLength(JSON.stringify(body))>MAX_BYTES+10000)fail(413,'전송 용량이 너무 큽니다.');
  const mutations=['login','logout','save','delete','restore','emptyTrash'];if(mutations.includes(op)&&req.method!=='POST')fail(405,'POST 요청이 필요합니다.');
  const cookie=(value,age)=>res.setHeader('Set-Cookie',`studio_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`);
  if(op==='login'){
   // Vercel overwrites this header; do not use a user-provided forwarding header.
   const ip=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown');
   const key='studio/auth/'+createHash('sha256').update(ip).digest('hex')+'.json';const old=await read(key);const now=Date.now();
   const attempts=old&&old.value.until>now?old.value:{count:0,until:now+15*60*1000};
   if(attempts.count>=10)fail(429,'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');
   await write(key,{...attempts,count:attempts.count+1},old?.etag);
   if(typeof body.password!=='string'||!equal(body.password,env.STUDIO_PASSWORD))fail(401,'비밀번호가 일치하지 않습니다.');
   cookie(session(env),43200);return send(200,{user:{name:'팀 공용 관리자'}});
  }
  if(op==='logout'){cookie('',0);return send(200,{ok:true});}
  if(!authenticated(req.headers.cookie,env))fail(401,'로그인이 필요합니다.');
  if(op==='session')return send(200,{user:{name:'팀 공용 관리자'}});
  if(op==='list'){const records=await list();return send(200,{items:records.filter(r=>req.query.trash==='1'?!!r.deletedAt:!r.deletedAt).map(summary)});}
  if(op==='emptyTrash'){
   const items=body.items;
   if(!Array.isArray(items)||items.length>500)fail(400,'휴지통 항목을 확인해 주세요.');
   let deleted=0;const skipped=[];
   for(const item of items){
    const id=slug(item?.slug);const key='studio/records/'+id+'.json';const current=await read(key);
    if(!current||!current.value.deletedAt||current.value.revision!==item.revision){skipped.push(id);continue;}
    await removePrefix('studio/versions/'+id+'/');
    await remove('studio/github/'+id+'.json');
    await remove(key);deleted++;
   }
   return send(200,{deleted,skipped});
  }
  const id=slug(req.query.slug||body.slug||body.record?.slug);const key='studio/records/'+id+'.json';const current=await read(key);
  if(op==='get'){if(!current||current.value.deletedAt)fail(404,'콘텐츠가 없습니다.');return send(200,current.value);}
  if(op==='version'){const revision=String(req.query.revision||'');if(!current||!current.value.history.some(x=>x.revision===revision))fail(404,'수정 이력이 없습니다.');const version=await read('studio/versions/'+id+'/'+revision+'.json');if(!version)fail(404,'수정 이력이 없습니다.');return send(200,version.value);}
  if(op==='save'){
   const next=nextRecord(body.record,current?.value,body.expectedRevision);
   if(current){try{await write('studio/versions/'+id+'/'+current.value.revision+'.json',current.value);}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}}
   await write(key,next,current?.etag);return send(200,next);
  }
  if(op==='delete'||op==='restore'){
   if(!current)fail(404,'콘텐츠가 없습니다.');if(current.value.revision!==body.expectedRevision)fail(409,'다른 팀원이 수정했습니다. 목록을 새로고침해 주세요.');
   const next={...current.value,deletedAt:op==='delete'?new Date().toISOString():null};await write(key,next,current.etag);return send(200,{ok:true});
  }
  fail(400,'지원하지 않는 요청입니다.');
 }catch(e){if([409,412].includes(e.$metadata?.httpStatusCode))return send(409,{error:'동시에 변경된 내용이 있습니다. 다시 시도해 주세요.'});if(e.status)return send(e.status,{error:e.message});if(e.name==='AccessDenied'||e.Code==='AccessDenied')return send(403,{error:'AWS S3 권한이 부족합니다. IAM 정책에 studio 경로의 s3:DeleteObject 권한과 studio/versions/ 목록 권한을 추가해 주세요.'});console.error('Studio request failed',e.name,{code:typeof e.code==='string'?e.code.replace(/[^A-Z_0-9]/g,'').slice(0,60):undefined,frames:String(e.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,6)});return send(503,{error:'저장소에 연결할 수 없습니다. AWS 연결 정보와 권한을 확인해 주세요.'});}
}
