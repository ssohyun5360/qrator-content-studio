import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderHomeArticle,renderHomeArticleDetailed,inline,HOME_CSS,PROMO_BY_CATEGORY} from '../lib/ai/template-home.mjs';

const original=readFileSync(new URL('./fixtures/home-original-company-name.html',import.meta.url),'utf8');
const DATE=new Date('2026-11-19T01:00:00Z'); // KST 2026-11-19 10:00

const sample=(over={})=>({
 title:'법인 영문 상호 바꾸려면? 상호 변경 등기 전 표기 규칙 정리',
 category:'상호 변경',
 summary:'등기부의 상호는 한글로 적고, 영문은 괄호 안에 함께 적을 수 있어요.',
 seoTitle:'법인 영문 상호 바꾸려면?',
 seoDescription:'등기부의 상호는 한글로 적고, 영문은 괄호 안에 함께 적을 수 있어요.',
 slugCandidates:['english-trade-name-change'],
 intro:['영문 상호를 바꾸고 싶은데 등기도 바꿔야 할까요?','표기 규칙부터 차례로 살펴볼게요.'],
 conclusion:'결론부터 말하면, <b>한글 상호가 같다면</b> 영문만 바꿔도 등기 대상이 될 수 있어요.',
 threeLineSummary:['등기부 상호는 <b>한글로 적어요.</b>','영문은 <b>괄호 안에 병기</b>할 수 있어요.','표기를 바꾸면 <b>정관 변경</b>이 필요할 수 있어요.'],
 sections:[
  {h2:'영문 상호도 등기하나요?',tocLabel:'영문 상호 등기 여부',lead:'영문은 한글 상호 옆에 함께 적어요.',paragraphs:['한글 상호가 기준이에요.','영문 병기는 선택이에요.'],
   table:{header:['구분','내용'],rows:[['한글 상호','등기의 기준이에요.'],['영문 병기','괄호 안에 함께 적어요.']]},
   tips:['💡 Tip. 정관의 상호 표기도 함께 확인해 주세요.'],checks:[{title:'정관 확인',text:'정관의 상호 조항을 살펴보세요.'}],sourceRefs:['상법.19','상법.289.1.2']},
  {h2:'어떤 순서로 진행하나요?',tocLabel:'진행 순서',lead:'정관 변경부터 해요.',paragraphs:['주주총회 특별결의가 필요해요.','결의 뒤 변경등기를 신청해요.'],sourceRefs:['상법.434']},
  {h2:'기한은 언제까지인가요?',tocLabel:'등기 기한',lead:'변경일부터 2주예요.',paragraphs:['기한을 넘기면 과태료가 부과될 수 있어요.','미리 일정을 잡아 주세요.'],sourceRefs:['상법.317.4']}
 ],
 faq:[{q:'영문만 바꿔도 되나요?',answer:['아니요. 한글 상호 기준으로 봐요.'],sourceRefs:['상법.19']},{q:'병기는 필수인가요?',answer:['아니요. 선택이에요.'],sourceRefs:[]}],
 closingLine:'정리하면, 한글 상호가 기준이에요.',
 bridge:{h2:'상호 변경 준비가 아직이라면',paragraphs:['정관 변경 여부부터 확인해 주세요.'],linkTitles:['법인 상호 변경등기 안내','없는 글 제목']},
 tags:['상호변경','영문상호','상호표기','법인상호','정관변경','주주총회','변경등기','법인등기'],
 thumbnail:{line1:'상호 변경 등기',line2:'영문 상호 표기 규칙'},
 reviewNotes:[],
 usedLawKeys:['상법.19','상법.289.1.2','상법.434','상법.317.4'],
 ...over
});
const LAWS={
 '상법.19':{lawName:'상법',article:'제19조',url:'https://www.law.go.kr/법령/상법/제19조'},
 '상법.289.1.2':{lawName:'상법',article:'제289조제1항제2호'},
 '상법.434':{lawName:'상법',article:'제434조'},
 '상법.317.4':{lawName:'상법',article:'제317조제4항'}
};
const options={date:DATE,slug:'english-trade-name-change',laws:LAWS,bridgeLinks:{'법인 상호 변경등기 안내':'./company-name-change.html'}};
const bodyOf=html=>html.slice(html.indexOf('</style>')+8);

