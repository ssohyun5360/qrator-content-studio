export const MIRROR_PATH='settings/home-format.json';
const STUDIO_REPO='ssohyun5360/qrator-content-studio';

// 서식 설정을 콘텐츠 보관함(GitHub 비공개 저장소)에 파일로 복사한다.
// 이 PC 자동화는 스튜디오에 직접 접속할 수 없어서, 이 파일을 받아 읽는다. 실패해도 설정 저장은 성공으로 둔다.
export async function mirrorFormat(env,{version,values,updatedAt},fetchImpl=fetch){
 const repo=env.CONTENT_GITHUB_REPO,token=env.CONTENT_GITHUB_TOKEN;
 if(!token||!/^[-\w]+\/[-.\w]+$/.test(repo||''))return {ok:false,reason:'GitHub 연결 설정이 없어 자동화 연동은 건너뛰었습니다.'};
 if(repo.toLowerCase()===STUDIO_REPO)return {ok:false,reason:'콘텐츠 전용 저장소가 아니어서 자동화 연동은 건너뛰었습니다.'};
 const gh=async(path,method='GET',data)=>{
  const response=await fetchImpl('https://api.github.com/repos/'+repo+path,{
   method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
   body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000),redirect:'error'
  });
  return response;
 };
 try{
  const info=await gh('');
  if(!info.ok)return {ok:false,reason:`GitHub 저장소를 확인하지 못했습니다(${info.status}).`};
  if(!(await info.json()).private)return {ok:false,reason:'비공개 저장소가 아니어서 자동화 연동은 건너뛰었습니다.'};
  const existing=await gh('/contents/'+MIRROR_PATH);
  let sha;
  if(existing.ok)sha=(await existing.json()).sha;
  else if(existing.status!==404)return {ok:false,reason:`GitHub 파일을 확인하지 못했습니다(${existing.status}).`};
  const content=Buffer.from(JSON.stringify({version,updatedAt,values},null,2)+'\n').toString('base64');
  const put=await gh('/contents/'+MIRROR_PATH,'PUT',{message:`홈페이지 글 서식 v${version}`,content,...(sha?{sha}:{})});
  if(!put.ok)return {ok:false,reason:`GitHub 저장에 실패했습니다(${put.status}).`};
  return {ok:true};
 }catch{
  return {ok:false,reason:'GitHub에 연결하지 못했습니다. 잠시 후 다시 저장해 주세요.'};
 }
}
