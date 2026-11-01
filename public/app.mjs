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
 const scheduled=state.items.filter(x=>x.status==='scheduled').length,completed=state.items.filter(x=>x.status==='completed').length;
 $('totalCount').textContent='총 '+count+'건  |  게시 예정 '+scheduled+' · 작성 완료 '+completed;
 $('rows').innerHTML=visible.length?visible.map((r,i)=>'<tr><td><input type="checkbox" class="row-check" data-slug="'+esc(r.slug)+'" aria-label="'+esc(r.title)+' 선택" '+(state.selected.has(r.slug)?'checked':'')+'></td><td>'+(count-(state.page-1)*size-i)+'</td><td>'+(r.thumbnailPath?'<img class="thumb-image" loading="lazy" src="/api/studio?op=thumbnail&slug='+encodeURIComponent(r.slug)+'&path='+encodeURIComponent(r.thumbnailPath)+'" alt="'+esc(r.title)+' 대표 이미지">':'<span class="thumb">'+esc(r.category)+'<br>등기 가이드</span>')+'</td><td>'+esc(r.category.replace(' 변경','').replace(' 이전',''))+'</td><td><button class="article-title" data-open="'+esc(r.slug)+'">'+esc(r.title)+'</button><div class="small muted">'+esc(r.slug)+'</div></td><td>'+r.tags.slice(0,3).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</td><td><span class="badge review-'+esc(r.reviewStatus||'pending')+'">'+(REVIEW_STATUS[r.reviewStatus||'pending']||'검토 전')+'</span></td><td><span class="badge '+esc(r.status)+'">'+STATUS[r.status]+'</span></td><td>'+(r.history?.length?'<span style="color:#3866c8">있음</span>':'-')+'</td><td>'+dateTime(r.scheduledAt)+'</td><td>'+dateTime(r.updatedAt)+'</td><td>'+esc(r.updatedBy||r.author)+'</td><td><button data-open="'+esc(r.slug)+'">상세</button></td></tr>').join(''):'<tr><td colspan="13" class="empty">조건에 맞는 콘텐츠가 없습니다.</td></tr>';
 $('selectedCount').textContent=state.selected.size+'건 선택';
 if($('deleteSelected'))$('deleteSelected').disabled=deletingSelected||state.selected.size===0;
 $('selectAll').checked=visible.length>0&&visible.every(x=>state.selected.has(x.slug));
 $('selectAll').indeterminate=visible.some(x=>state.selected.has(x.slug))&&!$('selectAll').checked;
 $('pagination').innerHTML='<button data-page="'+(state.page-1)+'" '+(state.page===1?'disabled':'')+' aria-label="이전 페이지">‹</button>'+Array.from({length:pages},(_,i)=>i+1).filter(p=>Math.abs(p-state.page)<3||p===1||p===pages).map(p=>'<button data-page="'+p+'" class="'+(p===state.page?'current':'')+'">'+p+'</button>').join('')+'<button data-page="'+(state.page+1)+'" '+(state.page===pages?'disabled':'')+' aria-label="다음 페이지">›</button>';
}
function ensureLeave(){return !state.dirty||confirm('저장하지 않은 변경사항이 있습니다. 목록으로 이동하시겠습니까?');}
async function showList(){if(!ensureLeave())return;state.dirty=false;$('editorView').hidden=true;$('listView').hidden=false;await loadItems();}
const starterHTML=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>등기 가이드 | 큐레이터</title><meta name="description" content="등기 가이드 내용을 입력해 주세요."><style>
:root{--blue:#2454c6;--ink:#28354b;--sub:#69758a;--line:#e3e8f1;--pale:#f5f7fc}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:16px/1.85 Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#qrator-guide{max-width:836px;margin:0 auto;padding:42px 24px 64px}#qrator-guide h1,#qrator-guide h2,#qrator-guide h3,#qrator-guide p,#qrator-guide ol,#qrator-guide ul{margin:0}
.qge-header{padding:0 0 28px;border-bottom:1px solid var(--line)}.eyebrow{display:flex;gap:10px;align-items:center;color:var(--sub);font-size:13px;margin-bottom:13px}.tag{display:inline-flex;padding:3px 10px;background:#eef3ff;color:var(--blue);border-radius:20px;font-weight:650}
#qrator-guide h1{font-size:34px;line-height:1.4;letter-spacing:-1px;font-weight:750;word-break:keep-all;margin-bottom:12px}.subhead{font-size:17px;color:#596579;line-height:1.7}.meta{display:flex;gap:10px;align-items:center;margin-top:18px;color:var(--sub);font-size:13px}.meta-dot{width:3px;height:3px;background:#aab2c0;border-radius:50%}
.summary{padding:25px 22px;margin:22px 0 18px;background:var(--pale);border:1px solid #e6ebf5;border-radius:8px}.summary-title{font-size:14px;font-weight:700;margin-bottom:13px!important}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.summary-grid>div{min-width:0}.summary-grid>div+div{padding-left:18px;border-left:1px solid #dce3f0}.summary-grid small{display:block;font-size:12px;color:var(--sub)}.summary-grid strong{display:block;font-size:17px;line-height:1.5;margin:4px 0;color:var(--blue)}.summary-grid em{display:block;font-size:12px;line-height:1.65;color:var(--sub);font-style:normal}
.toc{padding:22px;margin:18px 0 34px;background:#f8faff;border:1px solid #e5eaf3;border-radius:8px}.toc h2{font-size:17px;margin-bottom:12px!important}.toc ol{padding-left:22px}.toc li{padding:3px 0;color:var(--sub)}.toc a{color:var(--blue);text-decoration:none}
.article-section{padding:25px 0 30px;border-bottom:1px solid var(--line)}.section-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:13px}.section-num{flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;background:#edf2ff;color:var(--blue);font-size:12px;font-weight:700;border-radius:50%}#qrator-guide h2{font-size:23px;line-height:1.5;letter-spacing:-.5px;font-weight:700;word-break:keep-all}.article-section p{margin:8px 0;color:#465267}.note{padding:17px 18px;margin:16px 0;background:#f5f8ff;border-left:3px solid var(--blue);border-radius:4px}.note p{margin:0}.table-wrap{overflow-x:auto;margin:18px 0}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:11px 13px;text-align:left}th{background:#f5f7fb}
.qgv-faq{padding-top:30px;margin:16px 0 30px}.qgv-faq>h2{margin-bottom:10px!important}.qgv-faq details{border-bottom:1px solid var(--line);padding:14px 0}.qgv-faq summary{font-size:15px;font-weight:650;color:#27344d;line-height:1.8;cursor:pointer;list-style:none}.qgv-faq summary::-webkit-details-marker{display:none}.qgv-faq summary:after{content:"+";float:right;color:#5974a8;font-size:20px}.qgv-faq details[open] summary:after{content:"−"}.qgv-faq details p{font-size:14px;color:#636c7b;line-height:1.9;margin:8px 24px 0 0}
.qgv-bridge{padding:20px 0}.qgv-bridge h2{font-size:20px;margin-bottom:7px!important}.qgv-bridge p{color:#596579}
.qgv-promo{padding:30px;background:#2454c6;color:#fff;border-radius:10px;margin:14px 0 28px}.qgv-promo .qgv-brand{font-weight:750;letter-spacing:.2px}.qgv-promo h2{font-size:24px;color:#fff;margin:8px 0 10px!important}.qgv-promo p{color:#eef3ff}.qgv-apply{display:inline-flex;margin-top:18px;padding:10px 16px;background:#fff;color:#2454c6;text-decoration:none;border-radius:5px;font-weight:700}
.qgv-sources{padding-top:14px;color:var(--sub);font-size:13px}.qgv-sources>p{margin-bottom:12px}.qgv-sources details{border-top:1px solid var(--line);padding-top:10px}.qgv-sources summary{cursor:pointer;line-height:2.4}.qgv-sources ul{padding-left:20px}
@media(max-width:600px){#qrator-guide{padding:26px 20px 44px}#qrator-guide h1{font-size:28px}.subhead{font-size:15px}.summary{padding:19px 17px}.summary-grid{grid-template-columns:1fr;gap:12px}.summary-grid>div+div{padding:12px 0 0;border-left:0;border-top:1px solid #dce3f0}.summary-grid>div{display:grid;grid-template-columns:90px 1fr;gap:2px 10px}.summary-grid em{grid-column:2}.toc{padding:18px}.article-section{padding:21px 0}.section-heading{gap:9px}#qrator-guide h2{font-size:20px}.qgv-promo{padding:23px 19px}.qgv-promo h2{font-size:21px}}
</style></head><body><article id="qrator-guide">
<header class="qge-header"><div class="eyebrow"><span class="tag">등기 가이드</span><span>큐레이터 실무 콘텐츠</span></div><h1>새 등기 가이드 제목</h1><p class="subhead">이 글에서 안내할 내용을 한두 문장으로 소개해 주세요.</p><div class="meta"><span>작성자 큐레이터</span><span class="meta-dot"></span><time>작성일 입력</time></div></header>
<div class="summary"><p class="summary-title">세 줄 요약</p><div class="summary-grid"><div><small>핵심 내용 1</small><strong>핵심 내용을 입력해 주세요</strong><em>독자가 기억할 기준을 간단히 정리해 주세요</em></div><div><small>핵심 내용 2</small><strong>먼저 확인할 내용을 입력해 주세요</strong><em>조건이나 예외 사항을 간단히 정리해 주세요</em></div><div><small>핵심 내용 3</small><strong>신청 준비 내용을 입력해 주세요</strong><em>기한이나 준비 순서를 간단히 정리해 주세요</em></div></div></div>
<nav class="toc"><h2>이 글의 목차</h2><ol><li><a href="#qgv-section-1">변경 내용을 먼저 확인해요</a></li><li><a href="#qgv-section-2">회사에서 결정할 내용을 정리해요</a></li><li><a href="#qgv-section-3">준비 서류와 절차를 살펴봐요</a></li><li><a href="#qgv-section-4">신청 기한과 비용을 확인해요</a></li><li><a href="#qgv-faq">자주 묻는 질문</a></li></ol></nav>
<section class="article-section" id="qgv-section-1"><div class="section-heading"><span class="section-num">01</span><h2>변경 내용을 먼저 확인해요</h2></div><p>어떤 변경이 필요한지, 현재 상태와 변경 후 내용을 비교해 설명해 주세요.</p><p>독자가 준비 전에 확인해야 할 기준과 예외 사항을 여기에 정리해 주세요.</p></section>
<section class="article-section" id="qgv-section-2"><div class="section-heading"><span class="section-num">02</span><h2>회사에서 결정할 내용을 정리해요</h2></div><p>정관, 이사회 또는 주주총회 등 회사의 의사결정 절차를 주제에 맞게 설명해 주세요.</p><div class="note"><p>확인 포인트나 실수하기 쉬운 내용을 짧게 강조해 주세요.</p></div></section>
<section class="article-section" id="qgv-section-3"><div class="section-heading"><span class="section-num">03</span><h2>준비 서류와 절차를 살펴봐요</h2></div><p>필요한 서류와 진행 순서를 단계별로 설명해 주세요.</p><div class="table-wrap"><table><thead><tr><th>구분</th><th>확인할 내용</th></tr></thead><tbody><tr><td>준비 항목</td><td>필요한 서류나 정보를 입력해 주세요</td></tr><tr><td>진행 순서</td><td>신청 전후 절차를 입력해 주세요</td></tr></tbody></table></div></section>
<section class="article-section" id="qgv-section-4"><div class="section-heading"><span class="section-num">04</span><h2>신청 기한과 비용을 확인해요</h2></div><p>기한 계산 기준, 등록면허세 등 비용과 납부 시점을 정확한 근거와 함께 작성해 주세요.</p><div class="note"><p>법령이나 회사 상황에 따라 달라질 수 있는 부분을 안내해 주세요.</p></div></section>
<section class="qgv-faq" id="qgv-faq"><h2>자주 묻는 질문</h2><details><summary>어떤 경우에 이 등기를 신청하나요?</summary><p>질문에 대한 답변을 간단하고 정확하게 작성해 주세요.</p></details><details><summary>신청 전에 무엇을 확인해야 하나요?</summary><p>필요한 확인 사항과 예외를 작성해 주세요.</p></details><details><summary>신청 기한은 언제까지인가요?</summary><p>기산일과 기한을 근거에 맞춰 작성해 주세요.</p></details></section>
<section class="qgv-bridge"><h2>등기 준비의 핵심</h2><p>이 글의 핵심을 한 문장으로 정리해 주세요.</p></section>
<aside class="qgv-promo"><span class="qgv-brand">Qrator.</span><h2>큐레이터에서 변경등기를 준비해 보세요</h2><p>변경 내용을 입력하고 안내에 따라 서류를 준비하는 방법을 간단히 소개해 주세요.</p><a class="qgv-apply" href="/">큐레이터 이용 안내 <span aria-hidden="true"> →</span></a></aside>
<div class="qgv-sources"><p>이 글은 일반적인 안내이며, 회사 형태와 구체적인 사실관계에 따라 절차가 달라질 수 있습니다. 법령과 공식 자료의 최신 내용을 확인해 주세요.</p><details><summary>참고 법령 및 공식 자료</summary><ul><li>참고 법령·공식 자료 이름과 URL을 입력해 주세요.</li></ul></details></div>
</article></body></html>`;
function recordFromForm(){
 const r=clone(state.current);
 r.title=$('editTitle').value.trim();r.category=$('editCategory').value;r.author=$('editAuthor').value;r.summary=$('editSummary').value;r.slug=$('editSlug').value.trim();r.tags=$('editTags').value.split(',').map(x=>x.trim()).filter(Boolean);r.status=$('editStatus').value;
 r.scheduledAt=$('editSchedule').value?new Date($('editSchedule').value+':00+09:00').toISOString():null;
 r.note=$('editNote').value;r.sourceUrls=$('editSources').value.split('\n').map(x=>x.trim()).filter(Boolean);r.reviewStatus=$('editReviewStatus').value;r.seoTitle=$('seoTitle').value||r.title;r.seoDescription=$('seoDescription').value||r.summary;
 if(state.mode==='code')r.html=$('htmlEditor').value;else if(state.editorReady)r.html=editedHTML($('visualEditor').contentDocument,r);
 return r;
}
function loadVisual(){
 state.editorReady=false;
 $('visualEditor').onload=()=>{
  try{
   const doc=$('visualEditor').contentDocument;
   doc.body.contentEditable=state.mode==='visual'?'true':'false';
   doc.body.spellcheck=false;
   if(state.mode==='text'){
    const excluded='script,style,noscript,svg,math,iframe,object,embed,canvas,video,audio,img,picture,source,input,textarea,select,option,button';
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
 if(!ensureLeave())return;fillEditor({slug:'',title:'',category:CATEGORIES[0],summary:'',tags:[],html:starterHTML,entryPath:'index.html',assets:[],author:state.user.name,status:'draft',reviewStatus:'pending',scheduledAt:null,note:'',sourceUrls:[],verification:'',history:[]},'text');
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
$('editorForm').onsubmit=e=>e.preventDefault();$('editorForm').oninput=e=>{markDirty();if(e.target.id==='editTitle')$('titleLength').textContent=e.target.value.length+' / 100';};
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
 for(const file of e.target.files){if(file.size>2000000)throw new Error('첨부 파일은 2MB 이내로 올려 주세요.');const path=(state.current.entryPath.split('/').slice(0,-1).join('/')?state.current.entryPath.split('/').slice(0,-1).join('/')+'/':'')+'assets/'+file.name.replace(/[\\/:]/g,'-');
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

