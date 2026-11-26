import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {S3Client} from '@aws-sdk/client-s3';
import {parseNaverRss,logNoOf,matchPostsToRecords,studioOnlyRecords,similarity,loadNaverPosts,resetNaverCache,blogIdFrom,parseBlogProfile,parsePostCounts,fetchNaverStats} from '../lib/naver.mjs';

// 실제 네이버 RSS 와 같은 모양(CDATA 제목·guid·category·tag·pubDate·<img>)을 줄여 만든 샘플
const RSS=`<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:activity="http://activitystrea.ms/spec/1.0/" version="2.0"><channel>
<title><![CDATA[큐레이터 | 법인 변경등기 셀프 가이드]]></title>
<link><![CDATA[https://blog.naver.com/qrator_kr?fromRss=true&trackingCode=rss]]></link>
<image><url><![CDATA[http://blogpfthumb.phinf.naver.net/p.png]]></url><title><![CDATA[이미지 제목]]></title><link><![CDATA[https://blog.naver.com/qrator_kr]]></link></image>
<description><![CDATA[소개]]></description>
<pubDate>Tue, 24 Nov 2026 14:10:48 +0900</pubDate>
<item>
<author>qrator_kr</author><category><![CDATA[등기 가이드]]></category>
<title><![CDATA[이사를 추가로 두려면? 임원 변경 등기, 선임부터 취임 등기까지]]></title>
<link><![CDATA[https://blog.naver.com/qrator_kr/224489694665?fromRss=true&trackingCode=rss]]></link>
<guid>https://blog.naver.com/qrator_kr/224489694665</guid>
<description><![CDATA[안녕하세요, 큐레이터예요.   회사 일이 늘어서\n이사를 한 명 더 선임하려고 하시나요?]]></description>
<img src="https://blogthumb.pstatic.net/MjAy/a.PNG/a_1x1.png?type=s3" />
<pubDate>Tue, 24 Nov 2026 11:31:21 +0900</pubDate>
<tag><![CDATA[사내이사추가,임원변경등기, 취임등기 ,큐레이터]]></tag>
<activity:verb>http://activitystrea.ms/schema/1.0/post</activity:verb>
</item>
<item>
<author>qrator_kr</author><category><![CDATA[인사이트]]></category>
<title><![CDATA[등기부등본 400원 인상, 법인은 뭐가 달라질까? &amp; 정리]]></title>
<link><![CDATA[https://blog.naver.com/qrator_kr/224488571922?fromRss=true]]></link>
<guid>https://blog.naver.com/qrator_kr/224488571922</guid>
<description><![CDATA[인상]]></description>
<pubDate>Mon, 23 Nov 2026 16:28:03 +0900</pubDate>
</item>
<item>
<author>qrator_kr</author><category><![CDATA[등기 가이드]]></category>
<title>상호 변경 시 영문 상호 표기 규칙과 변경 절차 안내</title>
<link>https://blog.naver.com/qrator_kr/224483496468</link>
<guid>https://blog.naver.com/qrator_kr/224483496468</guid>
<description>안내</description>
<pubDate>Thu, 19 Nov 2026 15:28:18 +0900</pubDate>
</item>
<item><title>번호 없는 항목</title><link>https://example.com/x</link><guid>x</guid></item>
</channel></rss>`;

test('RSS 파싱: 글 번호·제목·주소·발행 시각·분류·태그·썸네일·요약을 읽는다',()=>{
 const {blog,posts}=parseNaverRss(RSS,'qrator_kr');
 assert.equal(blog.title,'큐레이터 | 법인 변경등기 셀프 가이드');assert.equal(blog.url,'https://blog.naver.com/qrator_kr');
 assert.equal(blog.updatedAt,'2026-11-24T05:10:48.000Z');
 assert.equal(posts.length,3,'글 번호를 못 구한 항목은 건너뛴다');
 const [first,second,third]=posts;
 assert.equal(first.id,'224489694665');assert.equal(first.url,'https://blog.naver.com/qrator_kr/224489694665','추적용 쿼리를 뗀 깨끗한 주소');
 assert.equal(first.title,'이사를 추가로 두려면? 임원 변경 등기, 선임부터 취임 등기까지');
 assert.equal(first.publishedAt,'2026-11-24T02:31:21.000Z');assert.equal(first.category,'등기 가이드');
 assert.deepEqual(first.tags,['사내이사추가','임원변경등기','취임등기','큐레이터']);
 assert.equal(first.thumbnail,'https://blogthumb.pstatic.net/MjAy/a.PNG/a_1x1.png?type=s3');
 assert.equal(first.excerpt,'안녕하세요, 큐레이터예요. 회사 일이 늘어서 이사를 한 명 더 선임하려고 하시나요?');
 assert.equal(second.title,'등기부등본 400원 인상, 법인은 뭐가 달라질까? & 정리','CDATA 안의 &amp; 도 글자로 풀어서 보여 준다');
 assert.equal(second.thumbnail,'');assert.deepEqual(second.tags,[]);
 assert.equal(third.title,'상호 변경 시 영문 상호 표기 규칙과 변경 절차 안내');
 assert.throws(()=>parseNaverRss('<html>로그인</html>'),/RSS 형식/);
});

