import {authenticated,fail} from '../lib/core.mjs';
import {list} from '../lib/storage.mjs';
import {blogIdFrom,loadNaverPosts,matchPostsToRecords,studioOnlyRecords} from '../lib/naver.mjs';

// 네이버 블로그에 올라가 있는 글 목록(공개 RSS)을 스튜디오 글과 맞춰 돌려준다. 로그인한 팀원만 볼 수 있다.
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env;
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(req.method!=='GET')fail(405,'허용되지 않은 요청입니다.');
  if(!env.STUDIO_PASSWORD||env.STUDIO_PASSWORD.length<16||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.APP_ORIGIN||!env.S3_BUCKET||!env.AWS_REGION)fail(503,'사이트 연결 설정이 필요합니다.');
  if(!authenticated(req.headers.cookie,env))fail(401,'로그인이 필요합니다.');
  const blogId=blogIdFrom(env);
  const naver=await loadNaverPosts(blogId,{force:req.query?.refresh==='1'});
  let records=[];
  try{records=await list();}catch(e){console.error('Naver compare: content list failed',e.name);}
  const posts=matchPostsToRecords(naver.posts,records);
  const latest=posts.map(p=>p.publishedAt).filter(Boolean).sort().at(-1)||null;
  return send(200,{
   blog:naver.blog,fetchedAt:naver.fetchedAt,cached:naver.cached,
   summary:{total:posts.length,linked:posts.filter(p=>p.studio).length,unlinked:posts.filter(p=>!p.studio).length,latestAt:latest,studioCompared:records.length>0},
   posts,
   studioOnly:studioOnlyRecords(posts,records)
  });
 }catch(e){
  if(e.status)return send(e.status,{error:e.message});
  console.error('Naver posts request failed',e.name);
  return send(503,{error:'네이버 글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'});
 }
}
