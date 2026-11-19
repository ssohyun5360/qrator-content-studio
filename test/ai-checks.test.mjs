import test from 'node:test';
import assert from 'node:assert/strict';
import {checkArticle,summarizeChecks,feedbackFor,canAutoFix,countBodyChars,buildDisclaimer,formatDateTxt,RULE_VERSION,MAX_AUTO_FIX} from '../lib/ai/checks.mjs';
import {mockArticle} from '../lib/ai/mock-article.mjs';

const TODAY=new Date('2026-11-19T10:00:00+09:00');
const LAW=[
 {key:'상업등기규칙.2',verified:true},{key:'상법.19',verified:true},{key:'상법.289.1.2',verified:true},
 {key:'상법.433-434',verified:true},{key:'대법원예규.로마자병기세부',verified:false}
];

const sample=mockArticle;

const warnHas=(r,id)=>assert.ok(ids(r,'warn').includes(id),`기대 경고 ${id}, 실제 warn=${ids(r,'warn').join(',')} fail=${ids(r).join(',')}`);
const run=(a,extra={})=>checkArticle(a,{today:TODAY,lawFacts:LAW,existingTitles:['본점 이전 등기 끝났다면? 사업자등록·4대보험·통장 바꾸는 순서 정리'],existingSlugs:['head-office-after-registration'],...extra});
const ids=(r,level='fail')=>r[level].map(x=>x.id);
const mutate=fn=>{const a=sample();fn(a);return a;};

test('기준을 모두 통과하는 샘플은 fail 0, 경고는 사람 확인용 항목뿐',()=>{
 const r=run(sample());
 assert.deepEqual(r.fail,[],JSON.stringify(r.fail));
 assert.ok(countBodyChars(sample())>=2300,`본문 ${countBodyChars(sample())}자`);
 const allowed=new Set(['law.human-confirm','fact.sentences']);
 assert.ok(ids(r,'warn').every(i=>allowed.has(i)),ids(r,'warn').join(','));
 assert.ok(ids(r,'pass').length>=30);
});

test('규칙 버전과 자동 수정 상한',()=>{
 assert.equal(RULE_VERSION,'v1');
 assert.equal(MAX_AUTO_FIX,3);
 const bad=run(mutate(a=>{a.sections=a.sections.slice(0,2);}));
 assert.equal(canAutoFix(bad,0),true);assert.equal(canAutoFix(bad,2),true);assert.equal(canAutoFix(bad,3),false);
 assert.equal(canAutoFix(run(sample()),0),false);
});