test('글 번호는 여러 주소 모양에서 같게 읽는다',()=>{
 for(const value of ['https://blog.naver.com/qrator_kr/224484390077','https://blog.naver.com/qrator_kr/224484390077?fromRss=true','https://m.blog.naver.com/PostView.naver?blogId=qrator_kr&logNo=224484390077','https://blog.naver.com/PostView.naver?blogId=qrator_kr&logNo=224484390077&redirect=Dlog'])assert.equal(logNoOf(value),'224484390077',value);
 assert.equal(logNoOf('https://qrator.kr/blog/foo'),'');assert.equal(logNoOf(''),'');
});

const PROFILE=JSON.stringify({isSuccess:true,result:{blogId:'qrator_kr',dayVisitorCount:17,totalVisitorCount:1457,subscriberCount:2}});
const LIST=JSON.stringify({isSuccess:true,result:{totalCount:0,items:[{logNo:224489694665,commentCnt:3,sympathyCnt:5,readCount:null},{logNo:224488571922,commentCnt:0,sympathyCnt:1}]}});
// 네이버 세 곳(RSS·모바일 프로필·모바일 글 목록)을 흉내 낸다. opts 로 일부를 실패시킬 수 있다.
const naverFake=(opts={})=>{
 const seen=[];
 const fn=async(url,init={})=>{
  const u=String(url);seen.push(u);
  if(u==='https://rss.blog.naver.com/qrator_kr.xml')return {ok:true,status:200,text:async()=>RSS};
  if(u==='https://m.blog.naver.com/api/blogs/qrator_kr'){if(opts.noProfile)return {ok:false,status:403,text:async()=>''};return {ok:true,status:200,text:async()=>PROFILE};}
  if(u.startsWith('https://m.blog.naver.com/api/blogs/qrator_kr/post-list?')){if(opts.noList)return {ok:false,status:403,text:async()=>''};return {ok:true,status:200,text:async()=>LIST};}
  throw new Error('예상 밖 주소 '+u);
 };
 fn.seen=seen;return fn;
};

const POSTS=parseNaverRss(RSS,'qrator_kr').posts;
const rec=(slug,extra={})=>({slug,title:'제목 '+slug,category:'임원 변경',status:'completed',reviewStatus:'pending',sourceUrls:[],note:'',...extra});

test('연결 근거 순서: 출처 주소 > 메모의 네이버 제목 > 같은 제목 > 아주 비슷한 제목, 한 글은 한 번만',()=>{
 const records=[
  rec('by-url',{title:'홈페이지용 전혀 다른 제목',sourceUrls:['https://m.blog.naver.com/PostView.naver?blogId=qrator_kr&logNo=224489694665']}),
  rec('by-note',{title:'등기부등본·법인인감증명서 수수료 인상 안내',note:'원제: 등기부등본 400원 인상, 법인은 뭐가 달라질까? & 정리\n메모'}),
  rec('by-title',{title:'상호 변경 시 영문 상호 표기 규칙과 변경 절차 안내'}),
  rec('unrelated',{title:'목적 변경 시 필요한 서류 안내'}),
  rec('trashed',{title:'이사를 추가로 두려면 임원 변경 등기 선임부터 취임 등기까지',deletedAt:'2026-11-01T00:00:00Z'})
 ];
 const matched=matchPostsToRecords(POSTS,records);
 assert.deepEqual(matched.map(p=>[p.id,p.studio?.slug,p.studio?.by]),[['224489694665','by-url','url'],['224488571922','by-note','note'],['224483496468','by-title','title']]);
 assert.equal(matched[0].studio.title,'홈페이지용 전혀 다른 제목');
 // 같은 제목이라도 이미 다른 글이 먼저 연결했으면 중복 연결하지 않는다
 const twin=matchPostsToRecords(POSTS,[rec('first',{title:'상호 변경 시 영문 상호 표기 규칙과 변경 절차 안내'}),rec('second',{title:'상호 변경 시 영문 상호 표기 규칙과 변경 절차 안내'})]);
 assert.equal(twin[2].studio.slug,'first');assert.equal(twin.filter(p=>p.studio).length,1);
 // 휴지통 글은 연결 대상이 아니다
 assert.equal(matchPostsToRecords(POSTS,[records[4]])[0].studio,null);
});

