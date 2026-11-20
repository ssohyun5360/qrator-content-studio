// 원고 코드 검사 (ruleVersion v1). 기준값은 rules/v1/fixed.json·banned.json 에서 읽는다.
// article 은 30_출력스키마.json 의 원고 JSON. 결과: {pass:[], warn:[], fail:[]}, 각 항목 {id,label,detail}.
import fixed from './rules/v1/fixed.json' with {type:'json'};
import banned from './rules/v1/banned.json' with {type:'json'};

export const RULE_VERSION=fixed.ruleVersion;
export const MAX_AUTO_FIX=fixed.limits.maxAutoFix;
export const FIXED=fixed;
const L=fixed.limits;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const arr=v=>Array.isArray(v)?v:[];
const str=v=>typeof v==='string'?v:'';
const plain=s=>str(s).replace(/<[^>]+>/g,'');
const clip=(s,n=40)=>{const t=plain(s).replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n)+'…':t;};
const countOf=(s,sub)=>str(s).split(sub).length-1;

export function kstDate(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date);
 const get=t=>Number(parts.find(x=>x.type===t).value);
 return {y:get('year'),m:get('month'),d:get('day')};
}
export function formatDateTxt(date=new Date()){const {y,m,d}=kstDate(date);return `${y}. ${m}. ${d}.`;}
export function buildDisclaimer(date=new Date()){return fixed.disclaimer.template.replace('{{DATE_TXT}}',formatDateTxt(date));}

// 문자열 필드 수집. kind: prose(본문 문장) | table(표 셀) | label(제목·목차) — 글자 수·합니다체 검사 범위가 다르다.
function collect(a){
 const items=[];
 const add=(kind,field,text)=>{if(typeof text==='string')items.push({kind,field,text});};
 arr(a.intro).forEach((t,i)=>add('prose',`intro[${i}]`,t));
 add('prose','conclusion',a.conclusion);
 arr(a.threeLineSummary).forEach((t,i)=>add('prose',`threeLineSummary[${i}]`,t));
 arr(a.sections).forEach((s,i)=>{
  if(!s||typeof s!=='object')return;
  add('label',`sections[${i}].h2`,s.h2);add('label',`sections[${i}].tocLabel`,s.tocLabel);
  add('prose',`sections[${i}].lead`,s.lead);
  arr(s.paragraphs).forEach((t,j)=>add('prose',`sections[${i}].paragraphs[${j}]`,t));
  arr(s.tips).forEach((t,j)=>add('prose',`sections[${i}].tips[${j}]`,t));
  arr(s.checks).forEach((c,j)=>{add('prose',`sections[${i}].checks[${j}].title`,c?.title);add('prose',`sections[${i}].checks[${j}].text`,c?.text);});
  if(s.table){arr(s.table.header).forEach((t,j)=>add('table',`sections[${i}].table.header[${j}]`,t));arr(s.table.rows).forEach((r,j)=>arr(r).forEach((t,k)=>add('table',`sections[${i}].table.rows[${j}][${k}]`,t)));}
 });
 arr(a.faq).forEach((f,i)=>{if(!f||typeof f!=='object')return;add('prose',`faq[${i}].q`,f.q);arr(f.answer).forEach((t,j)=>add('prose',`faq[${i}].answer[${j}]`,t));});
 add('prose','closingLine',a.closingLine);
 if(a.bridge&&typeof a.bridge==='object'){add('label','bridge.h2',a.bridge.h2);arr(a.bridge.paragraphs).forEach((t,i)=>add('prose',`bridge.paragraphs[${i}]`,t));}
 return items;
}

export function countBodyChars(article){
 const texts=collect(article||{}).filter(x=>x.kind==='prose').map(x=>plain(x.text));
 return texts.join('\n').length;
}

