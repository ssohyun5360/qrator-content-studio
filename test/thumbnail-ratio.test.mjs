import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {S3Client} from '@aws-sdk/client-s3';
import {pickThumbnails,describeRatio,thumbnailPaths,isSquareAsset} from '../public/thumb-helpers.mjs';
import {renderSquareCoverSvg,renderCoverSvg,SQUARE_SIZE,measureLine,TITLE_MAX_WIDTH} from '../lib/ai/thumbnail.mjs';

const env={STUDIO_PASSWORD:'test-password-123456789',SESSION_SECRET:'x'.repeat(40),AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket',APP_ORIGIN:'https://studio.example',CONTENT_UPLOAD_TOKEN:'t'.repeat(40)};
Object.assign(process.env,env);
const store=new Map();let counter=0;
S3Client.prototype.send=async function(command){
 const p=command.input;
 switch(command.constructor.name){
  case 'GetObjectCommand':{const r=store.get(p.Key);if(!r)throw Object.assign(new Error(),{name:'NoSuchKey'});return {ETag:r.etag,Body:{transformToString:async()=>r.body}};}
  case 'PutObjectCommand':{const old=store.get(p.Key);if((p.IfNoneMatch&&old)||(p.IfMatch&&old?.etag!==p.IfMatch))throw {$metadata:{httpStatusCode:412}};store.set(p.Key,{etag:String(++counter),body:p.Body});return {};}
  case 'ListObjectsV2Command':return {Contents:[...store.keys()].filter(k=>k.startsWith(p.Prefix)).map(Key=>({Key}))};
  default:throw new Error(command.constructor.name);
 }
};
const {summary,thumbnailLinks,thumbnailSignature,verifyThumbnailSignature,session}=await import('../lib/core.mjs');
const {default:studio}=await import('../api/studio.js');
const {default:thumbnailApi}=await import('../api/thumbnail.js');
const {default:contentThumbnail}=await import('../api/content-thumbnail.js');

const A=(path,mime='image/webp')=>({path,mime,base64:'aGk='});

test('목록은 1:1(-square) 이미지를, 상세는 16:9 대표 이미지를 고른다',()=>{
 const wide=A('assets/thumbnails/a.webp'),square=A('assets/thumbnails/a-square.webp'),logo=A('assets/qrator-logo.svg','image/svg+xml');
 assert.deepEqual(pickThumbnails([square,logo,wide]),{cover:wide,square});
 assert.deepEqual(pickThumbnails([wide,logo]),{cover:wide,square:null});
 assert.equal(pickThumbnails([]).cover,null);
 // 1:1 만 있는 예전 글: 대표 이미지도 같은 파일을 가리켜 목록·상세 모두 그대로 동작한다
 const only=pickThumbnails([A('assets/thumbnail-square.png','image/png')]);
 assert.equal(only.cover,only.square);
 // 이름 없는 로고보다 썸네일 이름이 붙은 1:1 이 대표 이미지가 된다
 assert.equal(pickThumbnails([logo,square]).cover,square);
 for(const name of ['a-square.png','a_square.png','a-1x1.webp','square.png'])assert.ok(isSquareAsset(A('assets/'+name)),name);
 for(const name of ['a-squared.png','squares.png','thumb.png'])assert.ok(!isSquareAsset(A('assets/'+name)),name);
 assert.equal(isSquareAsset({path:'assets/a-square.woff2',mime:'font/woff2'}),false,'이미지가 아니면 제외');
 assert.deepEqual(thumbnailPaths('x','.PNG'),{cover:'assets/thumbnails/x.png',square:'assets/thumbnails/x-square.png'});
});

test('summary 는 목록용·상세용 경로를 따로 돌려주고 기존 thumbnailPath 의미를 지킨다',()=>{
 const base={slug:'s',title:'t',html:'<p/>',assets:[]};
 assert.deepEqual([summary(base).thumbnailPath,summary(base).thumbnailSquarePath],[null,null]);
 const both=summary({...base,assets:[A('assets/thumbnails/s-square.svg','image/svg+xml'),A('assets/thumbnails/s.svg','image/svg+xml')]});
 assert.equal(both.thumbnailPath,'assets/thumbnails/s.svg');assert.equal(both.thumbnailSquarePath,'assets/thumbnails/s-square.svg');
 assert.equal(both.html,undefined);assert.equal(both.assets,undefined);
 const legacy=summary({...base,assets:[A('assets/thumbnail.webp')]});
 assert.equal(legacy.thumbnailPath,'assets/thumbnail.webp');assert.equal(legacy.thumbnailSquarePath,null);
});

test('비율 판정: 16:9·1:1 은 5% 안쪽을 같은 것으로 본다',()=>{
 assert.equal(describeRatio(1280,720).kind,'wide');assert.equal(describeRatio(1256,760).kind,'other','예전 1256x760 은 16:9 가 아니다');
 assert.equal(describeRatio(720,720).kind,'square');assert.equal(describeRatio(700,720).kind,'square');
 assert.equal(describeRatio(1200,900).label,'1.33:1');assert.equal(describeRatio(0,0).kind,'unknown');
});

test('1:1 커버: 720x720, 글자는 path, 가장 긴 제목도 폭 안에 들어온다',async()=>{
 const svg=await renderSquareCoverSvg({line1:'임원 변경 등기',line2:'대표이사와 사내이사 차이'});
 assert.match(svg,/^<svg[^>]*width="720"[^>]*height="720"/);
 assert.deepEqual(SQUARE_SIZE,{width:720,height:720});
 assert.ok(Buffer.byteLength(svg)<500_000);
 assert.ok(!svg.includes('<text')&&!/<script|onload=|onerror=|href="https?:/i.test(svg));
 assert.ok(TITLE_MAX_WIDTH<SQUARE_SIZE.width-40,'제목 최대 폭이 1:1 캔버스 좌우 여백 20px 이상을 남긴다');
 assert.ok(measureLine('대표이사와 사내이사 차이')<=TITLE_MAX_WIDTH);
 await assert.rejects(()=>renderSquareCoverSvg({line1:'임원 변경 등기',line2:'가나다라마바사아자차카타파하가나다'}),/너무 깁니다/);
 await assert.rejects(()=>renderSquareCoverSvg({line1:'',line2:'a'}));
 // 16:9 와 같은 문구를 쓰므로 두 이미지는 항상 같은 제목이다
 const wide=await renderCoverSvg({line1:'임원 변경 등기',line2:'대표이사와 사내이사 차이'});
 assert.match(wide,/width="1280"/);
});

// ── 서명된 공개 이미지 주소 ──
const login=()=>session(env);
const cookie=()=>'studio_session='+login();
const mkRes=()=>({headers:{},statusCode:0,body:undefined,setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(d){this.body=d;return this;},send(d){this.body=d;return this;},end(){return this;}});
async function callStudio(op,{method='GET',body={},query={}}={}){const res=mkRes();await studio({method,query:{op,...query},body,headers:{cookie:cookie(),origin:env.APP_ORIGIN}},res);return res;}
async function callThumb(query,{method='GET',headers={}}={}){const res=mkRes();await thumbnailApi({method,query,headers},res);return res;}
const record=(slug,extra={})=>({slug,title:'제목 '+slug,category:'임원 변경',summary:'요약',author:'작성자',html:'<img src="./assets/thumbnails/'+slug+'.svg">',entryPath:'index.html',assets:[A('assets/thumbnails/'+slug+'.svg','image/svg+xml'),A('assets/thumbnails/'+slug+'-square.svg','image/svg+xml')],tags:[],status:'draft',...extra});

test('get 은 대표·목록 이미지의 공개 주소를 서명과 함께 주고, 주소는 이미지를 바꿔도 그대로다',async()=>{
 store.clear();
 const saved=await callStudio('save',{method:'POST',body:{record:record('sample-post')}});assert.equal(saved.statusCode,200);
 const got=await callStudio('get',{query:{slug:'sample-post'}});assert.equal(got.statusCode,200);
 const links=got.body.imageLinks;
 assert.match(links.cover,/^https:\/\/studio\.example\/api\/thumbnail\?slug=sample-post&variant=cover&sig=[\w-]{32}$/);
 assert.match(links.square,/variant=square/);
 assert.deepEqual(links,thumbnailLinks(got.body,process.env));
 const noSquare=await callStudio('save',{method:'POST',body:{record:record('only-cover',{assets:[A('assets/thumbnails/only-cover.svg','image/svg+xml')]})}});assert.equal(noSquare.statusCode,200);
 const links2=(await callStudio('get',{query:{slug:'only-cover'}})).body.imageLinks;
 assert.ok(links2.cover);assert.equal(links2.square,undefined);
 // 저장해도 imageLinks 가 글에 섞여 들어가지 않는다
 const stored=JSON.parse(store.get('studio/records/sample-post.json').body);assert.equal(stored.imageLinks,undefined);
 const list=await callStudio('list');const row=list.body.items.find(x=>x.slug==='sample-post');
 assert.equal(row.thumbnailPath,'assets/thumbnails/sample-post.svg');assert.equal(row.thumbnailSquarePath,'assets/thumbnails/sample-post-square.svg');
});

test('서명: 글·종류마다 다르고 위조·다른 글 재사용은 거부, 전용 키로 바꿀 수 있다',()=>{
 const sig=thumbnailSignature('a','cover',env);
 assert.ok(verifyThumbnailSignature('a','cover',sig,env));
 assert.ok(!verifyThumbnailSignature('a','square',sig,env));
 assert.ok(!verifyThumbnailSignature('b','cover',sig,env));
 assert.ok(!verifyThumbnailSignature('a','cover',sig.slice(0,-1)+(sig.endsWith('A')?'B':'A'),env));
 assert.ok(!verifyThumbnailSignature('a','cover','',env));assert.ok(!verifyThumbnailSignature('a','cover',undefined,env));
 const own={...env,THUMBNAIL_LINK_SECRET:'k'.repeat(40)};
 assert.notEqual(thumbnailSignature('a','cover',own),sig);
 assert.equal(thumbnailSignature('a','cover',{...env,THUMBNAIL_LINK_SECRET:'짧음'}),sig,'32자 미만 전용 키는 무시');
 assert.notEqual(thumbnailSignature('a','cover',{...env,SESSION_SECRET:'y'.repeat(40)}),sig,'SESSION_SECRET 이 바뀌면 주소가 무효가 된다');
});

test('/api/thumbnail: 로그인 없이 서명이 맞으면 이미지만 내려주고 캐시·보안 헤더를 붙인다',async()=>{
 store.clear();await callStudio('save',{method:'POST',body:{record:record('open-post')}});
 const sig=thumbnailSignature('open-post','cover',env);
 const ok=await callThumb({slug:'open-post',variant:'cover',sig});
 assert.equal(ok.statusCode,200);assert.equal(ok.headers['Content-Type'],'image/svg+xml');
 assert.ok(Buffer.isBuffer(ok.body)&&ok.body.toString()==='hi');
 assert.match(ok.headers['Cache-Control'],/public, max-age=300/);
 assert.equal(ok.headers['Access-Control-Allow-Origin'],'*');
 assert.match(ok.headers['Content-Security-Policy'],/sandbox/);assert.equal(ok.headers['X-Content-Type-Options'],'nosniff');
 // 같은 ETag 로 다시 물으면 304
 const again=await callThumb({slug:'open-post',variant:'cover',sig},{headers:{'if-none-match':ok.headers.ETag}});assert.equal(again.statusCode,304);
 // variant 를 생략하면 대표 이미지(cover)
 assert.equal((await callThumb({slug:'open-post',sig})).statusCode,200);
 assert.equal((await callThumb({slug:'open-post',variant:'square',sig:thumbnailSignature('open-post','square',env)})).statusCode,200);
 assert.equal((await callThumb({slug:'open-post',variant:'cover',sig},{method:'HEAD'})).statusCode,200);
});

test('/api/thumbnail: 잘못된 서명·종류·글, 휴지통·비공개 글, 1:1 이 없는 글, 허용되지 않은 방식은 막는다',async()=>{
 store.clear();
 await callStudio('save',{method:'POST',body:{record:record('p-one',{assets:[A('assets/thumbnails/p-one.svg','image/svg+xml')]})}});
 const sig=slug=>variant=>thumbnailSignature(slug,variant,env);
 assert.equal((await callThumb({slug:'p-one',variant:'cover'})).statusCode,403,'서명 없음');
 assert.equal((await callThumb({slug:'p-one',variant:'cover',sig:'a'.repeat(32)})).statusCode,403,'서명 틀림');
 assert.equal((await callThumb({slug:'p-one',variant:'square',sig:sig('p-one')('cover')})).statusCode,403,'다른 종류 서명 재사용');
 assert.equal((await callThumb({slug:'p-one',variant:'wide',sig:sig('p-one')('cover')})).statusCode,400,'알 수 없는 종류');
 assert.equal((await callThumb({slug:'../x',variant:'cover',sig:'a'.repeat(32)})).statusCode,400,'잘못된 주소');
 assert.equal((await callThumb({slug:'ghost',variant:'cover',sig:sig('ghost')('cover')})).statusCode,404,'없는 글');
 assert.equal((await callThumb({slug:'p-one',variant:'square',sig:sig('p-one')('square')})).statusCode,404,'1:1 이 없으면 대표 이미지를 대신 내주지 않는다');
 assert.equal((await callThumb({slug:'p-one',variant:'cover',sig:sig('p-one')('cover')},{method:'POST'})).statusCode,405);
 const first=(await callStudio('get',{query:{slug:'p-one'}})).body;
 // 비공개 글은 서명이 맞아도 열지 않는다
 const priv=await callStudio('save',{method:'POST',body:{record:{...first,status:'private'},expectedRevision:first.revision}});assert.equal(priv.statusCode,200);
 assert.equal((await callThumb({slug:'p-one',variant:'cover',sig:sig('p-one')('cover')})).statusCode,404,'비공개');
 await callStudio('save',{method:'POST',body:{record:{...first,status:'draft'},expectedRevision:priv.body.revision}});
 assert.equal((await callThumb({slug:'p-one',variant:'cover',sig:sig('p-one')('cover')})).statusCode,200,'다시 공개');
 const current=(await callStudio('get',{query:{slug:'p-one'}})).body;
 await callStudio('delete',{method:'POST',body:{slug:'p-one',expectedRevision:current.revision}});
 assert.equal((await callThumb({slug:'p-one',variant:'cover',sig:sig('p-one')('cover')})).statusCode,404,'휴지통');
 // 연결 설정이 없으면 이미지 대신 오류 JSON
 const saved=process.env.SESSION_SECRET;process.env.SESSION_SECRET='';
 assert.equal((await callThumb({slug:'p-one',variant:'cover',sig:'a'.repeat(32)})).statusCode,503);process.env.SESSION_SECRET=saved;
});

// ── 외부 도구가 썸네일을 따로 붙이는 API ──
async function callUpload(body,{token=env.CONTENT_UPLOAD_TOKEN}={}){const res=mkRes();await contentThumbnail({method:'POST',headers:{authorization:token===null?'':'Bearer '+token},body},res);return res;}
const PNG=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('rest')]).toString('base64');
const WEBP=Buffer.concat([Buffer.from('RIFF'),Buffer.from([4,0,0,0]),Buffer.from('WEBPVP8 ')]).toString('base64');
const svgB64=text=>Buffer.from(text).toString('base64');

