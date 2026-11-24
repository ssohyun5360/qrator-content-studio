import test from 'node:test';
import assert from 'node:assert/strict';
import {exportFolder,apiImageHTML,missingImageRefs,attachCoverToHTML,relativeRef,withSquareSiblings} from '../public/client-helpers.mjs';
import {default as JSZip} from 'jszip';

const asset=(path,mime='image/webp')=>({path,mime,base64:'aGk='});
const links={cover:'https://studio.example/api/thumbnail?slug=a&variant=cover&sig=AAAA',square:'https://studio.example/api/thumbnail?slug=a&variant=square&sig=BBBB'};
const rec=(extra={})=>({slug:'a',title:'글',category:'상호 변경',status:'draft',entryPath:'index.html',tags:[],
 html:'<figure class="qbe-cover"><img src="./assets/thumbnails/a.webp" width="1280" height="720"></figure><p><img src="assets/inline.png"></p><a href="assets/thumbnails/a.webp">원본</a>',
 assets:[asset('assets/thumbnails/a.webp'),asset('assets/thumbnails/a-square.webp'),asset('assets/inline.png','image/png')],imageLinks:links,...extra});

test('API 모드: 썸네일 <img> 만 공개 주소로 바꾸고 다른 이미지·링크는 그대로 둔다(& 는 HTML 규칙대로 이스케이프)',()=>{
 const html=apiImageHTML(rec());
 assert.ok(html.includes('src="https://studio.example/api/thumbnail?slug=a&amp;variant=cover&amp;sig=AAAA"'),html);
 assert.ok(html.includes('src="assets/inline.png"'),'본문 속 다른 이미지는 파일 경로 그대로');
 assert.ok(html.includes('href="assets/thumbnails/a.webp"'),'<a href> 는 건드리지 않는다');
 assert.equal(apiImageHTML(rec({imageLinks:undefined})),rec().html,'주소가 없으면(저장 전) 원문 그대로');
 assert.equal(apiImageHTML(rec({entryPath:'x/y/index.html',html:'<img src="../../assets/thumbnails/a.webp">'})).includes('sig=AAAA'),true,'글 파일 위치 기준 상대 경로도 알아본다');
 assert.equal(apiImageHTML(rec({html:'<img src="https://cdn.example/a.webp">'})),'<img src="https://cdn.example/a.webp">','외부 이미지는 그대로');
});

test('ZIP 내보내기: 기본은 파일 경로, API 모드는 주소로 연결하되 파일도 함께 넣고 imageLinks 를 content.json 에 남긴다',async()=>{
 const read=async(zip,path)=>zip.file(path).async('string');
 const files=await JSZip.loadAsync(await exportFolder([rec()],JSZip));
 assert.ok((await read(files,'qrator-guides/articles/a/source/index.html')).includes('./assets/thumbnails/a.webp'));
 const content=JSON.parse(await read(files,'qrator-guides/articles/a/content.json'));
 assert.deepEqual(content.imageLinks,links,'기본 모드에서도 주소는 content.json 에 있다');
 assert.match(await read(files,'qrator-guides/README.txt'),/imageLinks/);
 const api=await JSZip.loadAsync(await exportFolder([rec()],JSZip,{imageMode:'api'}));
 const html=await read(api,'qrator-guides/articles/a/source/index.html');
 assert.ok(html.includes('sig=AAAA')&&!html.includes('src="./assets/thumbnails/a.webp"'));
 assert.ok(api.file('qrator-guides/articles/a/source/assets/thumbnails/a.webp'),'이미지 파일은 API 모드에서도 ZIP 에 들어 있다');
 assert.match(await read(api,'qrator-guides/README.txt'),/API 주소로 연결/);
});

test('HTML만 가져왔을 때 빠진 이미지를 찾아낸다',()=>{
 const html='<img src="./assets/thumbnails/a.webp"><img src="assets/inline.png"><img src="https://cdn.example/x.png"><img src="data:image/png;base64,AA"><img src="assets/thumbnails/a.webp">';
 assert.deepEqual(missingImageRefs(html,'index.html',[]).map(x=>x.path),['assets/thumbnails/a.webp','assets/inline.png']);
 assert.deepEqual(missingImageRefs(html,'index.html',[asset('assets/thumbnails/a.webp')]).map(x=>x.path),['assets/inline.png']);
 assert.deepEqual(missingImageRefs('<img src="../assets/a.png">','nested/index.html',[]).map(x=>x.path),['assets/a.png']);
 assert.deepEqual(missingImageRefs('<p>없음</p>','index.html',[]),[]);
});

