// 네이버 블로그에 실제로 올라가 있는 글을 공개 RSS(https://rss.blog.naver.com/{블로그ID}.xml)로 읽어
// 스튜디오 글과 맞춰 보는 기능. 로그인·API 키가 필요 없고, 공개된 최근 글(약 30~40건)만 보인다.
// 비공개 글·임시저장 글은 RSS 에 나오지 않는다.
export const DEFAULT_BLOG_ID='qrator_kr';
const RSS_TIMEOUT_MS=8000;
const MAX_RSS_BYTES=2_000_000;

export function blogIdFrom(env={}){
 const id=String(env.NAVER_BLOG_ID||DEFAULT_BLOG_ID).trim();
 if(!/^[A-Za-z0-9_-]{3,40}$/.test(id))throw Object.assign(new Error('NAVER_BLOG_ID 값을 확인해 주세요.'),{status:503});
 return id;
}

const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function decodeEntities(text){
 return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(whole,code)=>{
  if(code[0]==='#'){const point=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);try{return String.fromCodePoint(point);}catch{return whole;}}
  return ENTITIES[code.toLowerCase()]??whole;
 });
}
function tagText(block,name){
 const match=block.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'));
 if(!match)return '';
 const cdata=match[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
 // 네이버는 제목의 & " < 같은 글자를 CDATA 안에서도 &amp; &quot; 로 적어 보내므로 어느 쪽이든 풀어서 읽는다.
 return decodeEntities(cdata?cdata[1]:match[1]).trim();
}

export function logNoOf(value){
 const text=String(value||'');
 const match=text.match(/[?&]logNo=(\d{6,})/i)||text.match(/blog\.naver\.com\/[^/?#\s]+\/(\d{6,})/i)||text.match(/(?:^|\/)(\d{9,})(?:[?#/]|$)/);
 return match?match[1]:'';
}

// RSS 문자열 → {blog, posts[]}. 글마다 id(logNo)·제목·주소·발행시각·분류·태그·대표 이미지·요약.
export function parseNaverRss(xml,blogId=DEFAULT_BLOG_ID){
 const source=String(xml||'');
 if(!/<rss[\s>]/i.test(source)||!/<channel[\s>]/i.test(source))throw Object.assign(new Error('네이버 RSS 형식이 아닙니다.'),{status:502});
 const firstItem=source.search(/<item[\s>]/i);
 const head=source.slice(0,firstItem<0?source.length:firstItem);
 const posts=[];
 for(const match of source.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)){
  const block=match[1];
  const link=tagText(block,'link'),guid=tagText(block,'guid');
  const id=logNoOf(guid)||logNoOf(link);
  if(!id)continue;
  const published=Date.parse(tagText(block,'pubDate'));
  const image=(block.match(/<img\s[^>]*src="([^"]+)"/i)||[])[1]||'';
  posts.push({
   id,
   title:tagText(block,'title'),
   url:'https://blog.naver.com/'+blogId+'/'+id,
   publishedAt:Number.isFinite(published)?new Date(published).toISOString():null,
   category:tagText(block,'category'),
   tags:tagText(block,'tag').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30),
   thumbnail:/^https:\/\//i.test(decodeEntities(image))?decodeEntities(image):'',
   excerpt:tagText(block,'description').replace(/\s+/g,' ').slice(0,160)
  });
 }
 return {blog:{id:blogId,title:tagText(head,'title'),url:'https://blog.naver.com/'+blogId,updatedAt:Number.isFinite(Date.parse(tagText(head,'pubDate')))?new Date(tagText(head,'pubDate')).toISOString():null},posts};
}

export async function fetchNaverRss(blogId,{fetchImpl=fetch}={}){
 let response;
 try{
  response=await fetchImpl('https://rss.blog.naver.com/'+encodeURIComponent(blogId)+'.xml',{headers:{'User-Agent':'Mozilla/5.0 (compatible; QratorContentStudio/1.0)',Accept:'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(RSS_TIMEOUT_MS),redirect:'follow'});
 }catch(e){
  throw Object.assign(new Error(e?.name==='TimeoutError'?'네이버 응답이 늦어 글 목록을 불러오지 못했습니다.':'네이버 블로그에 연결하지 못했습니다.'),{status:502});
 }
 if(!response.ok)throw Object.assign(new Error('네이버 블로그가 글 목록을 내려주지 않았습니다. (HTTP '+response.status+')'),{status:502});
 const text=await response.text();
 if(text.length>MAX_RSS_BYTES)throw Object.assign(new Error('네이버 글 목록이 예상보다 큽니다.'),{status:502});
 return parseNaverRss(text,blogId);
}

// ── 스튜디오 글과 맞추기 ──
const normalize=value=>String(value||'').toLowerCase().replace(/[\s​]+/g,'').replace(/[^\p{L}\p{N}]/gu,'');
function bigrams(text){const set=new Map();for(let i=0;i<text.length-1;i++){const gram=text.slice(i,i+2);set.set(gram,(set.get(gram)||0)+1);}return set;}
export function similarity(a,b){
 const x=normalize(a),y=normalize(b);
 if(!x||!y)return 0;if(x===y)return 1;
 const gx=bigrams(x),gy=bigrams(y);let overlap=0;
 for(const [gram,count] of gx)overlap+=Math.min(count,gy.get(gram)||0);
 return (2*overlap)/(Math.max(x.length-1,0)+Math.max(y.length-1,0)||1);
}

// 연결 근거: ① 출처·메모에 네이버 글 번호나 주소가 있음(url) ② 메모에 네이버 제목이 적혀 있음(note) ③ 제목이 같음(title) ④ 제목이 매우 비슷함(similar)
export function matchPostsToRecords(posts,records,{threshold=0.82}={}){
 const live=(records||[]).filter(r=>r&&!r.deletedAt);
 const idsOf=r=>new Set([...(r.sourceUrls||[]),r.note||''].flatMap(text=>[...String(text).matchAll(/(?:logNo=|blog\.naver\.com\/[^/\s?#]+\/)(\d{6,})/gi)].map(m=>m[1])));
 const linkIds=new Map(live.map(r=>[r.slug,idsOf(r)]));
 const used=new Set();
 const pick=(post,by,test)=>{const found=live.find(r=>!used.has(r.slug)&&test(r));if(!found)return null;used.add(found.slug);return {record:found,by};};
 const result=new Map();
 // 1·2순위는 근거가 확실하므로 먼저 전부 연결하고, 제목 비교는 남은 글끼리만 한다.
 for(const post of posts){
  const hit=pick(post,'url',r=>linkIds.get(r.slug).has(post.id))||pick(post,'note',r=>normalize(post.title).length>=8&&normalize(r.note).includes(normalize(post.title)));
  if(hit)result.set(post.id,hit);
 }
 for(const post of posts){
  if(result.has(post.id))continue;
  const hit=pick(post,'title',r=>normalize(r.title)===normalize(post.title));
  if(hit)result.set(post.id,hit);
 }
 for(const post of posts){
  if(result.has(post.id))continue;
  let best=null,score=0;
  for(const r of live){if(used.has(r.slug))continue;const value=similarity(post.title,r.title);if(value>score){score=value;best=r;}}
  if(best&&score>=threshold){used.add(best.slug);result.set(post.id,{record:best,by:'similar'});}
 }
 return posts.map(post=>{
  const hit=result.get(post.id);
  return {...post,studio:hit?{slug:hit.record.slug,title:hit.record.title,status:hit.record.status,reviewStatus:hit.record.reviewStatus||'pending',by:hit.by}:null};
 });
}

// 스튜디오 글 중 네이버에서 찾지 못한 글(게시 준비가 끝났거나 게시된 글만).
export function studioOnlyRecords(posts,records){
 const linked=new Set(posts.filter(p=>p.studio).map(p=>p.studio.slug));
 return (records||[]).filter(r=>r&&!r.deletedAt&&['completed','published','delivered','scheduled'].includes(r.status)&&!linked.has(r.slug))
  .map(r=>({slug:r.slug,title:r.title,category:r.category,status:r.status,updatedAt:r.updatedAt}))
  .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}

const CACHE_MS=60_000;
const FORCE_MIN_MS=10_000;
let cache=null;
export function resetNaverCache(){cache=null;}
// 같은 서버 인스턴스에서는 1분간 결과를 재사용한다. '새로고침'(force)도 10초 안에 또 누르면 저장된 결과를 쓴다(네이버에 부담을 주지 않기 위해).
export async function loadNaverPosts(blogId,{force=false,fetchImpl=fetch,now=Date.now()}={}){
 const age=cache&&cache.blogId===blogId?now-cache.at:Infinity;
 if(age<(force?FORCE_MIN_MS:CACHE_MS))return {...cache.data,cached:true};
 const data=await fetchNaverRss(blogId,{fetchImpl});
 const result={...data,fetchedAt:new Date(now).toISOString()};
 cache={blogId,at:now,data:result};
 return {...result,cached:false};
}
