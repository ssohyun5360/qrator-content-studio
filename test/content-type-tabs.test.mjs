import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
const automation=await readFile(new URL('../public/automation-ui.mjs',import.meta.url),'utf8');

test('콘텐츠 목록은 사이드바 하위 메뉴 대신 상단 네 탭을 사용한다',()=>{
 assert.match(html,/id="navContents"[^>]*>[\s\S]*?콘텐츠 목록<\/button>/);
 assert.doesNotMatch(html,/id="qratorContentNavigation"/);
 assert.match(html,/id="qratorContentTabs"/);
 for(const [value,label] of [['all','전체'],['guide','등기가이드'],['workbook','실무워크북'],['insight','인사이트']])assert.match(html,new RegExp(`data-content-type="${value}"[^>]*>${label}<`));
});

test('상단 탭은 목록 필터와 AI 생성 콘텐츠 유형 기본값에 연결된다',()=>{
 assert.match(app,/state\.contentType==='all'\|\|recordContentType\(x\)===state\.contentType/);
 assert.match(app,/addEventListener\('qrator:content-type'/);
 assert.match(automation,/id="aiContentType"/);
 assert.match(automation,/activeContentType==='all'\?'guide':activeContentType/);
 assert.match(automation,/contentType,brief:item\.brief/);
});
