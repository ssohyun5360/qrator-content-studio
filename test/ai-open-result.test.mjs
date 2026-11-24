import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicJob} from '../lib/ai/pipeline.mjs';
import {locateRecords} from '../public/client-helpers.mjs';

const ui=await readFile(new URL('../public/automation-ui.mjs',import.meta.url),'utf8');
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');

test('완료된 작업은 만들어진 글의 slug·제목을 result 로 알려 주고 산출물은 숨긴다',()=>{
 const done=publicJob({id:'1',status:'done',input:{},steps:[],result:null,outputs:{save:{slug:'ai-made',title:'AI가 쓴 글',revision:3},template:{html:'<p>비공개 산출물</p>'}}});
 assert.deepEqual(done.result,{slug:'ai-made',title:'AI가 쓴 글',revision:3});
 assert.equal(done.outputs,undefined);assert.deepEqual(done.outputKeys,['save','template']);
 assert.equal(JSON.stringify(done).includes('비공개 산출물'),false);
});

test('저장 전 작업과 실패한 작업은 result 가 없다',()=>{
 assert.equal(publicJob({id:'2',status:'in_progress',steps:[],result:null,outputs:{topic:{topic:'x'}}}).result,null);
 assert.equal(publicJob({id:'3',status:'failed',steps:[],result:null,outputs:{}}).result,null);
 assert.equal(publicJob({id:'4',status:'pending',steps:[],result:null}).result,null);
});

test('locateRecords: 글이 있는 페이지와 못 찾은 글을 알려 준다',()=>{
 const rows=Array.from({length:45},(_,i)=>({slug:'post-'+i}));
 assert.deepEqual(locateRecords(rows,['post-0'],20),{found:['post-0'],missing:[],page:1});
 assert.deepEqual(locateRecords(rows,['post-20'],20),{found:['post-20'],missing:[],page:2});
 assert.equal(locateRecords(rows,['post-44'],20).page,3);
 // 여러 글이면 목록에서 가장 위에 있는 글의 페이지로 간다.
 assert.deepEqual(locateRecords(rows,['post-41','post-3','nope'],20),{found:['post-3','post-41'],missing:['nope'],page:1});
 assert.deepEqual(locateRecords(rows,[],20),{found:[],missing:[],page:1});
 assert.deepEqual(locateRecords([],['a'],20),{found:[],missing:['a'],page:1});
 assert.equal(locateRecords(rows,['post-20'],0).page,2,'페이지 크기가 잘못되면 20건 기준으로 계산한다');
});

test('대시보드·진행 팝업의 "목록에서 확인"은 해당 글을 목록에서 표시하도록 이벤트를 보낸다',()=>{
 assert.match(ui,/function showAiResults/);
 assert.match(ui,/new CustomEvent\('qrator:focus-records',\{detail:\{slugs:/);
 assert.match(ui,/if\(job\.status==='done'\)\{showAiResults\(\[job\]\);return;\}/);
 assert.match(ui,/\$\('aiProgOpen'\)\.onclick=\(\)=>\{\$\('aiProgressDialog'\)\.close\(\);showAiResults\(/);
 assert.match(ui,/const aiJobTitle=job=>job\.result\?\.title\|\|/,'완료된 작업은 실제 글 제목을 보여 준다');
 // 글 번호를 모르는 예전 작업은 기존처럼 목록만 연다.
 assert.match(ui,/if\(!done\.length\)\{navs\.contents\.click\(\);\$\('refresh'\)\.click\(\);return;\}/);
});

test('목록은 이벤트를 받으면 필터를 풀고 해당 글의 페이지로 가서 그 줄을 표시한다',()=>{
 assert.match(app,/document\.addEventListener\('qrator:focus-records'/);
 assert.match(app,/async function focusRecords/);
 assert.match(app,/\['search','categoryFilter','statusFilter','reviewFilter','tagFilter','dateFrom','dateTo'\]/);
 assert.match(app,/locateRecords\(state\.filtered,wanted/);
 assert.match(app,/class="row-focus"/);
 assert.match(app,/scrollIntoView\(\{block:'center'\}\)/);
 assert.match(css,/\.content-table tr\.row-focus td/);
 assert.match(css,/prefers-reduced-motion/);
});