test('필수 구조 요소: 커버·세 줄 요약·목차와 섹션 id 일치·FAQ·면책·신청 링크',()=>{
 const html=renderHomeArticle(sample(),options);
 assert.match(html,/<figure class="qbe-cover"><img src="\.\/assets\/thumbnail\.svg" width="1280" height="720"/);
 assert.equal((html.match(/<aside class="qbv-summary"[\s\S]*?<\/aside>/)[0].match(/<li>/g)||[]).length,3);
 const tocIds=[...html.matchAll(/<a href="#(qbv-[a-z0-9-]+)">/g)].map(m=>m[1]);
 assert.deepEqual(tocIds,['qbv-section-1','qbv-section-2','qbv-section-3','qbv-faq']);
 for(const id of tocIds)assert.ok(html.includes(`id="${id}"`),'목차 대상 id 없음: '+id);
 assert.match(html,/<h2 id="heading-1">1\. 영문 상호도 등기하나요\?<\/h2>/);
 assert.equal((html.match(/<details><summary>/g)||[]).length,3); // FAQ 2개 + 참고 법령
 assert.match(html,/<section class="qbv-faq" id="qbv-faq"/);
 assert.match(html,/<section class="qbv-disclosure"[\s\S]*이 글은 법인등기 절차에 관한 일반적인 안내로/);
 assert.match(html,/<a class="qbv-apply" href="https:\/\/www\.qrator\.kr\/registration\/select-items" data-qrator-apply="company-name-change">상호 변경 서류 준비하기 <span aria-hidden="true">→<\/span><\/a>/);
 assert.match(html,/<a class="qbx-back" href="\.\/index\.html">블로그 <span aria-hidden="true">›<\/span> 상호 변경<\/a>/);
 assert.match(html,/<title>법인 영문 상호 바꾸려면\? 상호 변경 등기 전 표기 규칙 정리 \| 큐레이터<\/title>/);
});

test('✅/💡 이모지는 텍스트 그대로, 표는 scope 속성을 갖는다',()=>{
 const html=renderHomeArticle(sample(),options);
 assert.ok(html.includes('<strong>✅ 정관 확인</strong>'));
 assert.ok(html.includes('<aside class="note"><strong>💡 Tip.</strong> 정관의 상호 표기도 함께 확인해 주세요.</aside>'));
 assert.match(html,/<th scope="col">구분<\/th><th scope="col">내용<\/th>/);
 assert.match(html,/<tr><th scope="row">한글 상호<\/th><td>등기의 기준이에요\.<\/td><\/tr>/);
});

