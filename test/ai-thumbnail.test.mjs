import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCoverSvg,measureLine,COVER_SIZE,TITLE_MAX_WIDTH} from '../lib/ai/thumbnail.mjs';

const sample={line1:'임원 변경 등기',line2:'대표이사와 사내이사 차이'};

test('SVG 는 1280x720 이고 500KB 이하이며 글자가 path 로 그려진다',async()=>{
 const svg=await renderCoverSvg(sample);
 assert.match(svg,/^<svg[^>]*width="1280"[^>]*height="720"/);
 assert.ok(Buffer.byteLength(svg)<500_000,'기존 썸네일 API 는 SVG 500KB 이하만 받는다: '+Buffer.byteLength(svg));
 assert.ok(!svg.includes('<text'),'글자는 <text> 가 아니라 path 여야 한다');
 assert.ok((svg.match(/<path/g)||[]).length>=2,'제목 2줄은 path 로 그려져야 한다');
 assert.deepEqual(COVER_SIZE,{width:1280,height:720});
});

test('SVG 에 스크립트나 외부 주소가 없다',async()=>{
 const svg=await renderCoverSvg(sample);
 assert.ok(!/<script|onload=|onerror=|href="https?:/i.test(svg));
});

test('글자 폭 계산은 브라우저(Chrome) 측정값과 거의 같다',()=>{
 assert.ok(Math.abs(measureLine('임원 변경 등기')-360)<=6,String(measureLine('임원 변경 등기')));
 assert.ok(Math.abs(measureLine('대표이사와 사내이사 차이')-638)<=6,String(measureLine('대표이사와 사내이사 차이')));
});

test('한 줄이 너무 길면 글자를 줄이지 않고 오류',async()=>{
 await assert.rejects(()=>renderCoverSvg({line1:'임원 변경 등기',line2:'가나다라마바사아자차카타파하가나다'}),/너무 깁니다/);
 assert.ok(measureLine('가나다라마바사아자차카타파하가나다')>TITLE_MAX_WIDTH);
});

test('빈 문구·줄바꿈·너무 많은 글자는 거부한다',async()=>{
 await assert.rejects(()=>renderCoverSvg({line1:'',line2:'a'}));
 await assert.rejects(()=>renderCoverSvg({line1:'가\n나',line2:'a'}));
 await assert.rejects(()=>renderCoverSvg({line1:'가'.repeat(31),line2:'a'}));
 await assert.rejects(()=>renderCoverSvg({line1:undefined,line2:'a'}));
});

test('글자에 HTML 이 섞여도 그대로 글자로만 그려진다',async()=>{
 const svg=await renderCoverSvg({line1:'<b>등기</b>',line2:'a&b'});
 assert.ok(!svg.includes('<b>'));
});
