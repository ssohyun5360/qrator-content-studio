// 홈페이지 글 HTML 조립. 구조 기준: 실제 발행 원본(홈페이지_원본/1103_html)의 '블로그 › 카테고리' 형식
// (business-purpose-vs-business-registration, company-name-duplicate-check) = 작업실_ZIP_규격.md 와 같은 형식.
// 모델 출력은 모두 이스케이프하고 인라인 서식은 strong/em/u/br 만 통과시킨다. 고정문(promo·면책)은 코드 상수.
import {formatCss} from '../format.mjs';

export const HOME_CSS = `@font-face{font-family:"Qrator Pretendard";src:url("./assets/PretendardVariable.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}
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
`;

const DISCLAIMER_TEMPLATE='이 글은 법인등기 절차에 관한 일반적인 안내로, 특정 회사의 사안에 대한 법률 자문이나 등기 상담이 아닙니다. 필요한 서류와 절차는 회사의 정관과 결의 방식에 따라 달라질 수 있고, 등기 기한을 넘기면 과태료가 부과될 수 있으니 기한은 꼭 확인해 주세요. 이 글은 작성일 {{DATE_TXT}} 기준이며 법령 개정에 따라 내용이 달라질 수 있습니다. 빅테크플러스는 법률사무소나 법무사사무소가 아니며, 큐레이터는 신청인이 직접 등기를 신청할 수 있도록 서류 작성을 돕는 소프트웨어입니다. 개별 사안은 변호사나 법무사에게 확인하시기 바랍니다.';
const APPLY_HREF='https://www.qrator.kr/registration/select-items';
const SERVICE_STEPS=['변경 내용 입력','서류 자동 작성','신청인이 직접 신청'];
const GENERIC_PROMO={
 h3:'변경등기 서류 준비, 큐레이터에서 시작해 보세요',
 p:'큐레이터에서 진행할 수 있는 변경 항목을 살펴보세요. 해당하는 항목을 선택해 필요한 내용을 입력하고, 자동으로 작성된 서류를 확인한 뒤 신청인이 직접 등기를 신청해요.',
 button:'변경등기 항목 확인하기',code:null
};
// 확인됨: 상호 변경·목적 변경·본점 이전(원본 HTML). 임원 변경·지점 변경은 전용 문구·코드가 원본에 없어 공통 문구 사용(확인 필요).
export const PROMO_BY_CATEGORY={
 '상호 변경':{h3:'큐레이터에서 상호 검사부터 서류 준비까지',p:'큐레이터에서는 상호 중복·유의 상호 여부를 확인하고 변경 서류를 준비할 수 있어요. 자동으로 작성된 서류의 내용을 확인한 뒤, 신청인이 직접 등기를 신청해요.',button:'상호 변경 서류 준비하기',code:'company-name-change'},
 '본점 이전':{h3:'본점 이전등기 서류, 큐레이터에서 준비해 보세요',p:'큐레이터에서는 본점 이전에 필요한 내용을 입력하고 서류를 준비할 수 있어요. 자동으로 작성된 서류의 내용을 확인한 뒤, 신청인이 직접 등기를 신청해요.',button:'본점 이전 서류 준비하기',code:'head-office-relocation'},
 '목적 변경':{h3:'정리한 목적 변경 내용으로 서류를 준비해 보세요',p:'큐레이터에서는 목적 변경에 필요한 내용을 입력하고 서류를 준비할 수 있어요. 자동으로 작성된 서류의 내용을 확인한 뒤, 신청인이 직접 등기를 신청해요.',button:'목적 변경 서류 준비하기',code:'business-purpose-change'},
 '임원 변경':GENERIC_PROMO,
 '지점 변경':GENERIC_PROMO
};
export const REQUIRED_FIELDS=['title','category','summary','intro','conclusion','threeLineSummary','sections','faq'];

const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const INLINE_TAG=/(<\/?(?:b|strong|i|em|u)\s*>|<br\s*\/?>)/i;
const TAG_NAME={b:'strong',strong:'strong',i:'em',em:'em',u:'u'};

// 허용 태그(b/strong/i/em/u/br)만 남기고 나머지는 글자 그대로 이스케이프. 닫히지 않은 태그는 자동으로 닫는다.
export function inline(input){
 const out=[],stack=[];
 for(const part of String(input??'').split(INLINE_TAG)){
  const tag=/^<(\/?)(b|strong|i|em|u)\s*>$/i.exec(part);
  if(tag){
   const name=TAG_NAME[tag[2].toLowerCase()];
   if(!tag[1]){stack.push(name);out.push('<'+name+'>');}
   else if(stack[stack.length-1]===name){stack.pop();out.push('</'+name+'>');}
   continue;
  }
  if(/^<br\s*\/?>$/i.test(part)){out.push('<br>');continue;}
  out.push(esc(part));
 }
 while(stack.length)out.push('</'+stack.pop()+'>');
 return out.join('');
}