test('비슷한 제목은 문턱을 넘을 때만 연결한다',()=>{
 const near=rec('near',{title:'상호 변경 시 영문 상호 표기 규칙과 변경 절차'});
 assert.equal(matchPostsToRecords(POSTS,[near])[2].studio?.by,'similar');
 const far=rec('far',{title:'본점 이전 등기 후 사업자등록 변경 절차 안내'});
 assert.equal(matchPostsToRecords(POSTS,[far])[2].studio,null);
 assert.ok(similarity('가나다라','가나다라')===1&&similarity('','가')===0&&similarity('가나다라마','사아자차카')<0.2);
});

test('스튜디오에만 있는 글: 게시 준비가 끝난 글 중 네이버와 연결되지 않은 것만 알려 준다',()=>{
 const records=[
  rec('linked',{title:'상호 변경 시 영문 상호 표기 규칙과 변경 절차 안내'}),
  rec('draft-only',{status:'draft',title:'작성 중인 글'}),
  rec('done-only',{status:'completed',title:'완료했지만 네이버엔 없는 글',updatedAt:'2026-11-20T00:00:00Z'}),
  rec('published-only',{status:'published',title:'게시했지만 네이버엔 없는 글',updatedAt:'2026-11-22T00:00:00Z'}),
  rec('gone',{status:'completed',deletedAt:'2026-11-01T00:00:00Z'})
 ];
 const posts=matchPostsToRecords(POSTS,records);
 assert.deepEqual(studioOnlyRecords(posts,records).map(x=>x.slug),['published-only','done-only']);
});

test('불러오기: 1분 캐시, 새로고침도 10초 안에는 캐시, 네이버 오류는 안내 문구로 바꾼다',async()=>{
 resetNaverCache();let calls=0;
 const fake=naverFake();const ok=async(url,init)=>{if(String(url).includes('rss.blog.naver.com'))calls++;return fake(url,init);};
 const t0=1_700_000_000_000;
 const first=await loadNaverPosts('qrator_kr',{fetchImpl:ok,now:t0});assert.equal(first.cached,false);assert.equal(first.posts.length,3);assert.equal(first.fetchedAt,new Date(t0).toISOString());
 assert.equal((await loadNaverPosts('qrator_kr',{fetchImpl:ok,now:t0+30_000})).cached,true);
 assert.equal((await loadNaverPosts('qrator_kr',{fetchImpl:ok,now:t0+5_000,force:true})).cached,true,'새로고침 연타는 네이버를 다시 부르지 않는다');
 assert.equal((await loadNaverPosts('qrator_kr',{fetchImpl:ok,now:t0+15_000,force:true})).cached,false);
 assert.equal((await loadNaverPosts('qrator_kr',{fetchImpl:ok,now:t0+80_000})).cached,false);
 assert.equal(calls,3);
 resetNaverCache();
 await assert.rejects(()=>loadNaverPosts('qrator_kr',{fetchImpl:async()=>({ok:false,status:503,text:async()=>''})}),e=>e.status===502&&/HTTP 503/.test(e.message));
 await assert.rejects(()=>loadNaverPosts('qrator_kr',{fetchImpl:async()=>{throw Object.assign(new Error('x'),{name:'TimeoutError'});}}),/늦어/);
 await assert.rejects(()=>loadNaverPosts('qrator_kr',{fetchImpl:async()=>{throw new Error('ECONNRESET');}}),/연결하지 못했습니다/);
 await assert.rejects(()=>loadNaverPosts('qrator_kr',{fetchImpl:async()=>({ok:true,status:200,text:async()=>'<html>차단</html>'})}),/RSS 형식/);
 assert.equal(blogIdFrom({}),'qrator_kr');assert.equal(blogIdFrom({NAVER_BLOG_ID:'my-blog_1'}),'my-blog_1');
 assert.throws(()=>blogIdFrom({NAVER_BLOG_ID:'../evil'}),{status:503});
});

