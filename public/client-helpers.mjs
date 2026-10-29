export const CATEGORIES=['상호 변경','본점 이전','목적 변경','임원 변경','지점 변경'];
export const STATUS={scheduled:'게시 예정',draft:'작성 중',needs_changes:'수정 필요',ready:'전달 준비 완료',delivered:'전달 완료',private:'비공개'};
export function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function safeArchivePath(value){if(typeof value!=='string'||value.length>240||value.startsWith('/')||/[\x00-\x1f\\:]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('안전하지 않은 ZIP 파일 경로입니다.');return value;}
export function resolveAsset(entry,reference){
 if(!reference||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference))return null;
 const clean=reference.split(/[?#]/)[0];let decoded;try{decoded=decodeURIComponent(clean);}catch{return null;}
 const result=entry.split('/').slice(0,-1);if(decoded.startsWith('/'))result.length=0;
 for(const part of decoded.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!result.length)return null;result.pop();}else result.push(part);}
 try{return safeArchivePath(result.join('/'));}catch{return null;}
}
export function slugify(value){return String(value).toLowerCase().replace(/\.html?$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'guide-'+Date.now().toString(36);}
export function metadataFromHTML(html,file){
 const doc=new DOMParser().parseFromString(html,'text/html');const heading=doc.querySelector('h1')?.textContent?.trim();
 const title=heading||doc.title.split('|')[0].trim()||file.replace(/\.html?$/,'');
 const text=doc.body.textContent||'';
 const category=CATEGORIES.find(c=>text.includes(c))||'상호 변경';
 return {title:title.slice(0,100),category,summary:doc.querySelector('meta[name="description"]')?.content?.slice(0,200)||'',slug:slugify(file.split('/').pop())};
}
export async function readArchive(file,Zip){
 if(file.size>15*1024*1024)throw new Error('ZIP은 15MB 이내로 올려 주세요.');
 const zip=await Zip.loadAsync(await file.arrayBuffer());const entries=Object.values(zip.files).filter(x=>!x.dir);
 if(entries.length>300)throw new Error('ZIP 파일 수는 300개 이하로 올려 주세요.');
 const htmlFiles=[];const assets=[];let total=0;
 for(const entry of entries){
  const original=entry.unsafeOriginalName||entry.name;safeArchivePath(original);const path=safeArchivePath(entry.name);
  if(path.startsWith('__MACOSX/')||path.split('/').pop()==='.DS_Store')continue;
  if(entry._data?.uncompressedSize>3000000)throw new Error('개별 파일은 약 2MB 이내로 올려 주세요.');
  const bytes=await entry.async('uint8array');total+=bytes.length;if(total>40*1024*1024)throw new Error('압축 해제 크기는 40MB 이하로 올려 주세요.');
  if(/\.html?$/i.test(path))htmlFiles.push({entryPath:path,html:new TextDecoder().decode(bytes)});
  else assets.push({path,base64:await entry.async('base64'),mime:mime(path)});
 }
 if(!htmlFiles.length)throw new Error('ZIP 안에 HTML 파일이 없습니다.');
 return htmlFiles.map(x=>({...metadataFromHTML(x.html,x.entryPath),...x,assets}));
}
export function mime(path){const ext=path.split('.').pop().toLowerCase();return {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',css:'text/css',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf'}[ext]||'application/octet-stream';}
export function previewHTML(record){
 const doc=new DOMParser().parseFromString(record.html,'text/html');doc.querySelectorAll('base,meta[http-equiv="refresh"]').forEach(x=>x.remove());
 const assets=new Map(record.assets.map(x=>[x.path,x]));
 function dataURL(asset,seen=new Set()){
  if(asset.mime==='text/css'&&!seen.has(asset.path)){
   seen.add(asset.path);let css=new TextDecoder().decode(Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)));
   css=css.replace(/url\((['"]?)([^)'"]+)\1\)/g,(full,q,ref)=>{const path=resolveAsset(asset.path,ref);const dep=assets.get(path);return dep&&!seen.has(dep.path)?'url("'+dataURL(dep,new Set(seen))+'")':full;});
   return 'data:text/css;base64,'+btoa(unescape(encodeURIComponent(css)));
  }return 'data:'+asset.mime+';base64,'+asset.base64;
 }
 for(const node of doc.querySelectorAll('[src],[href],[poster]')){
  for(const attr of ['src','href','poster']){const value=node.getAttribute(attr);if(!value)continue;
   const found=assets.get(resolveAsset(record.entryPath,value));if(found){node.setAttribute('data-studio-original-'+attr,value);node.setAttribute(attr,dataURL(found));}}
 }
 const csp=doc.createElement('meta');csp.setAttribute('http-equiv','Content-Security-Policy');csp.content="default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; style-src 'unsafe-inline' data: blob: https:; img-src data: blob: https:; font-src data: blob: https:";csp.setAttribute('data-studio-temporary','true');doc.head.prepend(csp);
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
export function editedHTML(doc,metadata){
 const clone=doc.documentElement.cloneNode(true);clone.querySelectorAll('[data-studio-temporary]').forEach(x=>x.remove());
 for(const node of clone.querySelectorAll('[data-studio-original-src],[data-studio-original-href],[data-studio-original-poster]')){
  for(const attr of ['src','href','poster']){const key='data-studio-original-'+attr;if(node.hasAttribute(key)){node.setAttribute(attr,node.getAttribute(key));node.removeAttribute(key);}}
 }
 clone.querySelector('body')?.removeAttribute('contenteditable');clone.querySelector('body')?.removeAttribute('spellcheck');
 const title=clone.querySelector('title');if(title)title.textContent=metadata.title+' | 큐레이터';
 const h1=clone.querySelector('h1');if(h1)h1.textContent=metadata.title;
 const description=clone.querySelector('meta[name="description"]');if(description)description.content=metadata.seoDescription||metadata.summary;
 return '<!doctype html>\n'+clone.outerHTML;
}
export async function exportFolder(records,Zip){
 const zip=new Zip();const root=zip.folder('qrator-guides');const items=[];
 for(const record of records){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug))throw new Error('콘텐츠 주소가 올바르지 않습니다.');
  const container='articles/'+record.slug+'/';const folder=container+'source/';const entryPath=safeArchivePath(record.entryPath);
  root.file(folder+entryPath,record.html);
  for(const asset of record.assets)root.file(folder+safeArchivePath(asset.path),asset.base64,{base64:true});
  const {html,assets,history,...meta}=record;
  root.file(container+'content.json',JSON.stringify({...meta,entryPath,assets:assets.map(({path,mime})=>({path,mime}))},null,2));
  items.push({...meta,file:folder+entryPath,assetCount:assets.length});
 }
 root.file('manifest.json',JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),count:items.length,items},null,2));
 root.file('index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>큐레이터 등기 가이드 전달 목록</title><style>body{font:16px/1.7 sans-serif;max-width:1000px;margin:60px auto;padding:24px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:14px;text-align:left}a{color:#0366ff}</style><h1>큐레이터 등기 가이드 전달 목록</h1><table><thead><tr><th>카테고리</th><th>제목</th><th>검토 상태</th><th>수정자</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+esc(x.category)+'</td><td><a href="'+esc(x.file)+'">'+esc(x.title)+'</a></td><td>'+esc(STATUS[x.status])+'</td><td>'+esc(x.updatedBy)+'</td></tr>').join('')+'</tbody></table></html>');
 root.file('README.txt','Qrator 등기 가이드 개발팀 전달 패키지\n\nindex.html: 검토 목록\nmanifest.json: 제목·카테고리·상태·출처·원본 경로\narticles/{slug}/: 본문 HTML, 첨부 파일, content.json\n\n각 글의 기존 상대 경로를 보존했습니다. 외부 URL 자원은 원문 연결을 유지합니다.\n이 패키지를 내려받아도 홈페이지가 자동으로 공개되지는 않습니다.\n');
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
