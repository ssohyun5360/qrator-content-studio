import {CATEGORIES,STATUS,REVIEW_STATUS,normalizeStatus,statusLabel,esc,slugify,metadataFromHTML,suggestTags,readArchive,previewHTML,editedHTML,exportFolder,mime} from '/client-helpers.mjs';
const $=id=>document.getElementById(id);
const state={items:[],filtered:[],selected:new Set(),page:1,user:{name:'공용 관리자'},current:null,mode:'visual',dirty:false,editorReady:false};
const clone=x=>JSON.parse(JSON.stringify(x));
let toastTimer,autosaveTimer;const LOCAL_DRAFT_KEY='qrator-content-studio:autosave';
function showLogin(){ $('workspace').hidden=true;$('loginView').hidden=false; }
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function api(op,body,params={}){
 const url=new URL('/api/studio',location.origin);url.searchParams.set('op',op);for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);
 if(body&&new TextEncoder().encode(JSON.stringify(body)).length>3010000)throw new Error('글 한 편의 전송 용량이 3MB를 넘습니다. 이미지 크기를 줄여 주세요.');
 const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 let result;try{result=await response.json();}catch{throw new Error('서버 응답을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.');}
 if(!response.ok){if(response.status===401&&op!=='login')showLogin();const error=new Error(result.error||'요청 처리에 실패했습니다.');error.status=response.status;throw error;}return result;
}
function showWorkspace(){$('loginView').hidden=true;$('workspace').hidden=false;$('userName').textContent=state.user.name;}
const kstDate=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'';
const dateTime=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'-';
const toInput=value=>value?new Date(new Date(value).getTime()+9*3600000).toISOString().slice(0,16):'';
function markDirty(){state.dirty=true;$('saveState').textContent='변경사항 있음 · 저장 필요';clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{try{localStorage.setItem(LOCAL_DRAFT_KEY,JSON.stringify({savedAt:new Date().toISOString(),record:recordFromForm(),expectedRevision:state.current.revision||null}));$('saveState').textContent='임시 저장됨 · 사이트 저장 필요';}catch{$('saveState').textContent='임시 저장 실패';}},1000);}
function syncSelects(){
 for(const id of ['categoryFilter','editCategory']){const selected=$(id).value;$(id).innerHTML=(id==='categoryFilter'?'<option value="">카테고리 전체</option>':'')+CATEGORIES.map(x=>'<option>'+esc(x)+'</option>').join('');$(id).value=selected|| (id==='editCategory'?CATEGORIES[0]:'');}
 for(const id of ['statusFilter','editStatus']){const selected=$(id).value;$(id).innerHTML=(id==='statusFilter'?'<option value="">게시 상태 전체</option>':'')+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');$(id).value=selected||(id==='editStatus'?'draft':'');}
 const selected=$('tagFilter').value;$('tagFilter').innerHTML='<option value="">태그 전체</option>'+[...new Set(state.items.flatMap(x=>x.tags))].sort().map(x=>'<option>'+esc(x)+'</option>').join('');$('tagFilter').value=selected;
 const reviewSelected=$('reviewFilter').value;$('reviewFilter').innerHTML='<option value="">검토 상태 전체</option>'+Object.entries(REVIEW_STATUS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');$('reviewFilter').value=reviewSelected;
}
async function loadItems(){
 $('rows').innerHTML='<tr><td colspan="12" class="empty">콘텐츠를 불러오는 중입니다.</td></tr>';
 try{const result=await api('list');state.items=result.items.map(x=>({...x,status:normalizeStatus(x.status)}));syncSelects();applyFilters();}catch(e){$('rows').innerHTML='<tr><td colspan="12" class="empty">'+esc(e.message)+'</td></tr>';$('totalCount').textContent='불러오기 실패';throw e;}
}
function applyFilters(){
 const field=$('searchField').value,query=$('search').value.trim().toLowerCase(),category=$('categoryFilter').value,status=$('statusFilter').value,review=$('reviewFilter').value,tag=$('tagFilter').value,from=$('dateFrom').value,to=$('dateTo').value,dateField=$('dateField').value;
 if(from&&to&&from>to){toast('시작일과 종료일을 확인해 주세요.');return;}
 state.filtered=state.items.filter(x=>(!query||String(x[field]||'').toLowerCase().includes(query))&&(!category||x.category===category)&&(!status||x.status===status)&&(!review||(x.reviewStatus||'pending')===review)&&(!tag||x.tags.includes(tag))&&(!from||kstDate(x[dateField])>=from)&&(!to||kstDate(x[dateField])<=to));
 const sort=$('sort').value;state.filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'ko'):b[sort].localeCompare(a[sort]));state.page=1;renderList();
}
function renderList(){
 const count=state.filtered.length,size=Number($('pageSize').value),pages=Math.max(1,Math.ceil(count/size));state.page=Math.min(state.page,pages);
 const visible=state.filtered.slice((state.page-1)*size,state.page*size);
 const scheduled=state.items.filter(x=>x.status==='scheduled').length,completed=state.items.filter(x=>x.status==='completed').length,published=state.items.filter(x=>x.status==='published').length;
 $('totalCount').textContent='총 '+count+'건  |  게시 예정 '+scheduled+' · 작성 완료 '+completed+' · 게시 완료 '+published;
 $('rows').innerHTML=visible.length?visible.map((r,i)=>'<tr><td><input type="checkbox" class="row-check" data-slug="'+esc(r.slug)+'" aria-label="'+esc(r.title)+' 선택" '+(state.selected.has(r.slug)?'checked':'')+'></td><td>'+(count-(state.page-1)*size-i)+'</td><td>'+(r.thumbnailPath?'<img class="thumb-image" loading="lazy" src="/api/studio?op=thumbnail&slug='+encodeURIComponent(r.slug)+'&path='+encodeURIComponent(r.thumbnailPath)+'" alt="'+esc(r.title)+' 대표 이미지">':'<span class="thumb">'+esc(r.category)+'<br>등기 가이드</span>')+'</td><td>'+esc(r.category.replace(' 변경','').replace(' 이전',''))+'</td><td><button class="article-title" data-open="'+esc(r.slug)+'">'+esc(r.title)+'</button><div class="small muted">'+esc(r.slug)+'</div></td><td>'+r.tags.slice(0,3).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</td><td><span class="badge review-'+esc(r.reviewStatus||'pending')+'">'+(REVIEW_STATUS[r.reviewStatus||'pending']||'검토 전')+'</span></td><td><span class="badge '+esc(r.status)+'">'+STATUS[r.status]+'</span></td><td>'+(r.history?.length?'<span style="color:#3866c8">있음</span>':'-')+'</td><td>'+dateTime(r.scheduledAt)+'</td><td>'+dateTime(r.updatedAt)+'</td><td>'+esc(r.updatedBy||r.author)+'</td><td><button data-open="'+esc(r.slug)+'">상세</button></td></tr>').join(''):'<tr><td colspan="13" class="empty">조건에 맞는 콘텐츠가 없습니다.</td></tr>';
 $('selectedCount').textContent=state.selected.size+'건 선택';
 $('selectedActions').hidden=state.selected.size===0;
 if($('deleteSelected'))$('deleteSelected').disabled=deletingSelected||state.selected.size===0;
 $('selectAll').checked=visible.length>0&&visible.every(x=>state.selected.has(x.slug));
 $('selectAll').indeterminate=visible.some(x=>state.selected.has(x.slug))&&!$('selectAll').checked;
 $('pagination').innerHTML='<button data-page="'+(state.page-1)+'" '+(state.page===1?'disabled':'')+' aria-label="이전 페이지">‹</button>'+Array.from({length:pages},(_,i)=>i+1).filter(p=>Math.abs(p-state.page)<3||p===1||p===pages).map(p=>'<button data-page="'+p+'" class="'+(p===state.page?'current':'')+'">'+p+'</button>').join('')+'<button data-page="'+(state.page+1)+'" '+(state.page===pages?'disabled':'')+' aria-label="다음 페이지">›</button>';
}
function ensureLeave(){return !state.dirty||confirm('저장하지 않은 변경사항이 있습니다. 목록으로 이동하시겠습니까?');}
async function showList(){if(!ensureLeave())return;state.dirty=false;$('editorView').hidden=true;$('listView').hidden=false;await loadItems();}
const starterHTML=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>등기 가이드 | 큐레이터</title><meta name="description" content="등기 가이드 설명을 입력해 주세요"><meta property="og:type" content="article"><meta name="qrator-template" content="guide-v1"><style>@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
#qrator-blog{--qb-blue:#1e4bb6;--qb-ink:#1e1e22;--qb-text:#404040;--qb-muted:#737780;--qb-line:#e8e8eb;box-sizing:border-box;width:100%;max-width:788px;margin:0 auto;padding:48px 24px 80px;background:#fff;color:var(--qb-text);font:400 17px/1.6 "Qrator Pretendard",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;letter-spacing:-.02em;overflow-wrap:break-word}
#qrator-blog *,#qrator-blog *::before,#qrator-blog *::after{box-sizing:border-box}
#qrator-blog h1,#qrator-blog h2,#qrator-blog h3,#qrator-blog p,#qrator-blog figure{margin:0}
#qrator-blog a{color:var(--qb-blue);text-decoration:none;text-underline-offset:4px}
#qrator-blog a:hover{text-decoration:underline}
#qrator-blog a:focus-visible,#qrator-blog summary:focus-visible{outline:2px solid var(--qb-blue);outline-offset:5px}
#qrator-blog strong,#qrator-blog b{font-weight:700}
#qrator-blog .qbx-back{display:inline-flex;align-items:center;min-height:44px;gap:8px;margin-bottom:12px;font-size:15px;font-weight:600}
#qrator-blog .qbx-back span{color:#969ba5;font-weight:400}
#qrator-blog h1{font-size:32px;line-height:1.4;font-weight:700;letter-spacing:-.035em;word-break:keep-all}
#qrator-blog .subhead{margin-top:12px;color:#62666e;font-size:17px;line-height:1.6;word-break:keep-all}
#qrator-blog .qbe-author{display:flex;align-items:center;gap:12px;margin-top:24px;padding-bottom:22px;border-bottom:1px solid var(--qb-line);font-size:14px;line-height:1.6}
#qrator-blog .qbe-avatar{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:50%;background:#edf2ff;color:var(--qb-blue);font-size:24px;font-weight:750}
#qrator-blog .qbe-author time{display:block;color:var(--qb-muted);font-size:13px;margin-top:2px}
#qrator-blog .qbe-cover{margin:20px 0 28px}
#qrator-blog .qbe-cover img{display:block;width:100%;height:auto}
#qrator-blog .qbe-intro p+ p{margin-top:16px}
#qrator-blog .article-section{margin-top:60px;scroll-margin-top:24px}
#qrator-blog h2{font-size:32px;line-height:1.5;font-weight:600;letter-spacing:-.035em;color:var(--qb-ink);word-break:keep-all;margin-bottom:16px}
#qrator-blog h3{font-size:21px;font-weight:650;line-height:1.5;color:var(--qb-ink);margin:28px 0 10px;word-break:keep-all}
#qrator-blog .article-section p+ p{margin-top:14px}
#qrator-blog .article-section ul,#qrator-blog .article-section ol{margin:18px 0;padding-left:25px}
#qrator-blog .article-section li{padding-left:3px;margin-top:8px}
#qrator-blog .article-section li:first-child{margin-top:0}
#qrator-blog .qbv-flow li{padding-left:5px;margin-top:14px}
#qrator-blog .qbv-flow li::marker{font-weight:700;color:var(--qb-blue)}
#qrator-blog .qbv-flow li strong{color:var(--qb-ink)}
#qrator-blog .qbv-flow li span{display:block;margin-top:3px}
#qrator-blog .note{margin:24px 0;padding:18px 22px;border-left:3px solid var(--qb-blue);background:#f6f8fc;font-size:16px;line-height:1.75}
#qrator-blog .note strong{color:#284b92}
#qrator-blog .source{font-size:13px;line-height:1.7;color:var(--qb-muted);margin-top:18px!important}
#qrator-blog .source a{color:var(--qb-muted);text-decoration:underline}
#qrator-blog .qbx-vote{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;margin:24px 0;padding:24px 20px;border-top:1px solid var(--qb-line);border-bottom:1px solid var(--qb-line);text-align:center}
#qrator-blog .qbx-vote strong{display:block;font-size:32px;line-height:1.4;color:var(--qb-blue)}
#qrator-blog .qbx-vote span{display:block;font-size:15px;margin-top:6px}
#qrator-blog .qbx-vote>b{font-size:14px;font-weight:400;color:var(--qb-muted)}
#qrator-blog .table-wrap{margin:22px 0}
#qrator-blog table{width:100%;border-collapse:collapse;table-layout:fixed;text-align:left;font-size:16px;line-height:1.7}
#qrator-blog th,#qrator-blog td{padding:14px 16px;border:1px solid #dedfe3;vertical-align:top;overflow-wrap:anywhere}
#qrator-blog thead th{background:#f6f7f9;color:var(--qb-ink);font-weight:600}
#qrator-blog th:first-child{width:28%}
#qrator-blog tbody th{font-weight:600}
#qrator-blog .qbv-faq{margin-top:60px}
#qrator-blog .qbv-faq details{border-bottom:1px solid var(--qb-line);padding:20px 0}
#qrator-blog .qbv-faq summary{position:relative;display:flex;align-items:center;min-height:30px;list-style:none;padding-right:32px;font-size:18px;font-weight:600;color:var(--qb-ink);cursor:pointer}
#qrator-blog .qbv-faq summary::-webkit-details-marker{display:none}
#qrator-blog .qbv-faq summary::after{content:"+";position:absolute;right:4px;font-size:24px;color:var(--qb-muted);font-weight:400}
#qrator-blog .qbv-faq details[open] summary::after{content:"−"}
#qrator-blog .qbv-faq details p{margin-top:12px;line-height:1.7}
#qrator-blog .qbv-bridge{margin:60px 0 24px}
#qrator-blog .qbv-bridge p+ p{margin-top:14px}
#qrator-blog .qbv-promo{padding:32px;background:#f3f6fd;border:1px solid #e4eaf7;border-radius:4px}
#qrator-blog .qbv-brand{display:block;width:99px;height:auto;margin-bottom:22px}
#qrator-blog .qbv-promo h3{font-size:23px;margin:0 0 12px}
#qrator-blog .qbv-promo p{font-size:16px;line-height:1.75}
#qrator-blog .qbv-service-steps{display:flex;flex-wrap:wrap;gap:8px 26px;margin:20px 0 24px;padding-left:20px;font-size:14px}
#qrator-blog .qbv-apply{display:inline-flex;align-items:center;justify-content:center;gap:28px;min-height:48px;padding:12px 24px;background:var(--qb-blue);color:#fff;border-radius:4px;font-size:16px;font-weight:600}
#qrator-blog .qbv-apply:hover{background:#173d96;text-decoration:none}
#qrator-blog .qbv-sources{border-top:1px solid var(--qb-line);margin-top:40px;padding-top:24px;font-size:13px;line-height:1.8;color:var(--qb-muted)}
#qrator-blog .qbv-sources details{margin-top:14px}
#qrator-blog .qbv-sources summary{cursor:pointer;min-height:36px;padding:6px 0;color:#555b66}
#qrator-blog .qbv-sources ul{padding-left:20px;margin:8px 0}
#qrator-blog .qbv-sources li{margin-top:5px}
#qrator-blog .qbv-sources a{color:#626a79;text-decoration:underline}
#qrator-blog .qbv-disclosure h2{font-size:15px;line-height:1.6;font-weight:600;margin:0 0 10px;color:#555b66}
#qrator-blog .qbv-disclosure p{line-height:1.9}
#qrator-blog .qbv-disclosure .qbv-revision{margin-top:10px;font-size:12px}
@media(max-width:600px){#qrator-blog{padding:24px 20px 48px;font-size:16px;line-height:1.7}#qrator-blog h1{font-size:28px}#qrator-blog h2{font-size:25px;line-height:1.5}#qrator-blog h3{font-size:20px}#qrator-blog .subhead{font-size:16px}#qrator-blog .article-section,#qrator-blog .qbv-faq{margin-top:44px}#qrator-blog .qbv-bridge{margin-top:44px}#qrator-blog .note{padding:16px;font-size:15px}#qrator-blog .qbx-vote{gap:10px;padding:20px 0}#qrator-blog .qbx-vote strong{font-size:27px}#qrator-blog .qbx-vote span{font-size:13px}#qrator-blog table{font-size:14px}#qrator-blog th,#qrator-blog td{padding:12px 10px}#qrator-blog th:first-child{width:30%}#qrator-blog .qbv-faq summary{font-size:17px}#qrator-blog .qbv-promo{padding:24px 20px}#qrator-blog .qbv-apply{display:flex;width:100%}#qrator-blog .qbv-service-steps{display:block}#qrator-blog .qbv-service-steps li+li{margin-top:6px}}
@media print{#qrator-blog{max-width:none;padding:0}#qrator-blog .qbx-back,#qrator-blog .qbe-cover,#qrator-blog .qbv-apply{display:none}#qrator-blog .article-section{margin-top:28px}#qrator-blog h2,#qrator-blog h3{break-after:avoid}#qrator-blog .note,#qrator-blog .qbx-vote,#qrator-blog .qbv-promo{break-inside:avoid}#qrator-blog details::details-content{display:block}#qrator-blog .qbv-faq details p{display:block}}

/* Compact, optional in-article navigation. No JavaScript required. */
#qrator-blog .qbv-toc{margin:28px 0 0;padding:22px 24px;border:1px solid #e4eaf7;border-radius:4px;background:#f6f8fc}
#qrator-blog .qbv-toc h2{margin:0 0 10px;font-size:18px;line-height:1.5;font-weight:650;letter-spacing:-.02em}
#qrator-blog .qbv-toc ol{margin:0;padding-left:23px;font-size:16px;line-height:1.6}
#qrator-blog .qbv-toc li{padding-left:2px;color:#6c7791}
#qrator-blog .qbv-toc li+li{margin-top:3px}
#qrator-blog .qbv-toc a{display:inline-block;padding:5px 0;font-weight:500}
@media(max-width:600px){#qrator-blog .qbv-toc{margin-top:24px;padding:18px 20px}#qrator-blog .qbv-toc ol{font-size:15px}#qrator-blog .qbv-toc a{padding:4px 0}}
@media print{#qrator-blog .qbv-toc{display:none}}

/* Summary and verified product-screen example. */
#qrator-blog .qbv-summary{margin:28px 0 0;padding:20px 24px;border:1px solid #e4eaf7;border-left:3px solid var(--qb-blue);border-radius:4px;background:#f6f8fc}
#qrator-blog .qbv-summary h2{margin:0 0 12px;font-size:18px;line-height:1.5;font-weight:650;letter-spacing:-.02em}
#qrator-blog .qbv-summary ul{margin:0;padding-left:20px;font-size:16px;line-height:1.65}
#qrator-blog .qbv-summary li+li{margin-top:8px}
#qrator-blog .qbv-summary li::marker{color:var(--qb-blue)}
#qrator-blog .qbv-check-steps{margin:18px 0 24px;padding-left:22px;font-size:16px;line-height:1.75}
#qrator-blog .qbv-check-steps li+li{margin-top:6px}
#qrator-blog .qbv-service-screen{margin:24px 0}
#qrator-blog .qbv-service-screen a{display:block}
#qrator-blog .qbv-service-screen img{display:block;width:100%;height:auto;background:#fff;border:1px solid #dedfe3;border-radius:4px}
#qrator-blog .qbv-service-screen figcaption{margin-top:10px;color:var(--qb-muted);font-size:13px;line-height:1.6}
#qrator-blog .qbv-service-screen+p{margin-bottom:24px}
@media(max-width:600px){#qrator-blog .qbv-summary{margin-top:24px;padding:18px 20px}#qrator-blog .qbv-summary ul{font-size:15px}#qrator-blog .qbv-check-steps{font-size:15px}}
#qrator-blog .qbe-cover-placeholder{display:grid;place-items:center;aspect-ratio:1256/760;border:1px dashed #cfd5df;background:#f6f8fc;color:#737780;text-align:center;padding:24px}#qrator-blog .qbe-cover-placeholder p{font-size:15px;line-height:1.7}</style></head><body style="margin:0;background:#fff">
<article id="qrator-blog" aria-labelledby="qbv-title">
<header><a class="qbx-back" href="./index.html"><span>블로그</span><span aria-hidden="true">›</span><span data-template-category>상호 변경</span></a>
<h1 id="qbv-title">새 등기 가이드 제목</h1><p class="subhead">이 글에서 안내할 내용을 한두 문장으로 소개해 주세요.</p>
<div class="qbe-author"><span class="qbe-avatar" aria-hidden="true">Q.</span><div><span>작성자 </span><strong>큐레이터</strong><time>작성일 입력</time></div></div></header>
<figure class="qbe-cover"><div class="qbe-cover-placeholder" data-studio-cover-placeholder="true"><p>대표 이미지 영역<br>화면 편집에서 이미지 버튼으로 삽입해 주세요.</p></div></figure>
<div class="qbe-intro"><p>독자가 겪는 상황이나 궁금증을 짧게 꺼내고, 이 글에서 확인할 내용을 자연스럽게 소개해 주세요.</p></div>
<aside class="qbv-summary" aria-labelledby="qbv-summary-title"><h2 id="qbv-summary-title">세 줄 요약</h2><ul><li>첫 번째 핵심 내용을 한 문장으로 정리해 주세요.</li><li>두 번째로 알아둘 기준이나 예외를 정리해 주세요.</li><li>마지막으로 독자가 준비하거나 확인할 내용을 정리해 주세요.</li></ul></aside>
<nav class="qbv-toc" aria-labelledby="qbv-toc-title"><h2 id="qbv-toc-title">이 글의 목차</h2><ol><li><a href="#qbv-section-1">첫 번째 확인 항목</a></li><li><a href="#qbv-section-2">두 번째 확인 항목</a></li><li><a href="#qbv-section-3">준비 서류와 절차</a></li><li><a href="#qbv-section-4">기한과 비용</a></li><li><a href="#qbv-faq">자주 묻는 질문</a></li></ol></nav>
<section class="article-section" id="qbv-section-1" aria-labelledby="heading-1"><h2 id="heading-1">1. 첫 번째 확인 항목</h2><p>이 항목에서 독자가 확인해야 할 내용을 쉬운 말로 설명해 주세요.</p><p>구체적인 사례나 비교 기준이 있다면 이어서 적어 주세요.</p><aside class="note"><p>놓치기 쉬운 기준이나 예외 사항을 여기에 강조해 주세요.</p></aside><p class="source">참고: 관련 법령·공식 자료 이름과 링크를 추가해 주세요.</p></section>
<section class="article-section" id="qbv-section-2" aria-labelledby="heading-2"><h2 id="heading-2">2. 두 번째 확인 항목</h2><p>필요한 조건과 적용 범위를 설명해 주세요.</p><p>회사별로 달라질 수 있는 점은 어떤 정보를 확인해야 하는지 함께 안내해 주세요.</p><p class="source">참고: 관련 법령·공식 자료 이름과 링크를 추가해 주세요.</p></section>
<section class="article-section" id="qbv-section-3" aria-labelledby="heading-3"><h2 id="heading-3">3. 준비 서류와 절차</h2><p>준비할 자료와 신청 순서를 단계별로 정리해 주세요.</p><div class="table-wrap"><table aria-label="준비 항목 정리"><thead><tr><th scope="col">구분</th><th scope="col">확인할 내용</th></tr></thead><tbody><tr><th scope="row">준비 항목</th><td>서류나 정보를 입력해 주세요.</td></tr><tr><th scope="row">진행 순서</th><td>신청 전후 절차를 입력해 주세요.</td></tr></tbody></table></div><p>준비 과정에서 확인이 필요한 내용을 추가해 주세요.</p></section>
<section class="article-section" id="qbv-section-4" aria-labelledby="heading-4"><h2 id="heading-4">4. 신청 기한과 비용</h2><p>신청 기한의 기준일과 비용을 정확한 근거와 함께 안내해 주세요.</p><p class="source">참고: 최신 법령과 공식 안내를 확인하고 링크를 추가해 주세요.</p></section>
<section class="qbv-faq" id="qbv-faq" aria-labelledby="faq-title"><h2 id="faq-title">자주 묻는 질문</h2><details><summary>첫 번째 자주 묻는 질문을 입력해 주세요.</summary><p>질문에 대한 답을 핵심부터 간단히 작성해 주세요.</p></details><details><summary>두 번째 자주 묻는 질문을 입력해 주세요.</summary><p>적용 조건이나 예외가 있다면 함께 작성해 주세요.</p></details><details><summary>신청 기한은 언제까지인가요?</summary><p>기산일과 기한을 근거에 맞춰 작성해 주세요.</p></details></section>
<section class="qbv-bridge"><h2>마무리 제목을 입력해 주세요</h2><p>앞에서 설명한 핵심을 짧게 정리하고 다음에 확인할 내용을 안내해 주세요.</p><p>관련된 등기 가이드나 큐레이터 이용 방법을 소개해 주세요.</p></section>
<aside class="qbv-promo" aria-label="큐레이터 서비스 소개"><img class="qbv-brand" src="data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9Ijk4LjM1NjYiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA5OC4zNTY2IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBpZD0iR3JvdXAgMjg5OTU1Ij4KPHBhdGggaWQ9IlZlY3RvciIgZD0iTTQ1LjcxOSAyMy45OTcxQzQ0LjYxMjUgMjMuOTk3MSA0My41Njg0IDIzLjc4MjkgNDIuNTg2OSAyMy4zNTQ2QzQxLjYyMzEgMjIuOTA4NCA0MC43NzU0IDIyLjMwMTYgNDAuMDQzNyAyMS41MzQyQzM5LjMxMTkgMjAuNzQ4OSAzOC43MzE5IDE5Ljg0NzYgMzguMzAzNiAxOC44MzA0QzM3Ljg5MzEgMTcuNzk1MiAzNy42ODc4IDE2LjY5NzYgMzcuNjg3OCAxNS41Mzc2QzM3LjY4NzggMTQuMzc3NSAzNy44OTMxIDEzLjI4ODkgMzguMzAzNiAxMi4yNzE2QzM4LjczMTkgMTEuMjM2NCAzOS4zMTE5IDEwLjMzNTIgNDAuMDQzNyA5LjU2Nzc1QzQwLjc3NTQgOC43ODI0OCA0MS42MjMxIDguMTc1NjggNDIuNTg2OSA3Ljc0NzM1QzQzLjU2ODQgNy4zMDExNyA0NC42MTI1IDcuMDc4MDkgNDUuNzE5IDcuMDc4MDlDNDYuNzU0MSA3LjA3ODA5IDQ3LjcgNy4yNjU0OCA0OC41NTY3IDcuNjQwMjdDNDkuNDEzMyA3Ljk5NzIxIDUwLjE0NTEgOC40OTY5MiA1MC43NTE5IDkuMTM5NDJWNy41MDY0Mkg1NC43Njc1VjIzLjU2ODdINTAuNzUxOVYyMS45MzU3QzUwLjE0NTEgMjIuNTc4MiA0OS40MTMzIDIzLjA4NjkgNDguNTU2NyAyMy40NjE3QzQ3LjcgMjMuODE4NiA0Ni43NTQxIDIzLjk5NzEgNDUuNzE5IDIzLjk5NzFaTTQ2LjI4MTIgMTkuOTAxMkM0Ny4wNjY1IDE5LjkwMTIgNDcuNzgwMyAxOS43MDQ5IDQ4LjQyMjggMTkuMzEyMkM0OS4wNjUzIDE4LjkxOTYgNDkuNTc0IDE4LjM5MzEgNDkuOTQ4OCAxNy43MzI4QzUwLjM0MTQgMTcuMDcyNCA1MC41Mzc3IDE2LjM0MDcgNTAuNTM3NyAxNS41Mzc2QzUwLjUzNzcgMTQuNzM0NSA1MC4zNDE0IDE0LjAwMjcgNDkuOTQ4OCAxMy4zNDI0QzQ5LjU3NCAxMi42ODIxIDQ5LjA2NTMgMTIuMTU1NiA0OC40MjI4IDExLjc2MjlDNDcuNzgwMyAxMS4zNzAzIDQ3LjA2NjUgMTEuMTc0IDQ2LjI4MTIgMTEuMTc0QzQ1LjQ5NTkgMTEuMTc0IDQ0Ljc4MiAxMS4zNzAzIDQ0LjEzOTUgMTEuNzYyOUM0My40OTcxIDEyLjE1NTYgNDIuOTc5NSAxMi42ODIxIDQyLjU4NjkgMTMuMzQyNEM0Mi4yMTIxIDE0LjAwMjcgNDIuMDI0NyAxNC43MzQ1IDQyLjAyNDcgMTUuNTM3NkM0Mi4wMjQ3IDE2LjM0MDcgNDIuMjEyMSAxNy4wNzI0IDQyLjU4NjkgMTcuNzMyOEM0Mi45Nzk1IDE4LjM5MzEgNDMuNDk3MSAxOC45MTk2IDQ0LjEzOTUgMTkuMzEyMkM0NC43ODIgMTkuNzA0OSA0NS40OTU5IDE5LjkwMTIgNDYuMjgxMiAxOS45MDEyWiIgZmlsbD0iIzFFNEJCNiIvPgo8cGF0aCBpZD0iVmVjdG9yXzIiIGQ9Ik04Ny41MjMyIDIzLjU3MTVWNi42ODAwOEg5Mi4xNzA4VjkuMTM1MjNIOTIuMzAxN0M5My4xNjkgNy4zNTExNiA5NC43ODkxIDYuMjIxNzkgOTYuNzIwMiA2LjIyMTc5Qzk3LjI2MDIgNi4yMjE3OSA5Ny43ODM4IDYuMzE5OTkgOTguMzU2NiA2LjQ4MzY3VjEwLjkwMjlDOTcuNjUyOSAxMC43MjI5IDk2Ljk0OTMgMTAuNjI0NyA5Ni4zNjAxIDEwLjYwODNDOTMuNjYgMTAuNjI0NyA5Mi4xODcxIDEyLjQ1NzkgOTIuMTcwOCAxNS44MTMyVjIzLjU3MTVIODcuNTIzMloiIGZpbGw9IiMxRTRCQjYiLz4KPHBhdGggaWQ9IlZlY3Rvcl8zIiBkPSJNNzcuNDgwNiAyNEM3Mi42NDQ0IDI0IDY5LjAwNTUgMjAuMzYxMiA2OS4wMjExIDE1LjU0MDVDNjkuMDA1NSAxMC43MTk4IDcyLjY0NDQgNy4wODEwMiA3Ny40ODA2IDcuMDgxMDJDODIuMjg1NyA3LjA4MTAyIDg1LjkyNDUgMTAuNzE5OCA4NS45NDAxIDE1LjU0MDVDODUuOTI0NSAyMC4zNjEyIDgyLjI4NTcgMjQgNzcuNDgwNiAyNFpNNzcuNDgwNiAxOS45NTY5Qzc5LjkyMiAxOS45NTY5IDgxLjY2MzcgMTguMTM3NCA4MS42NzkyIDE1LjU0MDVDODEuNjYzNyAxMi45NDM2IDc5LjkyMiAxMS4xMjQyIDc3LjQ4MDYgMTEuMTI0MkM3NS4wMDggMTEuMTI0MiA3My4yNjY0IDEyLjk0MzYgNzMuMjgxOSAxNS41NDA1QzczLjI2NjQgMTguMTM3NCA3NS4wMDggMTkuOTU2OSA3Ny40ODA2IDE5Ljk1NjlaIiBmaWxsPSIjMUU0QkI2Ii8+CjxwYXRoIGlkPSJWZWN0b3JfNCIgZD0iTTU2LjUyOTggOS45MzI2NFY2LjMxOTg0SDU5LjMyODlWMi4xNTM3M0g2My45NTA3VjYuMzE5ODRINjcuODU2NFY5LjkzMjY0SDYzLjk1MDdWMTYuODY1M0M2My45MzQ0IDE4LjQ5MjcgNjQuNTg1NCAxOS4xNzYyIDY2LjEzMTQgMTkuMTc2MkM2Ni42NTIyIDE5LjE3NjIgNjcuMjIxOCAxOS4wOTQ4IDY3Ljg1NjQgMTguOTE1OFYyMy4xMTQ1QzY3LjA5MTYgMjMuMzkxMSA2Ni4xOTY1IDIzLjU3MDIgNjUuMTg3NSAyMy41NzAyQzYxLjQxMiAyMy41NzAyIDU5LjMxMjYgMjEuMjU5MyA1OS4zMjg5IDE3LjEyNTdWOS45MzI2NEg1Ni41Mjk4WiIgZmlsbD0iIzFFNEJCNiIvPgo8cGF0aCBpZD0iVmVjdG9yXzUiIGQ9Ik0yNi43MzkgMjMuNTcwNFY2LjY4MTI3SDMxLjM4NzJWOS4xMzYwOEgzMS41MTgxQzMyLjM4NTYgNy4zNTIyNSAzNC4wMDU5IDYuMjIzMDQgMzUuOTM3MiA2LjIyMzA0QzM2LjQ3NzMgNi4yMjMwNCAzNy4wMDEgNi4zMjEyMyAzNy41NzM5IDYuNDg0ODlWMTAuOTAzNUMzNi44NzAxIDEwLjcyMzUgMzYuMTY2MyAxMC42MjUzIDM1LjU3NzEgMTAuNjA5QzMyLjg3NjYgMTAuNjI1MyAzMS40MDM1IDEyLjQ1ODMgMzEuMzg3MiAxNS44MTMyVjIzLjU3MDRIMjYuNzM5WiIgZmlsbD0iIzFFNEJCNiIvPgo8ZyBpZD0iTGF5ZXJfMSIgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwXzBfNTIyKSI+CjxwYXRoIGlkPSJWZWN0b3JfNiIgZD0iTTI0LjIwNCAyMy41NzEzSDE5LjU4NTdMMTguMzQ3NCAyMS41NzY1QzE3Ljk1NDkgMjEuODQwMyAxNy41NDU3IDIyLjA4MSAxNy4xMjE4IDIyLjI5NjFWMTcuNDIxOUMxNy43ODc5IDE2Ljc5MTIgMTguMzQyIDE2LjA0MzYgMTguNzUxMSAxNS4yMTJDMTkuMjYxIDE0LjE3ODUgMTkuNTQ2OSAxMy4wMTU0IDE5LjU0NjkgMTEuNzg1NEMxOS41NDY5IDcuNDk4NjkgMTYuMDcxNiA0LjAyMzQzIDExLjc4NTQgNC4wMjM0M0M3LjQ5OTE3IDQuMDIzNDMgNC4wMjM0MyA3LjQ5ODY5IDQuMDIzNDMgMTEuNzg1NEM0LjAyMzQzIDE0LjMwNDMgNS4yMjI5NCAxNi41NDI3IDcuMDgyMTQgMTcuOTYwOFYyMi41OTUzQzIuOTEzOCAyMC43NzkzIC02LjM3NTk2ZS0wNiAxNi42MjI4IC02LjM3NTk2ZS0wNiAxMS43ODU0Qy02LjM3NTk2ZS0wNiA1LjI3NjQ5IDUuMjc2NDggMCAxMS43ODU0IDBDMTguMjk0MyAwIDIzLjU3MDggNS4yNzY0OSAyMy41NzA4IDExLjc4NTRDMjMuNTcwOCAxNC40MTgyIDIyLjcwNzMgMTYuODQ5MiAyMS4yNDg0IDE4LjgxMTFMMjQuMjA0IDIzLjU3MTNaIiBmaWxsPSIjMUU0QkI2Ii8+CjxnIGlkPSJHcm91cCI+CjxwYXRoIGlkPSJWZWN0b3JfNyIgZD0iTTExLjM3MDMgOS4zMjkxN1YyMy41NjMyQzkuODUwMDcgMjMuNTEwNyA4LjQwMjk5IDIzLjE3MDMgNy4wODIxNSAyMi41OTQ2VjEyLjIzOUwxMS4zNzAzIDkuMzI5MTdaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMF81MjIpIi8+CjxwYXRoIGlkPSJWZWN0b3JfOCIgZD0iTTE3LjEyMTggOC45MTI3N1YyMi4yOTYxQzE1LjgxNDIgMjIuOTYxNiAxNC4zNjU3IDIzLjM5MDQgMTIuODMzMSAyMy41MjVWNi4zNDQyN0wxNy4xMjE4IDguOTEyNzdaIiBmaWxsPSJ1cmwoI3BhaW50MV9saW5lYXJfMF81MjIpIi8+CjwvZz4KPC9nPgo8L2c+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMF81MjIiIHgxPSI5LjIyNjI1IiB5MT0iMTMuODIxMiIgeDI9IjkuMjI2MjUiIHkyPSIyMy41ODkyIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiMwMDVBRTUiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMUU0QkI2Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQxX2xpbmVhcl8wXzUyMiIgeDE9IjE0Ljk5MzYiIHkxPSIxMC45Mjg0IiB4Mj0iMTQuOTc3NCIgeTI9IjIzLjU1NjQiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzAwNUFFNSIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMxRTRCQjYiLz4KPC9saW5lYXJHcmFkaWVudD4KPGNsaXBQYXRoIGlkPSJjbGlwMF8wXzUyMiI+CjxyZWN0IHdpZHRoPSIyNC4yMDQiIGhlaWdodD0iMjMuNTcxMyIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K" width="99" height="24" alt="큐레이터"><h3>큐레이터에서 등기 서류를 준비해 보세요</h3><p>변경 내용을 입력하고 안내에 따라 서류를 준비하는 과정을 간단히 소개해 주세요.</p><ol class="qbv-service-steps"><li>변경 내용 입력</li><li>서류 자동 작성</li><li>신청인이 직접 신청</li></ol><a class="qbv-apply" href="https://www.qrator.kr/registration/select-items">큐레이터 이용 안내 <span aria-hidden="true">→</span></a></aside>
<footer class="qbv-sources"><section class="qbv-disclosure" data-studio-fixed="legal-notice" aria-labelledby="qbv-disclosure-title"><h2 id="qbv-disclosure-title">콘텐츠 이용 안내</h2><p>이 글은 법인등기 절차에 관한 일반적인 안내로, 특정 회사의 사안에 대한 법률 자문이나 등기 상담이 아닙니다. 필요한 서류와 절차는 회사의 정관과 결의 방식에 따라 달라질 수 있고, 등기 기한을 넘기면 과태료가 부과될 수 있으니 기한은 꼭 확인해 주세요. 이 글은 작성일 {{article-date}} 기준이며 법령 개정에 따라 내용이 달라질 수 있습니다. 빅테크플러스는 법률사무소나 법무사사무소가 아니며, 큐레이터는 신청인이 직접 등기를 신청할 수 있도록 서류 작성을 돕는 소프트웨어입니다. 개별 사안은 변호사나 법무사에게 확인하시기 바랍니다.</p></section><details><summary>참고 법령 및 공식 자료</summary><ul><li>참고 법령·공식 자료 이름과 URL을 추가해 주세요.</li></ul></details></footer>
</article></body></html>`;
function enforceFixedDisclosure(html,record){
 if(!html)return html;
 const doc=new DOMParser().parseFromString(html,'text/html');
 if(!(record?.templateId==='qrator-guide-v1'||doc.querySelector('meta[name="qrator-template"][content="guide-v1"]')))return html;
 const article=doc.querySelector('#qrator-blog');if(!article)return html;
 let footer=article.querySelector('.qbv-sources');
 if(!footer){footer=doc.createElement('footer');footer.className='qbv-sources';article.append(footer);}
 let notice=footer.querySelector('.qbv-disclosure');
 if(!notice){notice=doc.createElement('section');notice.className='qbv-disclosure';footer.prepend(notice);}
 notice.setAttribute('aria-labelledby','qbv-disclosure-title');
 const rawDate=doc.querySelector('.qbe-author time')?.textContent?.trim()||'';
 const dateMatch=rawDate.match(/(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})/);
 const today=kstDate(new Date());const todayMatch=today.match(/(\d{4})-(\d{2})-(\d{2})/);
 const displayDate=dateMatch?dateMatch[1]+'. '+dateMatch[2].padStart(2,'0')+'. '+dateMatch[3].padStart(2,'0')+'.':(todayMatch?todayMatch[1]+'. '+todayMatch[2]+'. '+todayMatch[3]+'.':today);
 const heading=doc.createElement('h2');heading.id='qbv-disclosure-title';heading.textContent='콘텐츠 이용 안내';
 const paragraph=doc.createElement('p');paragraph.textContent='이 글은 법인등기 절차에 관한 일반적인 안내로, 특정 회사의 사안에 대한 법률 자문이나 등기 상담이 아닙니다. 필요한 서류와 절차는 회사의 정관과 결의 방식에 따라 달라질 수 있고, 등기 기한을 넘기면 과태료가 부과될 수 있으니 기한은 꼭 확인해 주세요. 이 글은 작성일 '+displayDate+' 기준이며 법령 개정에 따라 내용이 달라질 수 있습니다. 빅테크플러스는 법률사무소나 법무사사무소가 아니며, 큐레이터는 신청인이 직접 등기를 신청할 수 있도록 서류 작성을 돕는 소프트웨어입니다. 개별 사안은 변호사나 법무사에게 확인하시기 바랍니다.';
 notice.replaceChildren(heading,paragraph);
 notice.removeAttribute('data-studio-fixed');notice.removeAttribute('contenteditable');
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
function recordFromForm(){
 const r=clone(state.current);
 r.title=$('editTitle').value.trim();r.category=$('editCategory').value;r.author=$('editAuthor').value;r.summary=$('editSummary').value;r.slug=$('editSlug').value.trim();r.tags=$('editTags').value.split(',').map(x=>x.trim()).filter(Boolean);r.status=$('editStatus').value;
 r.scheduledAt=$('editSchedule').value?new Date($('editSchedule').value+':00+09:00').toISOString():null;
 r.note=$('editNote').value;r.sourceUrls=$('editSources').value.split('\n').map(x=>x.trim()).filter(Boolean);r.reviewStatus=$('editReviewStatus').value;r.seoTitle=$('seoTitle').value||r.title;r.seoDescription=$('seoDescription').value||r.summary;
 if(state.mode==='code')r.html=$('htmlEditor').value;else if(state.editorReady)r.html=editedHTML($('visualEditor').contentDocument,r);
 r.html=enforceFixedDisclosure(r.html,r);
 return r;
}
function loadVisual(){
 state.editorReady=false;
 $('visualEditor').onload=()=>{
  try{
   const doc=$('visualEditor').contentDocument;
   doc.body.contentEditable=state.mode==='visual'?'true':'false';
   doc.body.spellcheck=false;
   const fixedNotice=doc.querySelector('.qbv-disclosure');if(fixedNotice&&(state.current?.templateId==='qrator-guide-v1'||doc.querySelector('meta[name="qrator-template"][content="guide-v1"]'))){fixedNotice.setAttribute('data-studio-fixed','legal-notice');fixedNotice.contentEditable='false';}
   if(state.mode==='text'){
    const excluded='script,style,noscript,svg,math,iframe,object,embed,canvas,video,audio,img,picture,source,input,textarea,select,option,button,[data-studio-fixed]';
    for(const el of doc.body.querySelectorAll('*')){
     if(el.matches(excluded)||el.closest(excluded)||el.children.length)continue;
     if(!el.textContent.trim())continue;
     el.contentEditable='true';el.spellcheck=false;el.classList.add('qrator-text-editable');el.setAttribute('data-studio-text-editable','true');
    }
   }
   doc.addEventListener('input',markDirty);
   doc.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});
   doc.addEventListener('submit',e=>e.preventDefault());
   const style=doc.createElement('style');
   style.setAttribute('data-studio-temporary','true');style.textContent='.qrator-text-editable{cursor:text}.qrator-text-editable:hover{outline:1px dashed #7baaff;outline-offset:2px}.qrator-text-editable:focus{outline:2px solid #84b4ff;outline-offset:2px}';
   doc.head.appendChild(style);
   $('visualEditor').classList.toggle('text-only-mode',state.mode==='text');
   $('editorBox').classList.toggle('text-mode',state.mode==='text');
   $('editorHint').textContent=state.mode==='text'?'글자를 클릭해 텍스트만 수정하세요. 이미지와 레이아웃은 유지됩니다.':'기존 HTML 서식 유지';
   state.editorReady=true;
  }catch(e){toast('화면 편집을 열 수 없습니다. HTML 편집을 사용해 주세요.');}
 };
 $('visualEditor').srcdoc=previewHTML(state.current);
}
function renderAssets(){$('assetList').innerHTML=state.current.assets.map((a,i)=>'<span class="asset-chip">'+esc(a.path)+'<button type="button" data-asset-remove="'+i+'" aria-label="'+esc(a.path)+' 삭제">×</button></span>').join('');}
function fillEditor(record,initialMode='visual'){
 record={...record,status:normalizeStatus(record.status)};state.current=clone(record);state.dirty=false;state.mode=initialMode;
 $('listView').hidden=true;$('editorView').hidden=false;$('editorTitle').textContent=record.revision?'등기 가이드 수정':'등기 가이드 작성';
 $('editTitle').value=record.title;$('editCategory').value=record.category;$('editAuthor').value=record.author;
 $('editSummary').value=record.summary;$('editSlug').value=record.slug;$('editSlug').readOnly=!!record.revision;$('slugHint').textContent=record.revision?'등록된 콘텐츠의 주소는 고정됩니다.':'영문 소문자·숫자·하이픈';
 $('editTags').value=record.tags.join(', ');$('editStatus').value=record.status;$('editSchedule').value=toInput(record.scheduledAt);
 $('editNote').value=record.note||'';$('editSources').value=(record.sourceUrls||[]).join('\n');$('editReviewStatus').value=record.reviewStatus||((record.verification||'').includes('완료')?'complete':((record.verification||'').includes('수정')?'needs_revision':((record.verification||'').includes('검토 중')?'in_review':'pending')));
 $('seoTitle').value=record.seoTitle||record.title;$('seoDescription').value=record.seoDescription||record.summary;
 $('titleLength').textContent=record.title.length+' / 100';$('saveState').textContent=record.revision?'저장됨':'작성 중 · 저장 필요';
 $('revisionInfo').textContent=record.updatedAt?dateTime(record.updatedAt)+' · '+(record.updatedBy||record.author):'';
 $('editBy').textContent='현재 편집자: '+state.user.name;$('deleteButton').hidden=!record.revision;$('historyButton').disabled=!record.history?.length;
 state.mode='visual';$('visualEditor').hidden=false;$('htmlEditor').hidden=true;$('editorBox').classList.toggle('text-mode',state.mode==='text');$('editorHint').textContent=state.mode==='text'?'등기 가이드 기본 틀입니다. 글자를 클릭해 문구만 바꿔 보세요.':'기존 HTML 서식 유지';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('mode-active',b.dataset.mode===state.mode));
 renderAssets();loadVisual();window.scrollTo(0,0);refreshGithubStatus();
}
async function openRecord(slug){if(!ensureLeave())return;const r=await api('get',null,{slug});fillEditor(r);}
function newRecord(){
 if(!ensureLeave())return;fillEditor({slug:'',title:'',category:CATEGORIES[0],summary:'',tags:[],html:starterHTML.replaceAll('작성일 입력',kstDate(new Date())).replaceAll('{{article-date}}',kstDate(new Date()).replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1. $2. $3.')),templateId:'qrator-guide-v1',entryPath:'index.html',assets:[],author:state.user.name,status:'draft',reviewStatus:'pending',scheduledAt:null,note:'',sourceUrls:[],verification:'',history:[]},'text');
}
async function save(){
 if(!$('editorForm').reportValidity())return;
 const buttons=[$('saveButton'),$('saveBottom')];buttons.forEach(b=>b.disabled=true);
 try{const r=recordFromForm();const saved=await api('save',{record:r,expectedRevision:state.current.revision||null});localStorage.removeItem(LOCAL_DRAFT_KEY);state.current=saved;state.dirty=false;await showList();toast('저장했습니다. 팀원 모두에게 반영됩니다.');}
 catch(e){$('saveState').textContent=e.status===409?'수정 충돌 · 입력 내용 보존 중':'저장 실패 · 입력 내용 보존 중';toast(e.message);}
 finally{buttons.forEach(b=>b.disabled=false);}
}
async function setMode(mode){
 if(state.mode===mode)return;const r=recordFromForm();state.current={...state.current,...r};state.mode=mode;
 $('visualEditor').hidden=mode==='code';$('htmlEditor').hidden=mode!=='code';
 $('editorBox').classList.toggle('text-mode',mode==='text');
 if(mode==='code')$('htmlEditor').value=state.current.html;else loadVisual();
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('mode-active',b.dataset.mode===mode));
}
async function download(records){
 if(!records.length){toast('다운로드할 콘텐츠를 선택해 주세요.');return;}
 toast(records.length+'편의 전달 폴더를 준비하고 있습니다.');
 const data=await exportFolder(records,window.JSZip);const url=URL.createObjectURL(new Blob([data],{type:'application/zip'}));const link=document.createElement('a');
 link.href=url;link.download='Qrator_guides_'+kstDate(new Date()).replaceAll('-','')+'.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),20000);toast('전달 폴더를 다운로드했습니다.');
}
async function fetchSelected(slugs){return Promise.all(slugs.map(async slug=>{const r=await api('get',null,{slug});return {...r,status:normalizeStatus(r.status)};}));}
async function batchStatus(status){
 const slugs=[...state.selected];if(!slugs.length){toast('콘텐츠를 선택해 주세요.');return;}
 if(!confirm(slugs.length+'편을 "'+STATUS[status]+'" 상태로 변경하시겠습니까?'))return;
 let success=0;const failures=[];
 for(const slug of slugs){try{const r=await api('get',null,{slug});await api('save',{record:{...r,status},expectedRevision:r.revision});success++;}catch(e){failures.push(slug+': '+e.message);}}
 state.selected.clear();await loadItems();toast(success+'편 변경 완료'+(failures.length?' · '+failures.length+'편 실패':''));
 if(failures.length)alert(failures.join('\n'));
}
async function importFiles(files){
 let imported=0,skipped=0,failed=[];
 for(const file of files){
  let candidates;
  try{if(/\.zip$/i.test(file.name))candidates=await readArchive(file,window.JSZip);else if(/\.html?$/i.test(file.name)){if(file.size>2000000)throw new Error('HTML은 2MB 이내로 올려 주세요.');const html=await file.text();const meta=metadataFromHTML(html,file.name);candidates=[{...meta,tags:suggestTags(html,meta.title,meta.category),html,entryPath:file.name,assets:[]}];}else throw new Error('HTML 또는 ZIP 파일을 선택해 주세요.');}
  catch(e){failed.push(file.name+': '+e.message);continue;}
  for(const candidate of candidates){
   try{
    const existing=state.items.find(x=>x.slug===candidate.slug);let expectedRevision=null,base={};
    if(existing){if(!confirm('"'+candidate.title+'"과 같은 주소가 있습니다. 기존 글의 새 수정본으로 등록하시겠습니까?')){skipped++;continue;}
     base=await api('get',null,{slug:candidate.slug});expectedRevision=base.revision;}
    const record={...base,...candidate,author:state.user.name,status:'draft',reviewStatus:'pending',tags:[...new Set([...(base.tags||[]),...(candidate.tags||[])])],note:base.note||'',verification:base.verification||''};
    const result=await api('save',{record,expectedRevision});state.items=state.items.filter(x=>x.slug!==result.slug);state.items.push(result);imported++;
   }catch(e){failed.push(candidate.entryPath+': '+e.message);}
  }
 }
 await loadItems();toast(imported+'편 가져오기 완료'+(skipped?' · '+skipped+'편 건너뜀':'')+(failed.length?' · '+failed.length+'편 실패':''));
 if(failed.length)alert(failed.join('\n'));
}
async function showHistory(){
 const history=[...(state.current.history||[])].reverse();
 $('historyRows').innerHTML=history.map(v=>'<div class="history-row"><div class="history-info"><strong>'+esc(v.title)+'</strong><div class="small muted">'+dateTime(v.updatedAt)+' · '+esc(v.updatedBy)+' · '+statusLabel(v.status)+'</div></div><button data-restore="'+esc(v.revision)+'">이 버전 불러오기</button></div>').join('')||'<p class="empty">이전 수정본이 없습니다.</p>';$('historyDialog').showModal();
}
function guard(action){return async(...args)=>{try{await action(...args);}catch(e){toast(e.message);}};}
$('filterForm').onsubmit=e=>{e.preventDefault();applyFilters();};
$('resetFilters').onclick=()=>{$('filterForm').reset();applyFilters();};
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('period-active',x===b));
 $('dateTo').value=b.dataset.days==='all'?'':kstDate(new Date());$('dateFrom').value=b.dataset.days==='all'?'':kstDate(new Date(Date.now()-Number(b.dataset.days)*86400000));});
$('sort').onchange=applyFilters;$('pageSize').onchange=()=>{state.page=1;renderList();};
$('refresh').onclick=guard(loadItems);
$('rows').onclick=guard(async e=>{const open=e.target.closest('[data-open]');if(open)await openRecord(open.dataset.open);});
$('rows').onchange=e=>{if(e.target.matches('.row-check')){e.target.checked?state.selected.add(e.target.dataset.slug):state.selected.delete(e.target.dataset.slug);renderList();}};
$('selectAll').onchange=e=>{const size=Number($('pageSize').value);state.filtered.slice((state.page-1)*size,state.page*size).forEach(r=>e.target.checked?state.selected.add(r.slug):state.selected.delete(r.slug));renderList();};
$('pagination').onclick=e=>{const b=e.target.closest('[data-page]');if(b&&!b.disabled){state.page=Number(b.dataset.page);renderList();}};
$('createButton').onclick=newRecord;$('navContents').onclick=guard(showList);$('backToList').onclick=guard(showList);
$('importButton').onclick=()=>$('importInput').click();
$('importInput').onchange=guard(async e=>{const files=[...e.target.files];e.target.value='';await importFiles(files);});
$('downloadSelected').onclick=guard(async()=>download(await fetchSelected([...state.selected])));
$('downloadReady').onclick=guard(async()=>download(await fetchSelected(state.items.filter(x=>x.status==='completed').map(x=>x.slug))));
$('completedSelected').onclick=guard(()=>batchStatus('completed'));$('privateSelected').onclick=guard(()=>batchStatus('private'));
$('editorForm').onsubmit=e=>e.preventDefault();$('editorForm').oninput=e=>{markDirty();if(e.target.id==='editTitle')$('titleLength').textContent=e.target.value.length+' / 100';if(!state.current?.revision){const doc=$('visualEditor').contentDocument;const title=doc?.querySelector('#qbv-title');const subhead=doc?.querySelector('.subhead');const category=doc?.querySelector('[data-template-category]');if(title&&e.target.id==='editTitle')title.textContent=e.target.value||'새 등기 가이드 제목';if(subhead&&e.target.id==='editSummary')subhead.textContent=e.target.value||'이 글에서 안내할 내용을 한두 문장으로 소개해 주세요.';if(category&&e.target.id==='editCategory')category.textContent=e.target.value;}};
$('saveButton').onclick=guard(save);$('saveBottom').onclick=guard(save);
$('htmlEditor').oninput=markDirty;
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=guard(()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-command]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{
 if(state.mode!=='visual'){toast('화면 편집 모드에서 사용해 주세요.');return;}$('visualEditor').contentDocument.execCommand(b.dataset.command,false,b.dataset.value||null);markDirty();};});
document.querySelectorAll('[data-insert]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{
 if(state.mode!=='visual'){toast('화면 편집 모드에서 사용해 주세요.');return;}
 const type=b.dataset.insert,doc=$('visualEditor').contentDocument;let html='';
 if(type==='table')html='<table><thead><tr><th>항목</th><th>내용</th></tr></thead><tbody><tr><td>구분</td><td>내용 입력</td></tr></tbody></table><p><br></p>';
 if(type==='box')html='<aside style="padding:20px;background:#f1f5ff;border-left:3px solid #0366ff"><strong>핵심 안내</strong><p>내용을 입력해 주세요.</p></aside><p><br></p>';
 if(type==='faq')html='<section><h2>자주 묻는 질문</h2><h3>확인 항목</h3><p>답변을 입력해 주세요.</p></section>';
 if(type==='link'){const url=prompt('연결할 URL을 입력해 주세요.','https://');if(!url)return;if(!/^https?:\/\//.test(url)){toast('http 또는 https 주소를 입력해 주세요.');return;}html='<a href="'+esc(url)+'">링크 문구</a>';}
 if(type==='image'){const path=prompt('첨부 파일의 경로 또는 이미지 URL을 입력해 주세요.');if(!path)return;if(/^(javascript|vbscript):/i.test(path))return;html='<img src="'+esc(path)+'" alt="이미지 설명" style="max-width:100%">';}
 doc.execCommand('insertHTML',false,html);markDirty();
 };});
$('assetInput').onchange=guard(async e=>{
 state.current=recordFromForm();
 for(const file of e.target.files){if(file.size>2000000)throw new Error('첨부 파일은 2MB 이내로 올려 주세요.');const path=(state.current.entryPath.split('/').slice(0,-1).join('/')?state.current.entryPath.split('/').slice(0,-1).join('/')+'/':'')+'assets/'+file.name.replace(/[\/:]/g,'-');
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
  const asset={path,mime:file.type||mime(path),base64};const i=state.current.assets.findIndex(x=>x.path===path);
  if(i>=0){if(!confirm(path+' 파일을 교체하시겠습니까?'))continue;state.current.assets[i]=asset;}else state.current.assets.push(asset);
 }e.target.value='';renderAssets();if(state.mode==='visual')loadVisual();markDirty();
});
$('assetList').onclick=e=>{const b=e.target.closest('[data-asset-remove]');if(b){state.current.assets.splice(Number(b.dataset.assetRemove),1);renderAssets();markDirty();}};
$('previewButton').onclick=guard(()=>{$('previewFrame').srcdoc=previewHTML(recordFromForm());$('previewFrame').style.maxWidth='100%';$('previewDialog').showModal();});
$('closePreview').onclick=()=>$('previewDialog').close();$('desktopPreview').onclick=()=>$('previewFrame').style.maxWidth='100%';$('mobilePreview').onclick=()=>$('previewFrame').style.maxWidth='390px';
$('historyButton').onclick=guard(showHistory);$('closeHistory').onclick=()=>$('historyDialog').close();
$('historyRows').onclick=guard(async e=>{const b=e.target.closest('[data-restore]');if(!b)return;
 if(state.dirty&&!confirm('현재 저장하지 않은 편집 내용을 이전 버전으로 바꾸시겠습니까?'))return;
 const version=await api('version',null,{slug:state.current.slug,revision:b.dataset.restore});const current=state.current;
 fillEditor({...version,revision:current.revision,history:current.history,status:'draft',note:(current.note||'')+'\n이전 버전 불러오기: '+dateTime(version.updatedAt)});
 markDirty();$('historyDialog').close();toast('이전 버전을 불러왔습니다. 확인 후 저장해 주세요.');});
$('downloadCurrent').onclick=guard(()=>download([recordFromForm()]));
$('deleteButton').onclick=guard(async()=>{if(!confirm('콘텐츠를 휴지통으로 이동하시겠습니까?'))return;await api('delete',{slug:state.current.slug,expectedRevision:state.current.revision});state.dirty=false;state.selected.delete(state.current.slug);await showList();toast('휴지통으로 이동했습니다.');});
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});

$('selectFiltered').onclick=()=>{state.filtered.forEach(x=>state.selected.add(x.slug));renderList();};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginButton').disabled=true;$('loginError').textContent='';try{const r=await api('login',{password:$('teamPassword').value});$('teamPassword').value='';state.user=r.user;showWorkspace();let draft;try{draft=JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY)||'null');}catch{}if(draft?.record&&confirm('브라우저에 자동 저장된 임시 내용이 있습니다. 복구할까요?')){fillEditor({...draft.record,revision:draft.expectedRevision||undefined});state.dirty=true;$('saveState').textContent='임시 저장 내용 복구됨 · 사이트 저장 필요';return;}if(draft)localStorage.removeItem(LOCAL_DRAFT_KEY);await loadItems();}catch(e){$('loginError').textContent=e.message;}finally{$('loginButton').disabled=false;}};
$('logoutButton').onclick=guard(async()=>{if(!ensureLeave())return;await api('logout',{});state.dirty=false;state.items=[];state.selected.clear();showLogin();});
let trashItems=[];
async function showTrash(){const r=await api('list',null,{trash:'1'});trashItems=r.items;$('emptyTrashButton').disabled=!trashItems.length;$('trashRows').innerHTML=trashItems.map(x=>'<div class="history-row"><span>'+esc(x.title)+'</span><button data-restore-trash="'+esc(x.slug)+'" data-revision="'+esc(x.revision)+'">복원</button></div>').join('')||'<p>휴지통이 비어 있습니다.</p>';if(!$('trashDialog').open)$('trashDialog').showModal();}
$('trashButton').onclick=guard(async()=>{if(!ensureLeave())return;await showTrash();});
$('closeTrash').onclick=()=>$('trashDialog').close();
$('emptyTrashButton').onclick=guard(async()=>{const items=trashItems.map(x=>({slug:x.slug,revision:x.revision}));if(!items.length){toast('휴지통이 비어 있습니다.');return;}if(!confirm('휴지통의 '+items.length+'편과 수정 이력을 영구 삭제할까요? 삭제한 콘텐츠는 복원할 수 없습니다.'))return;const button=$('emptyTrashButton');button.disabled=true;try{const result=await api('emptyTrash',{items});await showTrash();await loadItems();alert(result.deleted+'편을 영구 삭제했습니다.'+(result.skipped?.length?'\\n'+result.skipped.length+'편은 변경되어 건너뛰었습니다.':''));}finally{button.disabled=!trashItems.length;}});
$('trashRows').onclick=guard(async e=>{const b=e.target.closest('[data-restore-trash]');if(!b)return;await api('restore',{slug:b.dataset.restoreTrash,expectedRevision:b.dataset.revision});await showTrash();await loadItems();toast('콘텐츠를 복원했습니다.');});

let deletingSelected=false;
const deleteSelected=document.createElement('button');
deleteSelected.id='deleteSelected';
deleteSelected.type='button';
deleteSelected.className='danger';
deleteSelected.textContent='선택 삭제';
deleteSelected.disabled=true;
$('privateSelected').after(deleteSelected);
deleteSelected.onclick=guard(async()=>{
 if(deletingSelected)return;
 const records=state.items.filter(r=>state.selected.has(r.slug));
 if(!records.length){toast('삭제할 콘텐츠를 선택해 주세요.');return;}
 if(!confirm('선택한 '+records.length+'편을 휴지통으로 이동하시겠습니까?\n휴지통에서 복원할 수 있습니다.'))return;
 deletingSelected=true;deleteSelected.disabled=true;deleteSelected.textContent='삭제 중…';
 let success=0;const failures=[];
 try{
  for(const record of records){
   try{await api('delete',{slug:record.slug,expectedRevision:record.revision});state.selected.delete(record.slug);success++;}
   catch(e){failures.push(record.title+': '+e.message);}
  }
  try{await loadItems();}catch(e){failures.push('목록 새로고침 실패: '+e.message);}
  toast(success+'편을 휴지통으로 이동했습니다.'+(failures.length?' 일부 작업에 실패했습니다.':''));
  if(failures.length)alert(failures.join('\n'));
 }finally{deletingSelected=false;deleteSelected.textContent='선택 삭제';deleteSelected.disabled=state.selected.size===0;}
});


const githubCurrent=document.createElement('button');githubCurrent.type='button';githubCurrent.textContent='GitHub에 저장';$('saveButton').before(githubCurrent);
const githubSelected=document.createElement('button');githubSelected.textContent='선택 글 GitHub에 저장';$('downloadSelected').after(githubSelected);
const githubStatus=document.createElement('div');githubStatus.className='small muted';$('revisionInfo').after(githubStatus);
async function githubRequest(slug,revision){
 const response=await fetch('/api/github?slug='+encodeURIComponent(slug),{method:revision?'POST':'GET',credentials:'same-origin',headers:revision?{'Content-Type':'application/json'}:{},body:revision?JSON.stringify({revision}):undefined});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'GitHub 요청 실패');return result;
}
async function refreshGithubStatus(){
 const record=state.current;if(!record?.revision){githubStatus.textContent='사이트에 먼저 저장해 주세요.';return;}
 githubStatus.textContent='GitHub 저장 상태 확인 중…';
 try{const {sync}=await githubRequest(record.slug);if(state.current!==record)return;githubStatus.textContent=sync?(sync.revision===record.revision?'GitHub 저장 완료':'최신 수정사항 미반영')+' · '+dateTime(sync.savedAt):'GitHub에 저장하지 않은 글';}catch(e){if(state.current===record)githubStatus.textContent=e.message;}
}
let githubBusy=false;
async function exportGithub(records){
 if(githubBusy)return;if(!records.length){toast('콘텐츠를 선택해 주세요.');return;}
 if(!confirm(records.length+'편의 저장된 HTML과 첨부 파일을 GitHub에 저장하시겠습니까?'))return;
 githubBusy=true;githubCurrent.disabled=githubSelected.disabled=true;let success=0;const failures=[];
 try{for(const r of records){try{const result=await githubRequest(r.slug,r.revision);success++;if(result.warning)failures.push(result.warning);}catch(e){failures.push(r.title+': '+e.message);}}
 toast(success+'편 GitHub 저장 완료');if(failures.length)alert(failures.join('\n'));if(state.current)await refreshGithubStatus();
 }finally{githubBusy=false;githubCurrent.disabled=githubSelected.disabled=false;}
}
githubCurrent.onclick=guard(async()=>{if(state.dirty||!state.current?.revision){toast('변경사항을 사이트에 먼저 저장한 뒤 다시 열어 주세요.');return;}await exportGithub([state.current]);});
githubSelected.onclick=guard(()=>exportGithub(state.items.filter(r=>state.selected.has(r.slug))));

(async()=>{syncSelects();try{const r=await api('session');state.user=r.user;showWorkspace();await loadItems();}catch(e){showLogin();if(e.status!==401)$('loginError').textContent=e.message;}})();