const FAILS=[
 ['섹션 2개','structure.sections-count',a=>{a.sections=a.sections.slice(0,2);}],
 ['섹션 6개','structure.sections-count',a=>{a.sections=[...a.sections,...a.sections.slice(0,2)];}],
 ['섹션 제목에 번호','structure.h2-number',a=>{a.sections[0].h2='1. '+a.sections[0].h2;}],
 ['도입 1문장','structure.intro-count',a=>{a.intro=a.intro.slice(0,1);}],
 ['결론 접두어 없음','structure.conclusion',a=>{a.conclusion='핵심은 한글 상호예요.';}],
 ['세 줄 요약 2개','structure.three-line',a=>{a.threeLineSummary.pop();}],
 ['표 1개','structure.tables-min',a=>{delete a.sections[1].table;}],
 ['표 행 길이 불일치','structure.table-shape',a=>{a.sections[0].table.rows[0]=['한글 상호'];}],
 ['표 3열','structure.table-shape',a=>{a.sections[0].table.header=['구분','등기부 기록','비고'];}],
 ['FAQ 1개','structure.faq-count',a=>{a.faq=a.faq.slice(0,1);}],
 ['팁 0개','structure.tips-count',a=>{a.sections.forEach(s=>{s.tips=[];});}],
 ['팁 5개','structure.tips-count',a=>{a.sections[0].tips=['💡 Tip. a','💡 Tip. b','💡 Tip. c'];a.sections[1].tips=['💡 Tip. d','💡 Tip. e'];}],
 ['팁 접두어 없음','structure.tips-prefix',a=>{a.sections[1].tips=['등기소에 확인해 보세요.'];}],
 ['근거 섹션 부족','structure.source-refs',a=>{a.sections.forEach(s=>{s.sourceRefs=[];});}],
 ['태그 태그 오류(script)','style.allowed-tags',a=>{a.sections[0].paragraphs[0]='<script>alert(1)</script>';}],
 ['허용 외 태그(strong)','style.allowed-tags',a=>{a.sections[0].paragraphs[0]='<strong>강조</strong>해요.';}],
 ['안 닫힌 <b>','style.allowed-tags',a=>{a.sections[0].paragraphs[0]='<b>강조해요.';}],
 ['금지어 귀사','style.forbidden-words',a=>{a.sections[0].paragraphs[1]='귀사의 상호는 한글로 적어요.';}],
 ['금지어 설립등기','style.forbidden-words',a=>{a.sections[0].paragraphs[1]='설립등기와는 다른 절차예요.';}],
 ['운영사 이름','style.forbidden-words',a=>{a.sections[0].paragraphs[1]='빅테크플러스가 도와요.';}],
 ['곡선 따옴표','style.curly-quotes',a=>{a.intro[1]='‘주식회사’를 앞에서 뒤로 옮기는 것도 헷갈려요.';}],
 ['변경등기 붙여쓰기','style.spacing',a=>{a.sections[3].paragraphs[3]='새 상호로 변경등기를 신청해요.';}],
 ['이전등기 붙여쓰기','style.spacing',a=>{a.sections[3].paragraphs[3]='본점 이전등기와는 달라요.';}],
 ['합니다체','style.hapnida',a=>{a.sections[3].paragraphs[3]='새 상호로 등기를 신청합니다.';}],
 ['과장 표현','style.exaggeration',a=>{a.sections[3].paragraphs[3]='이렇게 하면 무조건 통과해요.';}],
 ['서비스 범위(대행)','style.service-scope',a=>{a.sections[3].paragraphs[3]='서류 접수는 대행해 드려요.';}],
 ['slug 대문자','meta.slug',a=>{a.slugCandidates=['English-Trade-Name'];}],
 ['slug 후보 0개','meta.slug',a=>{a.slugCandidates=[];}],
 ['카테고리 오류','meta.category',a=>{a.category='기타';}],
 ['태그 7개','meta.tags',a=>{a.tags=a.tags.slice(0,7);}],
 ['태그에 #','meta.tags',a=>{a.tags[0]='#상호변경';}],
 ['썸네일 1줄 오류','meta.thumbnail',a=>{a.thumbnail.line1='등기 가이드';}],
 ['제목 101자','meta.studio-limits',a=>{a.title='가'.repeat(101);}],
 ['모델이 면책 문구를 씀','fixed.no-model-fixed-text',a=>{a.sections[3].paragraphs[3]='이 글은 법인등기 절차에 관한 일반적인 안내로, 특정 회사의 사안에 대한 법률 자문이나 등기 상담이 아닙니다.';}],
 ['면책 문구 날짜 불일치','fixed.disclaimer',a=>{a.disclaimer=buildDisclaimer(new Date('2026-11-18T10:00:00+09:00'));}],
 ['CTA 불일치','fixed.cta',a=>{a.cta=['서류 준비가 막막하다면 큐레이터로 준비해 보세요.'];}],
 ['링크카드 주소 불일치','fixed.oglink',a=>{a.oglinkUrl='https://www.qrator.kr/';}],
 ['제목이 기존 글과 같음','dup.title',a=>{a.title='본점 이전 등기 끝났다면? 사업자등록·4대보험·통장 바꾸는 순서 정리';}],
 ['사전에 없는 근거','law.refs-exist',a=>{a.sections[0].sourceRefs=['없는.조문'];}],
 ['미확인 근거에 검토 표시 없음','law.needs-human',a=>{a.reviewNotes=a.reviewNotes.filter(n=>n.status!=='needs_human');}],
 ['reviewNotes 형식 오류','review.status',a=>{a.reviewNotes[0].status='ok';}]
];
for(const [name,id,fn] of FAILS){
 test(`위반 주입 → ${id}: ${name}`,()=>{
  const r=run(mutate(fn));
  assert.ok(ids(r).includes(id),`기대 ${id}, 실제 fail=${ids(r).join(',')}`);
  assert.ok(!ids(r,'pass').includes(id));
 });
}

test('slug 후보가 모두 기존 slug와 겹치면 fail',()=>{
 const r=run(sample(),{existingSlugs:['english-trade-name-change','english-company-name-rules','trade-name-english-notation']});
 assert.ok(ids(r).includes('meta.slug-free'));
});

test('올바른 면책·CTA·링크카드가 주어지면 고정문 검사를 통과한다',()=>{
 const a=sample();a.disclaimer=buildDisclaimer(TODAY);
 const r=run(a);
 assert.ok(ids(r,'pass').includes('fixed.disclaimer'));
 assert.equal(formatDateTxt(TODAY),'2026. 11. 19.');
 assert.match(a.disclaimer,/작성일 2026\. 11\. 19\. 기준/);
 assert.equal(formatDateTxt(new Date('2026-12-05T01:00:00+09:00')),'2026. 12. 5.');
});

