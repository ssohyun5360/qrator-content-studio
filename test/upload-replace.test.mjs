import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from '../lib/core.mjs';
import {S3Client} from '@aws-sdk/client-s3';

const TOKEN='t'.repeat(40);
const env={STUDIO_PASSWORD:'test-password-123456789',SESSION_SECRET:'x'.repeat(40),AWS_REGION:'ap-northeast-2',S3_BUCKET:'test-bucket',APP_ORIGIN:'https://studio.example',CONTENT_UPLOAD_TOKEN:TOKEN};
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

const {default:upload}=await import('../api/content-upload.js');
const {default:studio}=await import('../api/studio.js');
const cookie='studio_session='+session(env);
const stored=slug=>JSON.parse(store.get('studio/records/'+slug+'.json').body);

async function callUpload(body,token=TOKEN){
 const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
 await upload({method:'POST',headers:{authorization:'Bearer '+token},body},r);return r;
}
async function callStudio(op,body){
 const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
 await studio({method:'POST',query:{op},body,headers:{cookie,origin:env.APP_ORIGIN}},r);return r;
}
const rec=(slug,extra={})=>({slug,title:'제목 '+slug,category:'임원',summary:'요약',author:'클로드 자동화',html:'<p>원본</p>',entryPath:'index.html',assets:[{path:'assets/thumbnail.webp',mime:'image/webp',base64:'aGk='}],tags:['a'],sourceUrls:[],...extra});

test('새 글은 등록되고, replace 없이 같은 주소를 또 보내면 기존처럼 409',async()=>{
 store.clear();
 assert.equal((await callUpload(rec('post-a'))).code,201);
 assert.equal((await callUpload(rec('post-a'))).code,409);
 assert.equal(stored('post-a').html,'<p>원본</p>');
});

test('replace: 손대지 않은 글인데 내용이 같으면 아무것도 바꾸지 않는다',async()=>{
 store.clear();
 await callUpload(rec('post-b'));
 const before=stored('post-b');
 const r=await callUpload({...rec('post-b'),replace:true});
 assert.equal(r.code,200);assert.equal(r.data.unchanged,true);
 assert.equal(stored('post-b').revision,before.revision);
});

test('replace: 손대지 않은 글은 새 내용으로 덮어쓰고, 최초 등록일과 빈 이력을 유지한다',async()=>{
 store.clear();
 await callUpload(rec('post-c'));
 const before=stored('post-c');
 const r=await callUpload({...rec('post-c',{html:'<p>새 원고</p>',assets:[{path:'assets/thumbnail.webp',mime:'image/webp',base64:'bmV3'}]}),replace:true});
 assert.equal(r.code,200);assert.equal(r.data.replaced,true);
 const after=stored('post-c');
 assert.equal(after.html,'<p>새 원고</p>');assert.equal(after.assets[0].base64,'bmV3');
 assert.equal(after.createdAt,before.createdAt);assert.notEqual(after.revision,before.revision);
 assert.equal(after.history.length,0);assert.equal(after.status,'draft');assert.equal(after.reviewStatus,'pending');
});

test('replace: 사람이 한 번이라도 수정한 글은 덮어쓰지 않는다',async()=>{
 store.clear();
 await callUpload(rec('post-d'));
 const first=stored('post-d');
 const saved=await callStudio('save',{record:{...first,title:'사람이 고친 제목'},expectedRevision:first.revision});
 assert.equal(saved.code,200);
 const r=await callUpload({...rec('post-d',{html:'<p>자동 갱신 시도</p>'}),replace:true});
 assert.equal(r.code,409);
 const after=stored('post-d');
 assert.equal(after.title,'사람이 고친 제목');assert.equal(after.html,'<p>원본</p>');
});

test('replace: 휴지통에 있는 글은 되살리지 않는다',async()=>{
 store.clear();
 await callUpload(rec('post-e'));
 const first=stored('post-e');
 assert.equal((await callStudio('delete',{slug:'post-e',expectedRevision:first.revision})).code,200);
 assert.equal((await callUpload({...rec('post-e',{html:'<p>새</p>'}),replace:true})).code,409);
 assert.ok(stored('post-e').deletedAt);
});

test('replace: 없는 글이면 새로 등록하고, 잘못된 토큰은 replace여도 거부한다',async()=>{
 store.clear();
 assert.equal((await callUpload({...rec('post-f'),replace:true})).code,201);
 assert.equal((await callUpload({...rec('post-f',{html:'<p>x</p>'}),replace:true},'wrong'.repeat(10))).code,401);
 assert.equal(stored('post-f').html,'<p>원본</p>');
});