test('방문자·댓글·공감: 프로필과 글 목록 JSON 을 읽어 글마다 붙인다(조회수는 없음)',async()=>{
 assert.deepEqual(parseBlogProfile(JSON.parse(PROFILE)),{today:17,total:1457,subscribers:2});
 assert.throws(()=>parseBlogProfile({isSuccess:false}),/방문자/);
 assert.throws(()=>parseBlogProfile({isSuccess:true,result:{}}),/방문자/);
 const parsed=parsePostCounts(JSON.parse(LIST));
 assert.deepEqual([...parsed.items],[['224489694665',{comments:3,likes:5}],['224488571922',{comments:0,likes:1}]]);
 assert.throws(()=>parsePostCounts({isSuccess:true,result:{}}),/글별/);
 resetNaverCache();
 const fake=naverFake();
 const data=await loadNaverPosts('qrator_kr',{fetchImpl:fake,now:1_700_000_000_000});
 assert.deepEqual(data.visitors,{today:17,total:1457,subscribers:2});assert.equal(data.statsError,null);
 const byId=Object.fromEntries(data.posts.map(p=>[p.id,p]));
 assert.deepEqual([byId['224489694665'].comments,byId['224489694665'].likes],[3,5]);
 assert.deepEqual([byId['224488571922'].comments,byId['224488571922'].likes],[0,1]);
 assert.deepEqual([byId['224483496468'].comments,byId['224483496468'].likes],[null,null],'글 목록에 없는 글은 빈칸');
 assert.ok(data.posts.every(p=>!('views' in p)&&!('readCount' in p)),'조회수는 공개되지 않으므로 넣지 않는다');
 assert.equal(fake.seen.filter(u=>u.includes('post-list')).length,1,'한 쪽이 30건보다 적으면 더 부르지 않는다');
 assert.ok(fake.seen.every(u=>u.startsWith('https://')&&!/token|cookie/i.test(u)));
});

test('방문자·댓글·공감을 못 읽어도 글 목록은 그대로 보여 주고 이유만 알린다',async()=>{
 resetNaverCache();
 const noProfile=await loadNaverPosts('qrator_kr',{fetchImpl:naverFake({noProfile:true}),now:1});
 assert.equal(noProfile.posts.length,3);assert.equal(noProfile.visitors,null);assert.match(noProfile.statsError,/방문자 수/);
 assert.equal(noProfile.posts[0].comments,3);
 resetNaverCache();
 const noList=await loadNaverPosts('qrator_kr',{fetchImpl:naverFake({noList:true}),now:1});
 assert.equal(noList.visitors.total,1457);assert.match(noList.statsError,/댓글·공감/);assert.equal(noList.posts[0].comments,null);
 resetNaverCache();
 const both=await fetchNaverStats('qrator_kr',{fetchImpl:async()=>{throw new Error('boom');}});
 assert.deepEqual([both.visitors,both.counts],[null,null]);assert.match(both.error,/방문자 수·글별/);
 // 글 목록(RSS) 자체를 못 읽으면 지금처럼 오류
 await assert.rejects(()=>loadNaverPosts('qrator_kr',{fetchImpl:async url=>String(url).includes('rss')?{ok:false,status:503,text:async()=>''}:naverFake()(url),now:1}),e=>e.status===502);
 resetNaverCache();
});

test('글 목록이 30건이면 다음 쪽도 읽는다(최대 4쪽)',async()=>{
 const page=n=>JSON.stringify({isSuccess:true,result:{items:Array.from({length:30},(_,i)=>({logNo:224400000000+n*100+i,commentCnt:1,sympathyCnt:0}))}});
 const urls=[];
 const fetchImpl=async url=>{const u=String(url);urls.push(u);if(u.includes('post-list')){const n=Number(u.match(/page=(\d+)/)[1]);return {ok:true,status:200,text:async()=>page(n)};}return {ok:true,status:200,text:async()=>PROFILE};};
 const stats=await fetchNaverStats('qrator_kr',{fetchImpl});
 assert.equal(urls.filter(u=>u.includes('post-list')).length,4);assert.equal(stats.counts.size,120);
});

