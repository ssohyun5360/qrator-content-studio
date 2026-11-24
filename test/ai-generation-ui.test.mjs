import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ui=await readFile(new URL('../public/automation-ui.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../public/automation-ui.css',import.meta.url),'utf8');

test('AI 생성 팝업은 단일 생성과 엑셀 붙여넣기 일괄 생성을 제공한다',()=>{
 assert.match(ui,/data-ai-mode="single"/);
 assert.match(ui,/data-ai-mode="bulk"/);
 assert.match(ui,/id="aiBulkInput"/);
 assert.match(ui,/QRATOR_AI_콘텐츠_일괄생성_템플릿\.csv/);
 assert.match(ui,/한 번에 최대 50건/);
});

test('생성 진행은 팝업 닫기와 분리되고 대시보드에 실제 작업을 표시한다',()=>{
 assert.match(ui,/id="aiLivePanel"/);
 assert.match(ui,/async function refreshAiDashboard/);
 assert.match(ui,/function enqueueAiJob/);
 assert.match(ui,/\$\('aiProgClose'\)\.onclick=\(\)=>\$\('aiProgressDialog'\)\.close\(\)/);
 assert.doesNotMatch(ui,/close.*aiRun\+\+/);
 assert.match(css,/\.ai-live-job/);
});