test('위험한 입력은 이스케이프되거나 제거된다',()=>{
 const evil='<script>alert(1)</script><img src=x onerror=alert(2)><b onclick="x()">굵게</b><a href="javascript:alert(3)">링크</a>';
 const html=renderHomeArticle(sample({
  title:evil,summary:evil,intro:[evil,evil],conclusion:evil,
  threeLineSummary:[evil,evil,evil],
  sections:[{h2:evil,tocLabel:evil,lead:evil,paragraphs:[evil,evil],table:{header:[evil,evil],rows:[[evil,evil]]},tips:[evil],checks:[{title:evil,text:evil}],sourceRefs:['x.y']}],
  faq:[{q:evil,answer:[evil],sourceRefs:[]}],
  bridge:{h2:evil,paragraphs:[evil],linkTitles:['a']},
  thumbnail:{line1:evil,line2:evil}
 }),{...options,laws:{'x.y':{lawName:evil,article:evil,url:'javascript:alert(4)'}},bridgeLinks:{a:'javascript:alert(5)'}});
 const body=bodyOf(html);
 assert.ok(!/<script/i.test(html),'script 태그가 그대로 남음');
 assert.ok(body.includes('&lt;script&gt;'));
 assert.ok(!/<img src=x/i.test(body));
 assert.ok(!/<b onclick/i.test(body)&&!/<a href="javascript/i.test(body));
 assert.ok(!/href="javascript:/i.test(body));
 assert.equal((body.match(/<img /g)||[]).length,2); // 커버 + promo 로고만
 assert.equal((body.match(/<script/gi)||[]).length,0);
});

test('인라인 서식은 b/u/i(strong/em/u)만 통과하고 짝이 맞지 않으면 보정한다',()=>{
 assert.equal(inline('<b>굵게</b> <i>기울임</i> <u>밑줄</u>'),'<strong>굵게</strong> <em>기울임</em> <u>밑줄</u>');
 assert.equal(inline('<b>닫히지 않음'),'<strong>닫히지 않음</strong>');
 assert.equal(inline('짝 없는 닫기</b>끝'),'짝 없는 닫기끝');
 assert.equal(inline('<span style="x">텍스트</span> & "따옴표"'),'&lt;span style=&quot;x&quot;&gt;텍스트&lt;/span&gt; &amp; &quot;따옴표&quot;');
});

test('원본 1103_html 과 같은 스타일·클래스·id 골격을 가진다',()=>{
 const html=renderHomeArticle(sample(),options);
 const css=s=>/<style>\r?\n?([\s\S]*?)<\/style>/.exec(s)[1].replace(/\r\n/g,'\n').trimEnd();
 assert.equal(css(html),css(original),'CSS가 원본과 다름');
 assert.equal(css(html),HOME_CSS.trimEnd());
 const classes=s=>new Set([...bodyOf(s).matchAll(/class="([^"]+)"/g)].flatMap(m=>m[1].split(/\s+/)));
 const ids=s=>new Set([...bodyOf(s).matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
 const have=classes(html),want=classes(original);
 const missingClasses=[...want].filter(c=>!have.has(c));
 assert.deepEqual(missingClasses,[],'원본에 있는 클래스 누락: '+missingClasses.join(','));
 const haveIds=ids(html);
 for(const id of ['qrator-blog','qbv-title','qbv-summary-title','qbv-toc-title','qbv-faq','faq-title','qbv-disclosure-title','qbv-section-1','heading-1'])assert.ok(haveIds.has(id),'id 누락: '+id);
 assert.ok(html.includes('<article id="qrator-blog" aria-labelledby="qbv-title">'));
 assert.ok(html.includes('<body style="margin:0;background:#fff">'));
 for(const tag of ['header','figure','aside','nav','section','footer','details','summary','table','thead','tbody'])assert.ok(new RegExp('<'+tag+'[\\s>]').test(bodyOf(html)),'태그 누락: '+tag);
});

test('작성일: 면책 문구와 author time 이 date 인자(한국 시간) 기준으로 바뀐다',()=>{
 const html=renderHomeArticle(sample(),options);
 assert.ok(html.includes('이 글은 작성일 2026. 11. 19. 기준이며'));
 assert.ok(html.includes('<time datetime="2026-11-19">작성일 2026-11-19</time>'));
 assert.ok(!html.includes('{{DATE_TXT}}'));
 const late=renderHomeArticle(sample(),{...options,date:new Date('2026-11-18T16:30:00Z')}); // KST 11/19 01:30
 assert.ok(late.includes('작성일 2026. 11. 19. 기준'));
 const early=renderHomeArticle(sample(),{...options,date:new Date('2026-01-05T00:00:00Z')});
 assert.ok(early.includes('작성일 2026. 1. 5. 기준')&&early.includes('datetime="2026-01-05"'));
 assert.throws(()=>renderHomeArticle(sample(),{...options,date:'2026-11-19'}),/작성일/);
});

test('법령 링크: url 이 있으면 링크, 없으면 확인 필요 표시와 목록 반환',()=>{
 const {html,needsCheck}=renderHomeArticleDetailed(sample(),options);
 assert.ok(html.includes('<a href="https://www.law.go.kr/법령/상법/제19조" target="_blank" rel="noopener noreferrer">상법 제19조</a>'));
 assert.ok(html.includes('<span data-needs-check="true">상법 제434조</span>'));
 assert.deepEqual(needsCheck.sort(),['상법.289.1.2','상법.317.4','상법.434']);
 assert.match(html,/<details><summary>참고 법령 및 공식 자료<\/summary>/);
 const unknown=renderHomeArticleDetailed(sample({usedLawKeys:['없는.키']}),options);
 assert.ok(unknown.needsCheck.includes('없는.키'));
});

test('브리지 링크는 목록에서 찾은 안전한 주소만 붙는다',()=>{
 const html=renderHomeArticle(sample(),options);
 assert.ok(html.includes('이어서 보면 좋은 글: <a href="./company-name-change.html">법인 상호 변경등기 안내</a>'));
 assert.ok(!html.includes('없는 글 제목'));
});

test('promo: 카테고리별 문구·코드, 임원/지점은 코드 없는 공통 문구',()=>{
 assert.equal(PROMO_BY_CATEGORY['본점 이전'].code,'head-office-relocation');
 const office=renderHomeArticle(sample({category:'임원 변경'}),options);
 assert.ok(office.includes('<h3>변경등기 서류 준비, 큐레이터에서 시작해 보세요</h3>'));
 assert.ok(!office.includes('data-qrator-apply'));
 const purpose=renderHomeArticle(sample({category:'목적 변경'}),options);
 assert.ok(purpose.includes('data-qrator-apply="business-purpose-change">목적 변경 서류 준비하기'));
});

test('필수 항목이 빠지면 오류',()=>{
 assert.throws(()=>renderHomeArticle(sample({faq:undefined}),options),/필수 항목/);
 assert.throws(()=>renderHomeArticle(sample({threeLineSummary:['하나','둘']}),options),/세 줄 요약/);
 assert.throws(()=>renderHomeArticle(null,options));
});