const safeUrl=u=>typeof u==='string'&&/^https:\/\/[^\s"'<>]+$/.test(u)?u:null;
const safeHref=u=>typeof u==='string'&&(/^\.\/[A-Za-z0-9._-]+\.html$/.test(u)||/^https:\/\/[^\s"'<>]+$/.test(u))?u:null;

function kstParts(date){
 const k=new Date(date.getTime()+9*3600*1000);
 return {y:k.getUTCFullYear(),m:k.getUTCMonth()+1,d:k.getUTCDate()};
}

function refHtml(key,laws,needsCheck){
 const entry=laws?.[key];
 if(!entry){needsCheck.add(key);return `<span data-needs-check="true">${esc(key)}</span>`;}
 const label=esc([entry.lawName,entry.article].filter(Boolean).join(' '));
 const url=safeUrl(entry.url);
 if(url)return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
 needsCheck.add(key);
 return `<span data-needs-check="true">${label}</span>`;
}
function sourceParagraph(keys,laws,needsCheck){
 const list=[...new Set((keys||[]).filter(k=>typeof k==='string'))];
 return list.length?`<p class="source">참고: ${list.map(k=>refHtml(k,laws,needsCheck)).join(' · ')}</p>`:'';
}

function validate(article){
 if(!article||typeof article!=='object')throw new Error('원고가 없습니다.');
 const missing=REQUIRED_FIELDS.filter(k=>article[k]===undefined||article[k]===null||article[k]==='');
 if(missing.length)throw new Error('원고 필수 항목이 없습니다: '+missing.join(', '));
 if(!Array.isArray(article.threeLineSummary)||article.threeLineSummary.length!==3)throw new Error('세 줄 요약은 3개여야 합니다.');
 if(!Array.isArray(article.sections)||!article.sections.length)throw new Error('본문 섹션이 없습니다.');
 if(!Array.isArray(article.faq)||!article.faq.length)throw new Error('자주 묻는 질문이 없습니다.');
 if(!Array.isArray(article.intro)||!article.intro.length)throw new Error('도입 문단이 없습니다.');
}

function renderSection(s,i,laws,needsCheck){
 const n=i+1;
 const parts=[`<section class="article-section" id="qbv-section-${n}" aria-labelledby="heading-${n}">`,`<h2 id="heading-${n}">${n}. ${esc(s.h2)}</h2>`];
 if(s.lead)parts.push(`<p><strong>${inline(s.lead)}</strong></p>`);
 const paragraphs=Array.isArray(s.paragraphs)?s.paragraphs:[];
 const table=s.table&&Array.isArray(s.table.header)&&Array.isArray(s.table.rows)?s.table:null;
 paragraphs.forEach((p,idx)=>{
  parts.push(`<p>${inline(p)}</p>`);
  if(idx===0&&table){
   const head=table.header.map(h=>`<th scope="col">${inline(h)}</th>`).join('');
   const rows=table.rows.map(r=>`<tr><th scope="row">${inline(r[0])}</th>${r.slice(1).map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('\n');
   parts.push(`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>\n${rows}\n</tbody></table></div>`);
  }
 });
 if(table&&!paragraphs.length)parts.push('');
 for(const c of s.checks||[])parts.push(`<p><strong>✅ ${inline(c.title)}</strong><br>${inline(c.text)}</p>`);
 for(const tip of s.tips||[]){
  const m=/^(💡\s*Tip\.)\s*(.*)$/s.exec(String(tip));
  parts.push(m?`<aside class="note"><strong>${esc(m[1])}</strong> ${inline(m[2])}</aside>`:`<aside class="note">${inline(tip)}</aside>`);
 }
 const src=sourceParagraph(s.sourceRefs,laws,needsCheck);
 if(src)parts.push(src);
 parts.push('</section>');
 return parts.join('\n');
}

function renderFaq(faq,laws,needsCheck){
 const items=faq.map(f=>{
  const answer=(f.answer||[]).map(a=>`<p>${inline(a)}</p>`).join('');
  return `<details><summary>${inline(f.q)}</summary>${answer}${sourceParagraph(f.sourceRefs,laws,needsCheck)}</details>`;
 });
 return `<section class="qbv-faq" id="qbv-faq" aria-labelledby="faq-title">\n<h2 id="faq-title">자주 묻는 질문</h2>\n${items.join('\n')}\n</section>`;
}

function renderBridge(bridge,bridgeLinks){
 if(!bridge||!bridge.h2)return '';
 const paragraphs=(bridge.paragraphs||[]).map(p=>`<p>${inline(p)}</p>`);
 const links=(bridge.linkTitles||[]).map(t=>({title:t,href:safeHref(bridgeLinks?.[t])})).filter(l=>l.href);
 if(links.length)paragraphs.push(`<p>이어서 보면 좋은 글: ${links.map(l=>`<a href="${esc(l.href)}">${esc(l.title)}</a>`).join(' · ')}</p>`);
 return `<section class="qbv-bridge">\n<h2>${inline(bridge.h2)}</h2>\n${paragraphs.join('\n')}\n</section>`;
}

function renderPromo(category){
 const p=PROMO_BY_CATEGORY[category]||GENERIC_PROMO;
 const code=p.code?` data-qrator-apply="${esc(p.code)}"`:'';
 return `<aside class="qbv-promo" aria-label="큐레이터 서비스 소개">\n<img class="qbv-brand" src="./assets/qrator-logo.svg" width="99" height="24" alt="큐레이터">\n<h3>${esc(p.h3)}</h3>\n<p>${esc(p.p)}</p>\n<ol class="qbv-service-steps">${SERVICE_STEPS.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>\n<a class="qbv-apply" href="${APPLY_HREF}"${code}>${esc(p.button)} <span aria-hidden="true">→</span></a>\n</aside>`;
}

export function renderHomeArticleDetailed(article,{date,slug,coverPath='assets/thumbnail.svg',laws={},bridgeLinks={},format=null}={}){
 validate(article);
 if(!(date instanceof Date)||Number.isNaN(date.getTime()))throw new Error('작성일(date)이 올바르지 않습니다.');
 const {y,m,d}=kstParts(date);
 const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const dateTxt=`${y}. ${m}. ${d}.`;
 const needsCheck=new Set();
 const title=esc(article.title);
 const seoTitle=esc(article.seoTitle||article.title);
 const description=esc(article.seoDescription||article.summary);
 const cover=String(coverPath).replace(/^\.\//,'');
 const thumb=article.thumbnail||{};
 const coverAlt=thumb.line1||thumb.line2?`${thumb.line1||''} — ${thumb.line2||''}`.replace(/^ — | — $/g,''):article.title;
 const toc=[...article.sections.map((s,i)=>`<li><a href="#qbv-section-${i+1}">${inline(s.tocLabel||s.h2)}</a></li>`),'<li><a href="#qbv-faq">자주 묻는 질문</a></li>'].join('\n');
 const usedKeys=[...new Set([...(article.usedLawKeys||[]),...article.sections.flatMap(s=>s.sourceRefs||[]),...article.faq.flatMap(f=>f.sourceRefs||[])].filter(k=>typeof k==='string'))];
 const refList=usedKeys.length?`\n<details><summary>참고 법령 및 공식 자료</summary><ul>\n${usedKeys.map(k=>`<li>${refHtml(k,laws,needsCheck)}</li>`).join('\n')}\n</ul></details>`:'';
 const intro=[...article.intro,article.conclusion].map(p=>`<p>${inline(p)}</p>`).join('\n');
 const html=`<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | 큐레이터</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${seoTitle} | 큐레이터 등기가이드">
<meta property="og:description" content="${description}">
<meta property="og:type" content="article">
<style>
${HOME_CSS}${format?formatCss(format):''}</style></head>
<body style="margin:0;background:#fff">
<article id="qrator-blog" aria-labelledby="qbv-title">
<header>
<a class="qbx-back" href="./index.html">블로그 <span aria-hidden="true">›</span> ${esc(article.category)}</a>
<h1 id="qbv-title">${title}</h1>
<p class="subhead">${inline(article.summary)}</p>
<div class="qbe-author"><span class="qbe-avatar" aria-hidden="true">Q.</span><div>작성자 <strong>큐레이터</strong><time datetime="${iso}">작성일 ${iso}</time></div></div>
</header>
<figure class="qbe-cover"><img src="./${esc(cover)}" width="1280" height="720" alt="${esc(coverAlt)}" fetchpriority="high"></figure>
<div class="qbe-intro">
${intro}
</div>

<aside class="qbv-summary" aria-labelledby="qbv-summary-title">
<h2 id="qbv-summary-title">세 줄 요약</h2>
<ul>
${article.threeLineSummary.map(l=>`<li>${inline(l)}</li>`).join('\n')}
</ul>
</aside>

<nav class="qbv-toc" aria-labelledby="qbv-toc-title">
<h2 id="qbv-toc-title">이 글의 목차</h2>
<ol>
${toc}
</ol>
</nav>

${article.sections.map((s,i)=>renderSection(s,i,laws,needsCheck)).join('\n\n')}

${renderFaq(article.faq,laws,needsCheck)}

${renderBridge(article.bridge,bridgeLinks)}
${renderPromo(article.category)}
<footer class="qbv-sources">
<section class="qbv-disclosure" aria-labelledby="qbv-disclosure-title"><h2 id="qbv-disclosure-title">콘텐츠 이용 안내</h2><p>${esc(DISCLAIMER_TEMPLATE.replace('{{DATE_TXT}}',dateTxt))}</p></section>${refList}
</footer>
</article>
</body></html>
`;
 return {html,needsCheck:[...needsCheck],slug:slug||null};
}

export function renderHomeArticle(article,options){return renderHomeArticleDetailed(article,options).html;}
