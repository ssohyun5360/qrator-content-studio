import test from 'node:test';
import assert from 'node:assert/strict';
import {renderHomeArticle,renderCategoryTabs,TABS_CSS,HOME_CSS} from '../lib/ai/template-home.mjs';
import {checkArticle} from '../lib/ai/checks.mjs';
import {mockArticle} from '../lib/ai/mock-article.mjs';

const TODAY=new Date('2026-11-20T10:00:00+09:00');
const run=a=>checkArticle(a,{today:TODAY});
const ids=(r,level='fail')=>r[level].map(x=>x.id);
const withTitle=title=>({...mockArticle(),title,seoTitle:title});

test('분류 탭: 전체 + 5개 분류가 순서대로 나오고 현재 글의 분류만 강조된다',()=>{
 const html=renderCategoryTabs('상호 변경');
 const labels=[...html.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map(m=>m[1]);
 assert.deepEqual(labels,['전체','본점 이전','상호 변경','임원 변경','목적 변경','지점 변경']);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.match(html,/<a href="\.\/index\.html\?category=%EC%83%81%ED%98%B8%20%EB%B3%80%EA%B2%BD" aria-current="page">상호 변경<\/a>/);
 assert.match(html,/<a href="\.\/index\.html">전체<\/a>/);
});

test('분류 탭: 짧은 분류 이름(임원)도 같은 탭으로 보고, 알 수 없는 분류는 강조하지 않는다',()=>{
 assert.match(renderCategoryTabs('임원'),/aria-current="page">임원 변경</);
 assert.equal((renderCategoryTabs('등기 가이드').match(/aria-current/g)||[]).length,0);
 assert.equal((renderCategoryTabs(undefined).match(/aria-current/g)||[]).length,0);
 assert.ok(!renderCategoryTabs('<script>alert(1)</script>').includes('<script'));
});

test('홈페이지 글 맨 위(제목보다 앞)에 탭이 들어가고 CSS 는 원본 <style> 을 건드리지 않는다',()=>{
 const html=renderHomeArticle(mockArticle(),{date:TODAY,slug:'tabs-test'});
 assert.ok(html.indexOf('class="qbx-tabs"')>0&&html.indexOf('class="qbx-tabs"')<html.indexOf('<h1'));
 assert.ok(html.indexOf('class="qbx-tabs"')<html.indexOf('class="qbx-back"'));
 const first=/<style>\r?\n?([\s\S]*?)<\/style>/.exec(html)[1].replace(/\r\n/g,'\n').trimEnd();
 assert.equal(first,HOME_CSS.trimEnd());
 assert.ok(html.includes('data-part="category-tabs"')&&html.includes(TABS_CSS.trim().slice(0,40)));
});

test('제목 스타일: 정보성 명사형 제목은 통과한다(예시 제목 포함)',()=>{
 for(const t of ['본점 이전 시 사업자등록·4대보험 변경 안내','상호 변경 시 효력 발생일과 등기 기한 안내','이사 사임 시 퇴임 등기 기한과 준비 서류 안내','법인 영문 상호 변경 시 상호 표기 규칙 안내']){
  const r=run(withTitle(t));
  assert.ok(!ids(r).includes('title.style'),t);assert.ok(!ids(r,'warn').includes('title.suffix'),t);
 }
});

test('제목 스타일: 질문형·권유형·느낌표는 fail',()=>{
 for(const t of ['법인 영문 상호 바꾸려면? 상호 변경 등기 전 표기 규칙 정리','이사가 사임했다면 퇴임 등기 기한부터 확인하세요','본점 이전했다면 이렇게 하면 돼요','상호 변경 등기 안내!','상호 변경 등기 기한이 궁금하시죠','본점 이전 후 해야 할 일 알아볼까']){
  assert.ok(ids(run(withTitle(t))).includes('title.style'),t);
 }
});

test('제목 스타일: 명사로 끝맺지 않으면 경고(저장은 막지 않는다)',()=>{
 const r=run(withTitle('법인 영문 상호 변경 시 상호 표기 규칙을 살펴보면'));
 assert.ok(!ids(r).includes('title.style'));assert.ok(ids(r,'warn').includes('title.suffix'));
});

test('기준 샘플(제목 포함)은 여전히 fail 0 이다',()=>{
 assert.deepEqual(ids(run(mockArticle())),[]);
});