test('상대 경로: 글 파일 위치를 기준으로 계산한다',()=>{
 assert.equal(relativeRef('index.html','assets/t/a.png'),'assets/t/a.png');
 assert.equal(relativeRef('nested/index.html','nested/assets/a.png'),'assets/a.png');
 assert.equal(relativeRef('nested/index.html','assets/a.png'),'../assets/a.png');
 assert.equal(relativeRef('a/b/index.html','assets/a.png'),'../../assets/a.png');
});

test('대표 이미지를 바꿀 때 본문: 옛 파일·없는 썸네일 경로를 새 경로로, 빈 자리에는 이미지를 넣는다',()=>{
 // 같은 이름에서 확장자만 바뀜
 const swapped=attachCoverToHTML(rec(),'assets/thumbnails/a.png','assets/thumbnails/a.webp');
 assert.equal(swapped.changed,true);assert.ok(swapped.html.includes('<img src="assets/thumbnails/a.png" width="1280"')||swapped.html.includes('src="assets/thumbnails/a.png"'));
 assert.ok(swapped.html.includes('assets/inline.png'),'다른 이미지는 그대로');
 assert.ok(swapped.html.includes('href="assets/thumbnails/a.webp"'),'링크는 그대로');
 // HTML만 가져와 파일이 없던 글: 없는 썸네일 경로를 가리키던 <img> 가 새 파일을 가리키게 된다
 const lost=attachCoverToHTML(rec({assets:[asset('assets/inline.png','image/png')]}),'assets/thumbnails/a.png',null);
 assert.equal(lost.changed,true);assert.ok(lost.html.includes('src="assets/thumbnails/a.png"'),lost.html);
 assert.ok(lost.html.includes('src="assets/inline.png"'));
 // 이미 새 경로를 가리키면 그대로 두되 '연결됨'으로 본다
 const same=attachCoverToHTML(rec({html:'<img src="./assets/thumbnails/a.png">'}),'assets/thumbnails/a.png',null);
 assert.equal(same.changed,true);assert.equal(same.html,'<img src="./assets/thumbnails/a.png">');
 // 새 글의 대표 이미지 자리(placeholder)에는 <img> 를 넣는다
 const placeholder='<figure class="qbe-cover"><div class="qbe-cover-placeholder" data-studio-cover-placeholder="true"><p>대표 이미지 영역</p></div></figure>';
 const filled=attachCoverToHTML(rec({html:placeholder,assets:[]}),'assets/thumbnails/a.png',null);
 assert.equal(filled.changed,true);assert.match(filled.html,/<figure class="qbe-cover"><img src="assets\/thumbnails\/a\.png" width="1280" height="720"/);assert.ok(!filled.html.includes('placeholder'));
 // 화면 편집에서 저장하면 안내 자리가 지워져 빈 figure 만 남는다: 거기에도 넣는다
 const emptyFigure=attachCoverToHTML(rec({html:'<h1>제목</h1><figure class="qbe-cover">\n</figure><p>본문</p>',assets:[]}),'assets/thumbnails/a.png',null);
 assert.equal(emptyFigure.changed,true);assert.match(emptyFigure.html,/<figure class="qbe-cover"><img src="assets\/thumbnails\/a\.png"[^>]*><\/figure><p>본문<\/p>/);
 // 넣을 곳이 없으면 changed=false 로 알린다
 assert.equal(attachCoverToHTML(rec({html:'<p>이미지 없음</p>',assets:[]}),'assets/thumbnails/a.png',null).changed,false);
 // 글 파일이 하위 폴더에 있으면 상대 경로로 넣는다
 const nested=attachCoverToHTML(rec({entryPath:'x/index.html',html:placeholder,assets:[]}),'assets/thumbnails/a.png',null);
 assert.ok(nested.html.includes('src="../assets/thumbnails/a.png"'),nested.html);
});

test('ZIP 가져오기: 본문이 부르지 않아도 같은 글의 -square 짝은 함께 가져온다',()=>{
 const all=[asset('assets/thumbnails/a.webp'),asset('assets/thumbnails/a-square.png','image/png'),asset('assets/thumbnails/b-square.webp'),asset('assets/other-square.webp'),{path:'assets/thumbnails/a-square.woff2',mime:'font/woff2',base64:''}];
 const got=withSquareSiblings([all[0]],all).map(a=>a.path).sort();
 assert.deepEqual(got,['assets/thumbnails/a-square.png','assets/thumbnails/a.webp']);
 assert.deepEqual(withSquareSiblings([],all),[]);
});