test('썸네일 API: webp·png 같은 이미지도 받고, 본문이 가리키던 옛 확장자 경로를 새 파일로 맞춘다',async()=>{
 store.clear();
 // HTML 만 가져와 이미지가 빠진 글: 본문은 .webp 를 가리키지만 파일이 없다
 await callStudio('save',{method:'POST',body:{record:record('late-image',{html:'<figure class="qbe-cover"><img src="./assets/thumbnails/late-image.webp" width="1280" height="720"></figure>',assets:[]})}});
 const up=await callUpload({slug:'late-image',asset:{path:'assets/thumbnails/late-image.png',mime:'image/png',base64:PNG}});
 assert.equal(up.statusCode,200,JSON.stringify(up.body));assert.equal(up.body.item.variant,'cover');assert.equal(up.body.item.htmlUpdated,true);
 const after=(await callStudio('get',{query:{slug:'late-image'}})).body;
 assert.ok(after.html.includes('./assets/thumbnails/late-image.png')&&!after.html.includes('.webp'),after.html);
 assert.equal(summary(after).thumbnailPath,'assets/thumbnails/late-image.png');
 assert.ok(after.imageLinks.cover,'썸네일이 붙으면 공개 주소가 생긴다');
 // 상세용을 webp 로 교체하면 본문 경로도 따라가고, 목록용 1:1 은 건드리지 않는다
 await callUpload({slug:'late-image',asset:{path:'assets/thumbnails/late-image-square.png',mime:'image/png',base64:PNG}});
 const swap=await callUpload({slug:'late-image',asset:{path:'assets/thumbnails/late-image.webp',mime:'image/webp',base64:WEBP}});
 assert.equal(swap.statusCode,200);
 const fin=(await callStudio('get',{query:{slug:'late-image'}})).body;
 assert.deepEqual(fin.assets.map(a=>a.path).sort(),['assets/thumbnails/late-image-square.png','assets/thumbnails/late-image.webp']);
 assert.ok(fin.html.includes('late-image.webp')&&!fin.html.includes('late-image.png'));
 assert.equal(swap.body.item.coverPath,'assets/thumbnails/late-image.webp');assert.equal(swap.body.item.squarePath,'assets/thumbnails/late-image-square.png');
});

