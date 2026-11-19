import test from 'node:test';
import assert from 'node:assert/strict';
import {checkArticle,summarizeChecks,feedbackFor,canAutoFix,countBodyChars,buildDisclaimer,formatDateTxt,RULE_VERSION,MAX_AUTO_FIX} from '../lib/ai/checks.mjs';

const TODAY=new Date('2026-11-19T10:00:00+09:00');
const LAW=[
 {key:'상업등기규칙.2',verified:true},{key:'상법.19',verified:true},{key:'상법.289.1.2',verified:true},
 {key:'상법.433-434',verified:true},{key:'대법원예규.로마자병기세부',verified:false}
];

function sample(){
 return {
  title:'법인 영문 상호 바꾸려면? 상호 변경 등기 전 표기 규칙 정리',
  category:'상호 변경',
  summary:'등기부의 상호는 한글로 적고, 영문은 괄호 안에 함께 적을 수 있어요. 상호 글자가 바뀌면 정관 변경과 상호 변경 등기를 함께 준비해야 해요.',
  seoTitle:'법인 영문 상호 바꾸려면? 상호 변경 등기 전 표기 규칙 정리',
  seoDescription:'등기부의 상호는 한글로 적고, 영문은 괄호 안에 함께 적을 수 있어요. 상호를 바꾸기 전에 확인할 표기 규칙을 정리했어요.',
  slugCandidates:['english-trade-name-change','english-company-name-rules','trade-name-english-notation'],
  intro:[
   '회사 이름을 영어로 바꾸거나, 영문 이름도 등기부에 올리고 싶으신가요?',
   "'주식회사'를 앞에서 뒤로 옮기는 것도 등기가 필요한지 헷갈리실 수 있어요.",
   '등기부에 올라가는 글자는 정해진 규칙이 있어서, 먼저 확인하고 시작하면 서류를 다시 쓰는 일을 줄일 수 있어요.'
  ],
  conclusion:'결론부터 말하면, <b>등기부의 상호는 한글로 적고, 영문은 괄호 안에 함께 적을 수 있어요.</b>',
  threeLineSummary:[
   '등기부에는 <b>한글 상호</b>가 먼저이고, 영문만으로는 등기할 수 없어요.',
   '영문은 한글 상호 뒤 <b>괄호 안에 병기</b>하는 방식으로 적어요.',
   '등기된 상호 글자가 바뀌면 <b>정관 변경과 상호 변경 등기</b>를 함께 준비해요.'
  ],
  sections:[
   {
    h2:'등기부에 영문 상호만 올릴 수 있나요?',
    tocLabel:'영문 상호만으로는 등기할 수 없어요',
    lead:'<b>아니요. 등기는 한글과 아라비아숫자로 적는 것이 원칙이에요.</b>',
    paragraphs:[
     '상업등기규칙은 등기를 하거나 신청서를 작성할 때 <b>한글과 아라비아숫자</b>를 쓰도록 정하고 있어요.',
     '그래서 영문 이름만으로 상호를 등기할 수는 없어요.',
     '다만 영문을 아예 못 쓰는 것은 아니에요.',
     '한글로 상호를 적은 다음 <b>괄호 안에 로마자를 함께 적는 것</b>은 허용돼요.',
     '명함이나 홈페이지에서 영문 이름만 쓰고 있었다면, 등기부에는 한글 상호가 따로 있는 셈이에요.',
     '<b>계약서와 은행 서류에 쓰는 이름이 등기부와 같은지</b> 한 번 맞춰 보세요.',
     '이름이 서로 다르면 거래처나 은행에서 같은 회사인지 다시 물어볼 수 있어요.',
     '그래서 영문 이름을 쓰는 곳이 있다면 한글 상호와 어떻게 이어지는지 미리 정리해 두면 좋아요.'
    ],
    table:{header:['구분','등기부 기록'],rows:[['한글 상호','반드시 기록'],['한글과 아라비아숫자','기록 가능'],['로마자·한자','괄호 안 병기만 가능'],['영문만으로 된 상호','등기 불가']]},
    tips:[],
    checks:[],
    sourceRefs:['상업등기규칙.2']
   },
   {
    h2:'영문 상호는 어떤 방식으로 함께 적나요?',
    tocLabel:'한글 상호 뒤 괄호 안에 로마자',
    lead:'<b>한글 상호를 먼저 적고, 그 뒤 괄호 안에 로마자 표기를 함께 적어요.</b>',
    paragraphs:[
     "예를 들어 '주식회사 한빛'이라면, 한글 상호 뒤 괄호 안에 'HANBIT' 같은 로마자 표기를 넣는 식이에요.",
     '병기하는 방식은 <b>대법원예규</b>에서 자세히 정하고 있어요.',
     '그래서 아무 영문 이름이나 붙일 수 있는 것은 아니에요.',
     '예를 들어 한글 상호와 <b>발음이 크게 다른 영문 이름</b>은 병기가 어려울 수 있어요.',
     '영문 표기를 정하기 전에 <b>정관에 영문 표기가 적혀 있는지</b>도 함께 보세요.',
     '정관과 등기부의 영문 표기가 서로 다르면 나중에 서류를 다시 고쳐야 할 수 있기 때문이에요.',
     '병기 여부는 상호를 바꾸는 회사마다 사정이 달라서, 한 번에 정하기보다 후보를 두세 개 만들어 두는 편이 안전해요.',
     '후보마다 한글 발음과 로마자 표기가 자연스럽게 이어지는지 소리 내어 읽어 보면 도움이 돼요.'
    ],
    table:{header:['확인할 것','이유'],rows:[['한글 상호와 발음','발음이 다르면 병기가 어려울 수 있어요'],['괄호 안 문자','로마자와 한자 혼용 여부를 확인해요'],['부호 사용','쓸 수 있는 부호가 정해져 있을 수 있어요']]},
    tips:['💡 Tip. 영문 표기는 등기 신청 전에 <b>관할 등기소나 인터넷등기소 안내</b>로 병기 가능 여부를 먼저 확인해 보세요.'],
    checks:[],
    sourceRefs:['대법원예규.로마자병기세부']
   },
   {
    h2:"'주식회사' 위치만 바꿔도 상호 변경 등기인가요?",
    tocLabel:"'주식회사' 위치를 옮기는 경우",
    lead:'<b>네. 등기된 상호 글자가 바뀌는 것이라 상호 변경으로 준비해야 해요.</b>',
    paragraphs:[
     "상법은 주식회사의 상호에 <b>'주식회사'라는 문자</b>를 쓰도록 정하고 있어요.",
     '다만 그 문자를 상호의 앞에 둘지 뒤에 둘지는 법에서 정하지 않아요.',
     '그래서 처음 정할 때는 앞이든 뒤든 고를 수 있어요.',
     "하지만 한번 등기된 뒤에는 '주식회사 한빛'과 '한빛 주식회사'의 등기 기록이 서로 달라요.",
     '글자 순서만 바꿔도 <b>등기된 상호가 달라지는 것</b>이라서, 정관과 등기부를 함께 고쳐야 해요.',
     '반대로 로고나 간판의 디자인만 바꾸는 것은 등기된 상호 글자가 그대로라면 등기와는 따로 생각해도 돼요.',
     '이런 차이를 모르고 서류를 쓰면 필요 없는 절차를 밟거나 꼭 필요한 절차를 놓칠 수 있어요.'
    ],
    tips:[],
    checks:[
     {title:'✅ 정관의 상호 조항을 확인해요',text:'상호는 정관에 반드시 적는 항목이라서, 정관 문구가 새 상호와 같은지 봐요.'},
     {title:'✅ 새 상호가 기존 상호와 헷갈리지 않는지 봐요',text:'같은 지역에 비슷한 상호가 있으면 등기가 어려울 수 있어요.'}
    ],
    sourceRefs:['상법.19','상법.289.1.2']
   },
   {
    h2:'상호를 바꾸려면 무엇부터 준비하나요?',
    tocLabel:'정관 변경 결의부터 시작해요',
    lead:'<b>먼저 새 상호를 정하고, 정관 변경 결의를 어떻게 할지 정해요.</b>',
    paragraphs:[
     '상호는 정관에 적는 항목이라서, 상호를 바꾸려면 <b>정관을 먼저 고쳐야 해요</b>.',
     '정관 변경은 주주총회의 특별결의로 하는 것이 원칙이에요.',
     '그래서 주주총회를 열 수 있는지, 주주들에게 알릴 시간이 충분한지부터 확인해요.',
     '결의가 끝나면 새 상호로 등기를 신청하는 순서로 이어져요.',
     '등기 기한이 정해져 있으니 <b>결의 날짜와 신청 일정</b>을 같이 적어 두면 편해요.',
     '회사마다 정관이나 결의 방식이 달라서, 서류 이름과 순서는 조금씩 다를 수 있어요.',
     '주주가 많지 않은 회사라면 모든 주주가 모이는 방식으로 진행하는 경우도 있어서, 회사의 정관을 먼저 읽어 보세요.',
     '결의 방식이 정해지면 그에 맞춰 필요한 서류를 하나씩 정리하는 순서로 이어가면 돼요.'
    ],
    tips:['💡 Tip. 새 상호는 정하기 전에 <b>인터넷등기소에서 같은 상호가 있는지</b> 먼저 검색해 보세요.'],
    checks:[{title:'✅ 결의 날짜를 적어 둬요',text:'결의한 날과 신청할 날을 같이 정리하면 기한을 놓치지 않아요.'}],
    sourceRefs:['상법.433-434']
   }
  ],
  faq:[
   {q:'영문 상호만으로 회사 이름을 등기할 수 있나요?',answer:['아니요.','등기는 한글과 아라비아숫자가 원칙이라서, 영문은 한글 상호 뒤 괄호 안에 함께 적어요.'],sourceRefs:['상업등기규칙.2']},
   {q:"'주식회사' 위치를 바꾸면 정관도 고쳐야 하나요?",answer:['네,','정관에 적힌 상호가 바뀌는 것이라서 정관 변경도 함께 준비해요.'],sourceRefs:['상법.289.1.2']},
   {q:'영문 표기가 정관과 달라도 괜찮나요?',answer:['아니요.','정관과 등기부의 표기가 다르면 서류를 다시 고쳐야 할 수 있어서 처음부터 맞춰 두는 편이 좋아요.'],sourceRefs:[]}
  ],
  closingLine:'정리하면, 영문은 괄호 안에 병기하고 상호 글자가 바뀌면 정관과 등기를 함께 준비해요.',
  bridge:{h2:'상호 변경 서류가 막막하다면',paragraphs:['상호 외에 본점이나 임원이 바뀌는 경우의 준비 순서는 다른 글에서도 정리했어요.'],linkTitles:[]},
  tags:['상호변경','상호변경등기','영문상호','법인영문명','상호표기','로마자병기','주식회사위치','정관변경','주주총회특별결의','법인상호'],
  thumbnail:{line1:'상호 변경 등기',line2:'영문 상호 표기 규칙'},
  reviewNotes:[
   {status:'grounded',text:'등기 문자 원칙과 상호의 정관 기재 사항은 근거 사전의 원문 확인 항목을 썼어요.',lawKeys:['상업등기규칙.2','상법.289.1.2']},
   {status:'needs_human',text:'로마자 병기의 세부 기준은 예규 원문을 확인하지 못해 단정하지 않았어요.',lawKeys:['대법원예규.로마자병기세부']},
   {status:'omitted',text:'병기 수수료와 필요 서류 목록은 확인할 수 없어 쓰지 않았어요.'}
  ],
  usedLawKeys:['상업등기규칙.2','대법원예규.로마자병기세부','상법.19','상법.289.1.2','상법.433-434']
 };
}

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
