import {authenticated,fail,slug,validate} from '../lib/core.mjs';
import {read,write} from '../lib/storage.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try{
  const env=process.env;
  if(!authenticated(req.headers.cookie,env))fail(401,'로그인이 필요합니다.');
  const repo=env.CONTENT_GITHUB_REPO;
  if(!env.CONTENT_GITHUB_TOKEN||!/^[-\w]+\/[-.\w]+$/.test(repo||''))fail(503,'GitHub 연결 설정이 필요합니다. 관리자에게 문의해 주세요.');
  const id=slug(req.query.slug);const key='studio/github/'+id+'.json';
  if(req.method==='GET'){const old=await read(key);return res.status(200).json({sync:old?.value?.repo===repo?old.value:null});}
  if(req.method!=='POST')fail(405,'허용되지 않은 요청입니다.');
  if(req.headers.origin!==new URL(env.APP_ORIGIN).origin)fail(403,'사이트 주소를 확인해 주세요.');
  const current=await read('studio/records/'+id+'.json');
  if(!current||current.value.deletedAt)fail(404,'콘텐츠가 없습니다.');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(body?.revision!==current.value.revision)fail(409,'글이 변경됐습니다. 새로고침 후 다시 저장해 주세요.');
  const r=validate(current.value);
  async function gh(path,method='GET',data){
   const response=await fetch('https://api.github.com/repos/'+repo+path,{method,headers:{Authorization:'Bearer '+env.CONTENT_GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok)fail(response.status===409||response.status===422?409:502,'GitHub 저장 실패 ('+response.status+'). 저장소·토큰 권한을 확인하거나 잠시 후 다시 시도해 주세요.');
   return response.json();
  }
  const info=await gh('');if(!info.private)fail(400,'콘텐츠 전용 비공개 저장소를 연결해 주세요.');
  if(repo.toLowerCase()==='ssohyun5360/qrator-content-studio')fail(400,'사이트 코드와 다른 콘텐츠 전용 저장소를 연결해 주세요.');
  const branch=encodeURIComponent(info.default_branch);const head=await gh('/git/ref/heads/'+branch);const commit=await gh('/git/commits/'+head.object.sha);
  const entries=[{path:'source/'+r.entryPath,mode:'100644',type:'blob',content:r.html},{path:'content.json',mode:'100644',type:'blob',content:JSON.stringify({title:r.title,slug:id,revision:current.value.revision,updatedAt:current.value.updatedAt,entryPath:'source/'+r.entryPath},null,2)}];
  for(let i=0;i<r.assets.length;i+=5){entries.push(...await Promise.all(r.assets.slice(i,i+5).map(async a=>{const blob=await gh('/git/blobs','POST',{content:a.base64,encoding:'base64'});return {path:'source/'+a.path,mode:'100644',type:'blob',sha:blob.sha};})));}
  const article=await gh('/git/trees','POST',{tree:entries});
  const root=await gh('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'guides/'+id,mode:'040000',type:'tree',sha:article.sha}]});
  const saved=await gh('/git/commits','POST',{message:'Save guide: '+r.title,tree:root.sha,parents:[head.object.sha]});
  await gh('/git/refs/heads/'+branch,'PATCH',{sha:saved.sha,force:false});
  const sync={repo,revision:current.value.revision,savedAt:new Date().toISOString(),url:'https://github.com/'+repo+'/commit/'+saved.sha};
  let warning;try{const previous=await read(key);await write(key,sync,previous?.etag);}catch{warning='GitHub에는 저장됐지만 상태 기록에 실패했습니다.';}
  return res.status(200).json({sync,warning});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'GitHub 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'});}
}