test('썸네일 API: 이름·형식·내용·크기가 어긋나거나 위험한 파일은 거부한다',async()=>{
 store.clear();await callStudio('save',{method:'POST',body:{record:record('guard-post',{assets:[]})}});
 const send=(path,mime,base64)=>callUpload({slug:'guard-post',asset:{path,mime,base64}});
 assert.equal((await send('assets/thumbnails/other.png','image/png',PNG)).statusCode,400,'다른 글 이름');
 assert.equal((await send('assets/thumbnails/guard-post.gif','image/gif',PNG)).statusCode,400,'허용하지 않는 확장자');
 assert.equal((await send('assets/thumbnails/guard-post.png','image/jpeg',PNG)).statusCode,400,'mime 불일치');
 assert.equal((await send('assets/thumbnails/guard-post.jpg','image/jpeg',PNG)).statusCode,400,'내용이 JPEG 가 아님');
 assert.equal((await send('assets/thumbnails/guard-post.png','image/png',WEBP)).statusCode,400,'내용이 PNG 가 아님');
 assert.equal((await send('assets/thumbnails/guard-post.svg','image/svg+xml',svgB64('<svg onload="x()"></svg>'))).statusCode,400,'스크립트가 든 SVG');
 assert.equal((await send('assets/thumbnails/guard-post.svg','image/svg+xml',svgB64('<svg><script>1</script></svg>'))).statusCode,400);
 assert.equal((await send('assets/thumbnails/guard-post.svg','image/svg+xml',svgB64('hello'))).statusCode,400,'SVG 가 아님');
 assert.equal((await send('assets/thumbnails/guard-post.png','image/png','!!!')).statusCode,400,'base64 아님');
 assert.equal((await send('assets/thumbnails/guard-post.svg','image/svg+xml',svgB64('<svg>'+'a'.repeat(500_001)+'</svg>'))).statusCode,413);
 assert.equal((await send('assets/thumbnails/guard-post.svg','image/svg+xml',svgB64('<svg viewBox="0 0 1 1"></svg>'))).statusCode,200,'정상 SVG');
 assert.equal((await callUpload({slug:'guard-post',asset:{path:'assets/thumbnails/guard-post.png',mime:'image/png',base64:PNG}},{token:'w'.repeat(40)})).statusCode,401);
 assert.equal((await callUpload({slug:'missing',asset:{path:'assets/thumbnails/missing.png',mime:'image/png',base64:PNG}})).statusCode,404);
});

test('화면: 목록은 64px 1:1 타일, 편집 화면은 16:9 와 1:1 두 칸, API 주소 연결 옵션',async()=>{
 const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
 assert.match(app,/r\.thumbnailSquarePath\|\|r\.thumbnailPath/);
 assert.match(app,/class="thumb-frame"/);
 assert.match(css,/\.thumb-frame\{[^}]*width:64px;height:64px/);
 assert.match(css,/\.thumb-frame \.thumb-image\{[^}]*object-fit:cover/);
 assert.match(html,/상세 화면 · 16:9/);assert.match(html,/목록 화면 · 1:1/);
 assert.match(html,/data-thumb-pick="cover"/);assert.match(html,/data-thumb-pick="square"/);
 assert.match(css,/\.thumb-preview\.ratio-wide\{[^}]*aspect-ratio:16\/9/);assert.match(css,/\.thumb-preview\.ratio-square\{[^}]*aspect-ratio:1\/1/);
 assert.equal((html.match(/data-export-api-images/g)||[]).length,2,'목록과 편집 화면에 같은 옵션');
 assert.match(app,/exportFolder\(records,window\.JSZip,\{imageMode\}\)/);
 assert.match(app,/missingImageRefs\(record\.html/);
});