test('경고 항목: 분량·굵게·제목 길이·긴 문장·유사 제목·이모지·설립 언급',()=>{
 const short=run(mutate(a=>{a.sections.forEach(s=>{s.paragraphs=s.paragraphs.slice(0,2);});a.sections.forEach(s=>{s.table=undefined;});}));
 warnHas(short,'length.chars');
 const bold=run(mutate(a=>{const strip=t=>t.replace(/<\/?b>/g,'');a.sections.forEach(s=>{s.paragraphs=s.paragraphs.map(strip);s.lead=strip(s.lead);});a.threeLineSummary=a.threeLineSummary.map(strip);a.conclusion=strip(a.conclusion);}));
 warnHas(bold,'style.bold-count');
 warnHas(run(mutate(a=>{a.title='상호 변경';})),'length.title');
 warnHas(run(mutate(a=>{a.sections[0].paragraphs[1]='이 한 문장은 일부러 아주 길게 써서 한 줄 원칙을 넘기도록 만든 문장이라서 계속 이어서 쓰고 있고, 아직도 끝나지 않으며, 독자가 읽기에 부담스러울 만큼 계속 길어지고 있고, 한 줄로 읽기에는 숨이 차서 중간에 끊어 주는 편이 훨씬 낫다는 점을 보여 주려고 일부러 넣은 예문이에요.';})),'length.paragraph');
 warnHas(run(mutate(a=>{a.title='본점 이전 등기 끝났다면? 사업자등록·4대보험·통장 바꾸는 순서';})),'dup.title');
 warnHas(run(mutate(a=>{a.intro[0]='회사 이름을 바꾸고 싶으신가요? 🚀';})),'style.emoji');
 warnHas(run(mutate(a=>{a.sections[0].paragraphs[1]='법인 설립 때 정한 이름과 달라요.';})),'style.founding-mention');
 warnHas(run(mutate(a=>{a.sections[0].paragraphs[1]='가장 좋은 방법은 최고 수준의 확인이에요.';})),'style.exaggeration-review');
 warnHas(run(mutate(a=>{a.sections[0].paragraphs[1]='대리인을 통한 신청은 따로 확인해요.';})),'style.service-scope-review');
 warnHas(run(mutate(a=>{a.closingLine='마무리해요.';})),'structure.closing');
 assert.ok(ids(run(mutate(a=>{a.sections[1].h2='영문 상호 표기 방식';})),'warn').includes('structure.h2-question'));
 warnHas(run(mutate(a=>{a.sections.forEach(s=>{s.checks=[];});})),'structure.checks-min');
 warnHas(run(mutate(a=>{a.faq[0].answer[0]='그렇지 않아요.';})),'structure.faq-answer-start');
 warnHas(run(mutate(a=>{a.thumbnail.line2='영문 상호 표기 규칙을 한눈에';})),'meta.thumbnail-width');
 warnHas(run(mutate(a=>{a.bridge.linkTitles=['없는 글 제목'];})),'structure.bridge');
});

test('사실 확인 문장 추출(기한·금액·조문)과 사람 확인 표시',()=>{
 const r=run(mutate(a=>{a.sections[3].paragraphs[4]='등기는 변경한 날부터 2주 이내에 신청해야 하고, 늦으면 과태료가 있어요.';}));
 const f=r.warn.find(x=>x.id==='fact.sentences');
 assert.ok(f);assert.match(f.detail,/2주 이내/);
 assert.ok(r.warn.some(x=>x.id==='law.human-confirm'));
});

test('summarizeChecks·feedbackFor: 화면 표시용 작은 객체',()=>{
 const r=run(mutate(a=>{a.sections.pop();a.faq.pop();a.faq.pop();}));
 const s=summarizeChecks(r);
 assert.equal(s.ruleVersion,'v1');
 assert.equal(s.total,r.pass.length+r.warn.length+r.fail.length);
 assert.equal(s.passed,r.pass.length);assert.equal(s.needsReview,r.warn.length);assert.equal(s.blocked,r.fail.length);
 assert.ok(s.failedIds.includes('structure.faq-count'));
 assert.ok(JSON.stringify(s).length<1200);
 const fb=feedbackFor(r);
 assert.ok(fb.fix.some(x=>x.startsWith('[structure.faq-count]')));
});

test('잘못된 입력(null·배열·문자열 필드 누락)에도 예외 없이 fail 로 보고한다',()=>{
 assert.equal(ids(checkArticle(null)).includes('schema.object'),true);
 assert.equal(ids(checkArticle([])).includes('schema.object'),true);
 const r=checkArticle({title:123,sections:'x',faq:[null,1],intro:{},tags:'a'},{today:TODAY});
 assert.ok(r.fail.length>5);
});
