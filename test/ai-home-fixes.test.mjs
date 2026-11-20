import test from 'node:test';
import assert from 'node:assert/strict';
import {renderHomeArticleDetailed,homeAssets} from '../lib/ai/template-home.mjs';
import {checkArticle} from '../lib/ai/checks.mjs';
import {mockArticle} from '../lib/ai/mock-article.mjs';
import lawDb from '../lib/ai/rules/v1/laws.json' with {type:'json'};

const DATE=new Date('2026-11-20T10:00:00+09:00');
const render=(article,laws=lawDb.entries)=>renderHomeArticleDetailed(article,{date:DATE,slug:'fix-test',laws});
const textOf=html=>html.replace(/<style[\s\S]*?<\/style>/g,'');

test('✅ 체크 항목: 제목에 ✅가 이미 있어도 한 번만 표시한다',()=>{
 const a=mockArticle();
 a.sections[0].checks=[{title:'✅ 이미 이모지가 붙은 제목',text:'설명이에요.'},{title:'이모지 없는 제목',text:'설명이에요.'},{title:'✅✅ 두 번 붙은 제목',text:'설명이에요.'}];
 const {html}=render(a);
 const items=[...html.matchAll(/<strong>(✅[^<]*)<\/strong>/g)].map(m=>m[1]);
 assert.deepEqual(items.slice(0,3),['✅ 이미 이모지가 붙은 제목','✅ 이모지 없는 제목','✅ 두 번 붙은 제목']);
 assert.ok(!/✅\s*✅/.test(html));
});

test('법령 출처: 키(상법.19)가 아니라 "상법 제19조"처럼 조·항·호로 표시한다',()=>{
 const a=mockArticle();
 a.sections[0].sourceRefs=['상법.19','상법.289.1.2','상법.433-434','상업등기규칙.2','대법원예규.로마자병기세부'];
 const {html,needsCheck}=render(a);
 const source=html.match(/<p class="source">참고: ([^]*?)<\/p>/)[1].replace(/<[^>]+>/g,'');
 assert.equal(source,'상법 제19조 · 상법 제289조 제1항 제2호 · 상법 제433조, 제434조 · 상업등기규칙 제2조 · 대법원 예규(상호 로마자 병기 기준)');
 assert.ok(!/(상법|상업등기규칙|대법원예규)\.[\d가-힣]/.test(textOf(html).replace(/data-[^>]*>/g,'>')),'점(.)으로 이어진 키가 화면 글에 보이면 안 된다');
 assert.ok(needsCheck.includes('대법원예규.로마자병기세부'),'원문 미확인 항목은 확인 필요로 남는다');
});

test('법령 사전: 모든 항목의 표기는 조·항·호 또는 사건명이고 비어 있지 않다',()=>{
 for(const e of Object.values(lawDb.entries)){
  assert.ok(e.cite&&e.cite.length>=3,e.key);
  assert.ok(!/^[^\s]+\.[\d가-힣+-]/.test(e.cite),`키 형태 그대로: ${e.key} → ${e.cite}`);
  assert.ok(!/미확인|미기재|\(판례\)/.test(e.cite),`${e.key} → ${e.cite}`);
  assert.ok(!/조제\d|항제\d/.test(e.cite),`띄어쓰기 없음: ${e.key} → ${e.cite}`);
 }
 assert.equal(lawDb.entries['상법.19'].cite,'상법 제19조');
 assert.equal(lawDb.entries['상법.317.2.1'].cite,'상법 제317조 제2항 제1호');
});

test('사전에 없는 법령 키는 코드 검사에서 걸러진다',()=>{
 const a=mockArticle();a.sections[0].sourceRefs=['없는법.99'];a.usedLawKeys=[...a.usedLawKeys,'없는법.99'];
 const r=checkArticle(a,{today:DATE,lawFacts:Object.values(lawDb.entries).map(e=>({key:e.key,verified:e.verified}))});
 assert.ok([...r.fail,...r.warn].some(x=>/law/.test(x.id)),JSON.stringify([...r.fail,...r.warn].map(x=>x.id)));
});

test('FAQ: 답변 첫머리는 모두 "네." 또는 "아니요."(모델이 "네,"로 써도 마침표로 맞춘다)',()=>{
 const a=mockArticle();
 a.faq[0].answer=['네, 가능해요.','추가 설명이에요.'];
 a.faq[1].answer=['아니요, 안 돼요.','추가 설명이에요.'];
 const {html}=render(a);
 const firsts=[...html.matchAll(/<details><summary>[^]*?<\/summary><p>([^<]*)<\/p>/g)].map(m=>m[1]);
 assert.equal(firsts.length,a.faq.length);
 for(const t of firsts)assert.match(t,/^(네|아니요)\./,t);
 assert.equal(firsts[0],'네. 가능해요.');assert.equal(firsts[1],'아니요. 안 돼요.');
 assert.ok(!/<p>(네|아니요),/.test(html));
});

test('FAQ: 기준 샘플은 "네."로 시작하며 코드 검사를 경고 없이 통과한다',()=>{
 const r=checkArticle(mockArticle(),{today:DATE});
 assert.ok(!r.warn.some(x=>x.id==='structure.faq-answer-start'));
 assert.ok(mockArticle().faq.some(f=>f.answer[0]==='네.'));
 const bad=mockArticle();bad.faq[0].answer=['네,','설명'];
 assert.ok(checkArticle(bad,{today:DATE}).warn.some(x=>x.id==='structure.faq-answer-start'));
});

test('서비스 소개 박스의 로고 파일을 글과 함께 첨부할 수 있다',()=>{
 const {html}=render(mockArticle());
 assert.ok(html.includes('src="./assets/qrator-logo.svg"'));
 const logo=homeAssets().find(a=>a.path==='assets/qrator-logo.svg');
 assert.ok(logo);assert.equal(logo.mime,'image/svg+xml');
 assert.match(Buffer.from(logo.base64,'base64').toString('utf8'),/^<svg[\s>]/);
});

test('글꼴: 홈페이지 글 두 템플릿 모두 Studio 화면과 같은 Pretendard 스타일시트(https)를 불러온다',()=>{
 const {html}=render(mockArticle());
 assert.match(html,/<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@v1\.3\.9\/dist\/web\/static\/pretendard\.css">/);
 assert.ok(html.indexOf('pretendard.css')<html.indexOf('<style>'),'본문 CSS보다 먼저 불러온다');
 assert.match(html,/font:400 17px\/1\.6 "Qrator Pretendard",Pretendard,/,'글꼴 목록의 Pretendard 가 이 스타일시트로 채워진다');
});