// ── API ──
const env={STUDIO_PASSWORD:'test-password-123456789',SESSION_SECRET:'x'.repeat(40),AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket',APP_ORIGIN:'https://studio.example'};
Object.assign(process.env,env);
const store=new Map();
S3Client.prototype.send=async function(command){
 const p=command.input;
 switch(command.constructor.name){
  case 'GetObjectCommand':{const r=store.get(p.Key);if(!r)throw Object.assign(new Error(),{name:'NoSuchKey'});return {ETag:'e',Body:{transformToString:async()=>r.body}};}
  case 'ListObjectsV2Command':return {Contents:[...store.keys()].filter(k=>k.startsWith(p.Prefix)).map(Key=>({Key}))};
  default:throw new Error(command.constructor.name);
 }
};
const {session}=await import('../lib/core.mjs');
const {default:naverApi}=await import('../api/naver-posts.js');
const mkRes=()=>({headers:{},statusCode:0,body:undefined,setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(d){this.body=d;return this;}});
const call=async({method='GET',cookie=true,query={}}={})=>{const res=mkRes();await naverApi({method,query,headers:{cookie:cookie?'studio_session='+session(env):''}},res);return res;};
const put=r=>store.set('studio/records/'+r.slug+'.json',{body:JSON.stringify({...r,html:'',assets:[]})});

test('API: 로그인한 팀원에게만, 네이버 글과 스튜디오 글을 맞춘 결과를 준다',async()=>{
 store.clear();resetNaverCache();
 put(rec('linked-post',{title:'홈페이지용 제목',sourceUrls:['https://blog.naver.com/qrator_kr/224489694665']}));
 put(rec('only-home',{status:'published',title:'네이버에 없는 글',updatedAt:'2026-11-21T00:00:00Z'}));
 const realFetch=globalThis.fetch;let hits=0;
 const fake=naverFake();globalThis.fetch=async(url,init)=>{if(/rss\.blog\.naver\.com/.test(String(url)))hits++;return fake(url,init);};
 try{
  assert.equal((await call({cookie:false})).statusCode,401);
  assert.equal(hits,0,'로그인 전에는 네이버에 요청하지 않는다');
  assert.equal((await call({method:'POST'})).statusCode,405);
  const res=await call();assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(res.headers['Cache-Control'],'private, no-store');
  assert.deepEqual(res.body.summary,{total:3,linked:1,unlinked:2,latestAt:'2026-11-24T02:31:21.000Z',studioCompared:true});
  assert.equal(res.body.posts[0].studio.slug,'linked-post');assert.equal(res.body.posts[1].studio,null);
  assert.deepEqual(res.body.studioOnly.map(x=>x.slug),['only-home']);
  assert.equal(res.body.blog.id,'qrator_kr');assert.ok(res.body.fetchedAt);
  assert.deepEqual(res.body.visitors,{today:17,total:1457,subscribers:2});assert.equal(res.body.statsError,null);
  assert.deepEqual([res.body.posts[0].comments,res.body.posts[0].likes],[3,5]);
  assert.equal((await call()).body.cached,true);assert.equal(hits,1);
  // 네이버가 막혔을 때: 502 와 이유
  resetNaverCache();globalThis.fetch=async()=>({ok:false,status:403,text:async()=>''});
  const bad=await call();assert.equal(bad.statusCode,502);assert.match(bad.body.error,/HTTP 403/);
 }finally{globalThis.fetch=realFetch;resetNaverCache();}
});

test('화면: 사이드 메뉴·목록·연결 열기가 갖춰져 있다',async()=>{
 const ui=await readFile(new URL('../public/automation-ui.mjs',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.match(html,/id="navNaver"[^>]*>.*네이버 게시 현황/);
 assert.match(ui,/id="naverPostsView"/);assert.match(ui,/\/api\/naver-posts/);
 assert.match(ui,/naver:\$\('naverPostsView'\)/);assert.match(ui,/if\(name==='naver'\)loadNaverPosts\(\)/);
 assert.match(ui,/navs\.naver\.hidden=activeProject!=='qrator'/,'HomeQ 작업 공간에서는 숨긴다');
 assert.match(ui,/data-open-studio/);assert.match(ui,/qrator:open-record/);assert.match(app,/qrator:open-record/);
 assert.match(ui,/rel="noopener noreferrer"/,'네이버 글 링크는 새 창, 오프너 차단');
 assert.match(ui,/연결 안 된 글만 보기/);
 assert.match(ui,/id="naverVisitToday"/);assert.match(ui,/id="naverVisitTotal"/);assert.match(ui,/<th>댓글<\/th><th>공감<\/th>/);assert.match(ui,/post\.comments==null/);
});