function bigrams(s){const t=s.replace(/[\s\p{P}]/gu,'').toLowerCase();const out=new Map();for(let i=0;i<t.length-1;i++){const g=t.slice(i,i+2);out.set(g,(out.get(g)||0)+1);}return out;}
function dice(a,b){
 const x=bigrams(a),y=bigrams(b);let inter=0,sx=0,sy=0;
 for(const v of x.values())sx+=v;for(const v of y.values())sy+=v;
 for(const [k,v] of x)inter+=Math.min(v,y.get(k)||0);
 return sx+sy?2*inter/(sx+sy):0;
}
const normTitle=s=>plain(s).replace(/[\s\p{P}]/gu,'').toLowerCase();

export function checkArticle(article,{today=new Date(),lawFacts=null,existingTitles=null,existingSlugs=null}={}){
 const out={pass:[],warn:[],fail:[]};
 const add=(level,id,label,detail='')=>out[level].push({id,label,detail});
 const check=(ok,level,id,label,detail='')=>{ok?add('pass',id,label,detail):add(level,id,label,detail);return ok;};

 if(!article||typeof article!=='object'||Array.isArray(article)){add('fail','schema.object','원고가 JSON 객체여야 함');return out;}
 const a=article;
 const sections=arr(a.sections).filter(s=>s&&typeof s==='object');
 const faq=arr(a.faq).filter(f=>f&&typeof f==='object');
 const items=collect(a);
 const prose=items.filter(x=>x.kind==='prose');
 const allText=items.map(x=>x.text);
 const title=str(a.title);

 // ── 메타·길이
 check(!!title.trim()&&!!str(a.summary).trim(),'fail','meta.required','제목·요약이 있음');
 const tl=[...title].length;
 check(tl>=L.titleMin&&tl<=L.titleMax,'warn','length.title',`제목 ${L.titleMin}~${L.titleMax}자`,`${tl}자`);
 const ts=fixed.titleStyle,tt=title.trim();
 check(!new RegExp(ts.bannedPattern).test(tt),'fail','title.style','홈페이지 제목은 정보성 명사형(물음표·느낌표·"~요" 종결 금지)',tt);
 check(ts.suffixes.some(s=>tt.endsWith(s)),'warn','title.suffix',`제목은 ${ts.suffixes.slice(0,6).join('·')} 등 명사로 끝맺기`,tt);
 const over=[['title',title,L.studioTitleMax],['seoTitle',str(a.seoTitle),L.studioSeoTitleMax],['seoDescription',str(a.seoDescription),L.studioSeoDescriptionMax],['summary',str(a.summary),L.studioSummaryMax]].filter(([,v,m])=>[...v].length>m).map(([k,,m])=>`${k} ${m}자 초과`);
 check(!over.length,'fail','meta.studio-limits','스튜디오 길이 제한(제목·SEO·요약)',over.join(', '));
 check(fixed.categories.includes(a.category),'fail','meta.category','카테고리가 허용 목록 안',`'${str(a.category)}'`);
 const cands=arr(a.slugCandidates);
 const slugBad=cands.filter(s=>typeof s!=='string'||s.length>L.slugMax||!SLUG.test(s));
 check(cands.length>=1&&cands.length<=L.slugCandidatesMax&&!slugBad.length,'fail','meta.slug',`slug 후보 1~${L.slugCandidatesMax}개·형식(영문 소문자·숫자·하이픈, ${L.slugMax}자 이하)`,slugBad.map(String).join(', ')||`${cands.length}개`);
 if(Array.isArray(existingSlugs)){
  const taken=new Set(existingSlugs);
  check(cands.some(s=>!taken.has(s)),'fail','meta.slug-free','기존 slug와 겹치지 않는 후보가 있음');
 }
 const tags=arr(a.tags);
 const tagBad=tags.filter(t=>typeof t!=='string'||!t||/[#\s]/.test(t));
 check(tags.length>=L.tagsMin&&tags.length<=L.tagsMax&&!tagBad.length,'fail','meta.tags',`태그 ${L.tagsMin}~${L.tagsMax}개(공백·# 없음)`,`${tags.length}개${tagBad.length?` · 형식 오류: ${tagBad.slice(0,3).join(', ')}`:''}`);
 const th=a.thumbnail&&typeof a.thumbnail==='object'?a.thumbnail:{};
 check(fixed.thumbnailLine1.includes(th.line1)&&!!str(th.line2).trim(),'fail','meta.thumbnail','썸네일 1줄은 고정 5종, 2줄은 비어 있지 않음',`${str(th.line1)} / ${str(th.line2)}`);
 check([...str(th.line2)].length<=L.thumbnailLine2Max,'warn','meta.thumbnail-width',`썸네일 2줄 ${L.thumbnailLine2Max}자 이내(폭 960px 한계)`,`${[...str(th.line2)].length}자`);

 // ── 구조
 check(sections.length>=L.sectionsMin&&sections.length<=L.sectionsMax,'fail','structure.sections-count',`본문 섹션 ${L.sectionsMin}~${L.sectionsMax}개(FAQ 포함 H2 ${L.sectionsMin+1}~${L.sectionsMax+1}개)`,`${sections.length}개`);
 const h2Bad=sections.filter(s=>/^\s*\d+\s*[.)]/.test(str(s.h2)));
 check(!h2Bad.length&&sections.every(s=>str(s.h2).trim()),'fail','structure.h2-number','섹션 제목에 번호를 붙이지 않음(번호는 렌더러가 부여)',h2Bad.map(s=>clip(s.h2)).join(' / '));
 const h2NoQ=sections.filter(s=>!str(s.h2).trim().endsWith('?'));
 check(!h2NoQ.length,'warn','structure.h2-question','섹션 제목이 질문형(?)',h2NoQ.map(s=>clip(s.h2)).join(' / '));
 check(sections.every(s=>str(s.tocLabel).trim()&&str(s.lead).trim()&&arr(s.paragraphs).length>=2),'fail','structure.section-parts','섹션마다 tocLabel·lead·본문 2개 이상');
 const intro=arr(a.intro);
 check(intro.length>=L.introMin&&intro.length<=L.introMax&&intro.every(t=>str(t).trim()),'fail','structure.intro-count',`도입 ${L.introMin}~${L.introMax}문장`,`${intro.length}개`);
 check(str(a.conclusion).trim().startsWith(fixed.conclusionPrefix),'fail','structure.conclusion',`결론이 '${fixed.conclusionPrefix}'로 시작`,clip(a.conclusion,24));
 const three=arr(a.threeLineSummary);
 check(three.length===L.threeLine&&three.every(t=>str(t).trim()),'fail','structure.three-line',`세 줄 요약 정확히 ${L.threeLine}개`,`${three.length}개`);
 check(str(a.closingLine).trim().startsWith(fixed.closingPrefix),'warn','structure.closing',`마무리 문장이 '${fixed.closingPrefix}'로 시작`,clip(a.closingLine,24));
 const tables=sections.filter(s=>s.table&&typeof s.table==='object');
 check(tables.length>=L.tablesMin,'fail','structure.tables-min',`표 ${L.tablesMin}개 이상`,`${tables.length}개`);
 check(tables.length<L.tablesMin||tables.length>=2,'warn','structure.tables-spread','표가 2개 이상의 섹션에 분산',`${tables.length}개 섹션`);
 const tableBad=tables.filter(s=>{const h=arr(s.table.header),r=arr(s.table.rows);return h.length!==2||!r.length||r.some(x=>!Array.isArray(x)||x.length!==2)||[...h,...r.flat()].some(c=>!str(c).trim());});
 check(!tableBad.length,'fail','structure.table-shape','표는 2열·모든 행 길이 일치·빈 셀 없음',tableBad.map(s=>clip(s.h2,20)).join(' / '));
 check(faq.length>=L.faqMin&&faq.length<=L.faqMax&&faq.every(f=>str(f.q).trim()&&arr(f.answer).length>=1),'fail','structure.faq-count',`FAQ ${L.faqMin}~${L.faqMax}개`,`${faq.length}개`);
 const faqStart=faq.filter(f=>!fixed.faqAnswerStarts.some(p=>str(arr(f.answer)[0]).startsWith(p)));
 check(!faqStart.length,'warn','structure.faq-answer-start',`FAQ 답변이 ${fixed.faqAnswerStarts.map(s=>`'${s}'`).join(' 또는 ')}로 시작`,faqStart.map(f=>clip(f.q,20)).join(' / '));
 const tips=sections.flatMap(s=>arr(s.tips));
 check(tips.length>=L.tipsMin&&tips.length<=L.tipsMax,'fail','structure.tips-count',`팁 ${L.tipsMin}~${L.tipsMax}개`,`${tips.length}개`);
 const tipBad=tips.filter(t=>!str(t).startsWith(fixed.tipPrefix));
 check(!tipBad.length,'fail','structure.tips-prefix',`팁 문장이 '${fixed.tipPrefix}'로 시작`,tipBad.map(t=>clip(t,16)).join(' / '));
 const checks=sections.flatMap(s=>arr(s.checks));
 check(checks.length>=L.checksMin,'warn','structure.checks-min',`✅ 항목 ${L.checksMin}개 이상(홈페이지 렌더링 방식 확정 전)`,`${checks.length}개`);
 const need=Math.max(2,sections.length+1-2);
 const withRefs=sections.filter(s=>arr(s.sourceRefs).length>0).length;
 const refsOver=sections.filter(s=>arr(s.sourceRefs).length>L.sourceRefsPerSectionMax);
 check(withRefs>=need&&!refsOver.length,'fail','structure.source-refs',`근거(sourceRefs)가 있는 섹션 ${need}개 이상·섹션당 ${L.sourceRefsPerSectionMax}개 이하`,`${withRefs}/${sections.length}개 섹션`);
 const bridge=a.bridge&&typeof a.bridge==='object'?a.bridge:{};
 const links=arr(bridge.linkTitles);
 const bridgeOk=str(bridge.h2).trim()&&arr(bridge.paragraphs).length>=1&&arr(bridge.paragraphs).length<=L.bridgeParagraphsMax&&links.length<=L.bridgeLinksMax&&(!Array.isArray(existingTitles)||links.every(t=>existingTitles.includes(t)));
 check(!!bridgeOk,'warn','structure.bridge',`이어 읽기: 문단 1~${L.bridgeParagraphsMax}개·링크 ${L.bridgeLinksMax}개 이하${Array.isArray(existingTitles)?'·기존 글 제목과 일치':''}`);

 // ── 분량·서식
 const chars=countBodyChars(a);
 check(chars>=L.charsMin,'warn','length.chars',`본문 글자 수 ${L.charsMin.toLocaleString('ko-KR')}자 이상`,`${chars}자`);
 const longP=prose.filter(x=>!x.field.endsWith('.title')&&[...plain(x.text)].length>L.maxParagraphChars);
 check(!longP.length,'warn','length.paragraph',`한 문장·한 줄 원칙(항목당 ${L.maxParagraphChars}자 이하)`,longP.slice(0,2).map(x=>`${x.field} ${[...plain(x.text)].length}자`).join(', '));
 const boldCount=allText.reduce((n,t)=>n+countOf(t,'<b>'),0);
 check(boldCount>=L.boldMin,'warn','style.bold-count',`굵게(<b>) ${L.boldMin}회 이상`,`${boldCount}회`);
 const tagRe=/<(\/?)([a-zA-Z][^>\s]*)[^>]*>/g;
 const badTags=new Set(),stray=[];
 for(const x of items){
  for(const m of x.text.matchAll(tagRe))if(!fixed.allowedInlineTags.includes(m[2].toLowerCase())||/\s/.test(m[0].slice(1,-1)))badTags.add(m[0]);
  if(/[<>]/.test(x.text.replace(/<\/?(?:b|u|i)>/g,'')))stray.push(x.field);
 }
 const unbalanced=fixed.allowedInlineTags.filter(t=>allText.some(s=>countOf(s,`<${t}>`)!==countOf(s,`</${t}>`)));
 check(!badTags.size&&!stray.length&&!unbalanced.length,'fail','style.allowed-tags','허용 태그(<b><u><i>)만 사용하고 모두 닫음',[...badTags].slice(0,3).join(' ')||(stray.length?`< > 문자: ${stray[0]}`:unbalanced.length?`안 닫힌 태그: ${unbalanced.join(',')}`:''));
 const keep=new RegExp(`[${fixed.allowedEmoji.join('')}]`,'gu');
 const emojiHit=prose.filter(x=>/\p{Extended_Pictographic}/u.test(x.text.replace(keep,'')));
 check(!emojiHit.length,'warn','style.emoji','허용 이모지(💡 ✅) 외 이모지 없음',emojiHit.slice(0,2).map(x=>x.field).join(', '));

 // ── 표기·문체 (태그·slug 제외한 제목+본문+표+소제목)
 const joined=[title,...allText.map(plain)].join('\n');
 const hitWords=[...banned.forbiddenWords,...banned.operatorNames].filter(w=>joined.includes(w));
 check(!hitWords.length,'fail','style.forbidden-words','금지어 없음(법인설립·설립등기·귀사·당사·운영사 이름)',hitWords.join(', '));
 check(!new RegExp(`[${banned.curlyQuotes}]`).test(joined),'fail','style.curly-quotes','곡선 따옴표 없음(직선 따옴표만)');
 const spacing=banned.forbiddenSpacing.filter(w=>joined.includes(w));
 check(!spacing.length,'fail','style.spacing',"'변경 등기'·'이전 등기'는 띄어 씀",spacing.join(', '));
 const endRe=new RegExp(`(?:${banned.hapnidaEndings.join('|')})[.!?]?$`);
 const hap=prose.flatMap(x=>plain(x.text).split(/(?<=[.?!])\s+|\n/).map(s=>s.trim()).filter(s=>endRe.test(s)).map(s=>`${x.field}: ${clip(s,24)}`));
 check(!hap.length,'fail','style.hapnida','본문 합니다체 없음(해요체)',hap.slice(0,2).join(' | '));
 const exFail=banned.exaggeration.fail.filter(w=>joined.includes(w));
 check(!exFail.length,'fail','style.exaggeration','과장·단정 표현 없음',exFail.join(', '));
 const exWarn=banned.exaggeration.warn.filter(w=>joined.includes(w)&&!exFail.some(f=>f.includes(w)));
 check(!exWarn.length,'warn','style.exaggeration-review','과장 가능성 표현 확인',exWarn.join(', '));
 const scFail=banned.serviceScope.fail.filter(w=>joined.includes(w));
 check(!scFail.length,'fail','style.service-scope','서비스 범위 위반 표현 없음(대행·대리 신청·법률 자문)',scFail.join(', '));
 const scWarn=banned.serviceScope.warn.filter(w=>joined.includes(w)&&!scFail.some(f=>f.includes(w)));
 check(!scWarn.length,'warn','style.service-scope-review','대리·대행·법률 자문 언급 확인',scWarn.join(', '));
 check(!joined.includes('설립'),'warn','style.founding-mention','설립 관련 서술 점검(설립은 다루지 않음)');

 // ── 고정문 (모델이 쓰지 않음. 서버 삽입 결과가 주어지면 비교)
 const wrote=fixed.modelMustNotWrite.filter(p=>joined.includes(p));
 check(!wrote.length,'fail','fixed.no-model-fixed-text','고정 문구(면책·CTA)를 모델이 쓰지 않음',wrote.map(p=>clip(p,18)).join(' / '));
 if(a.disclaimer!==undefined)check(a.disclaimer===buildDisclaimer(today),'fail','fixed.disclaimer',`면책 문구가 고정본과 일치(작성일 ${formatDateTxt(today)})`);
 if(a.cta!==undefined)check(JSON.stringify(arr(a.cta))===JSON.stringify(fixed.naver.ctaLines),'fail','fixed.cta','CTA 문구·줄 구성이 고정본과 일치');
 if(a.oglinkUrl!==undefined)check(a.oglinkUrl===fixed.naver.oglinkUrl,'fail','fixed.oglink','링크카드 UTM 주소 일치');

 // ── 중복 주제
 if(Array.isArray(existingTitles)&&title){
  const mine=normTitle(title);
  let best={score:0,title:''};
  for(const t of existingTitles){const n=normTitle(t);const score=n===mine?1:dice(mine,n);if(score>best.score)best={score,title:t};}
  if(best.score>=1)add('fail','dup.title','기존 글과 제목이 같음',clip(best.title,40));
  else if(best.score>=L.titleSimilarityWarn)add('warn','dup.title','기존 글과 제목이 비슷함(유사 주제 확인)',`${clip(best.title,40)} (${best.score.toFixed(2)})`);
  else add('pass','dup.title','기존 글과 제목 중복 없음');
 }

 // ── 근거·사람 검토
 const refs=[...sections.flatMap(s=>arr(s.sourceRefs)),...faq.flatMap(f=>arr(f.sourceRefs))].filter(k=>typeof k==='string');
 const notes=arr(a.reviewNotes).filter(n=>n&&typeof n==='object');
 const noteBad=notes.filter(n=>!fixed.reviewStatuses.includes(n.status)||!str(n.text).trim());
 check(!noteBad.length,'fail','review.status','reviewNotes 형식(status·text)');
 check(!refs.length||notes.length>0,'warn','review.notes','근거를 쓴 글에 reviewNotes가 있음');
 if(Array.isArray(lawFacts)){
  const byKey=new Map(lawFacts.map(f=>[f.key,f]));
  const used=new Set([...refs,...arr(a.usedLawKeys).filter(k=>typeof k==='string')]);
  const unknown=[...used].filter(k=>!byKey.has(k));
  check(!unknown.length,'fail','law.refs-exist','인용한 근거가 법령 근거 사전에 모두 있음',unknown.slice(0,3).join(', '));
  const declared=new Set(arr(a.usedLawKeys));
  const undeclared=[...new Set(refs)].filter(k=>!declared.has(k));
  check(!undeclared.length,'warn','law.used-keys','usedLawKeys가 sourceRefs와 일치',undeclared.slice(0,3).join(', '));
  const unverified=[...new Set(refs)].filter(k=>byKey.has(k)&&byKey.get(k).verified===false);
  const flagged=new Set(notes.filter(n=>n.status==='needs_human').flatMap(n=>arr(n.lawKeys)));
  const missing=unverified.filter(k=>!flagged.has(k));
  check(!missing.length,'fail','law.needs-human','미확인(verified:false) 근거에 needs_human 검토 표시가 있음',missing.slice(0,3).join(', '));
 }
 if(refs.length)add('warn','law.human-confirm','법령 참고 링크는 사람이 열려 있는지 확인 필요(검토 전)',`근거 ${new Set(refs).size}건`);

 // ── 사실 검토가 필요한 문장 추출 (기한·금액·조문·과태료)
 const patterns=fixed.factPatterns.map(p=>new RegExp(p,'u'));
 const factHits=[];
 for(const x of prose){for(const s of plain(x.text).split(/(?<=[.?!])\s+/)){if(patterns.some(re=>re.test(s)))factHits.push(clip(s,50));}}
 if(factHits.length)add('warn','fact.sentences',`사실 확인이 필요한 문장 ${factHits.length}개(기한·금액·조문)`,factHits.slice(0,fixed.factReviewMaxItems).join(' | '));
 else add('pass','fact.sentences','사실 확인이 필요한 수치·조문 문장 없음');

 return out;
}

// 화면 표시·aiReview 저장용(작은 객체)
export function summarizeChecks(result){
 const ids=l=>arr(result?.[l]).map(x=>x.id).slice(0,12);
 const passed=arr(result?.pass).length,needsReview=arr(result?.warn).length,blocked=arr(result?.fail).length;
 return {ruleVersion:RULE_VERSION,total:passed+needsReview+blocked,passed,needsReview,blocked,failedIds:ids('fail'),warnIds:ids('warn')};
}

// 자동 수정 요청(feedback)용: 실패 항목만, 경고는 별도 표시
export function feedbackFor(result){
 const fmt=x=>`[${x.id}] ${x.label}${x.detail?` — ${x.detail}`:''}`;
 return {fix:arr(result?.fail).map(fmt),review:arr(result?.warn).map(fmt)};
}
export function canAutoFix(result,attempt){return arr(result?.fail).length>0&&attempt<MAX_AUTO_FIX;}
