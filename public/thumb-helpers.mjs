// 목록용 1:1 썸네일과 상세용 16:9 대표 이미지를 가르는 규칙.
// 서버(lib/core.mjs)와 브라우저(app.mjs)가 같은 규칙을 쓰도록 의존성 없는 순수 함수로 둔다.
//
// 약속: 한 글의 이미지 중 파일명이 `-square`·`_square`·`-1x1` 로 끝나는 것이 목록용 1:1 썸네일이다.
//       그 밖의 `thumbnail`/`thumb` 이 들어간 이미지(없으면 첫 이미지)가 상세용 대표 이미지(16:9)다.
export const COVER_RATIO=16/9;
export const COVER_VARIANTS=['cover','square'];
const SQUARE_NAME=/(?:^|[/_-])(?:square|1x1)\.[a-z0-9]+$/i;
const IMAGE_EXT=/\.(png|jpe?g|webp|gif|avif|svg)$/i;
export const isImageAsset=asset=>String(asset?.mime||'').startsWith('image/')||IMAGE_EXT.test(String(asset?.path||''));
export const isSquareAsset=asset=>isImageAsset(asset)&&SQUARE_NAME.test(String(asset.path||''));
const looksLikeThumb=asset=>/thumb(nail)?/i.test(String(asset?.path||''));

// {cover, square}: 없으면 null. 1:1 파일만 있는 글은 cover 도 그 파일을 가리켜 예전처럼 목록에 나온다.
export function pickThumbnails(assets=[]){
 const images=(assets||[]).filter(isImageAsset);
 const squares=images.filter(isSquareAsset);
 const square=squares.find(looksLikeThumb)||squares[0]||null;
 const others=images.filter(asset=>!isSquareAsset(asset));
 // 썸네일 이름이 붙은 이미지가 우선이고, 로고처럼 이름 없는 이미지는 그다음이다.
 const cover=others.find(looksLikeThumb)||(square&&looksLikeThumb(square)?square:null)||others[0]||square;
 return {cover:cover||null,square};
}

// 어떤 변형(cover|square)으로 내보낼 이미지인지. square 가 없으면 null.
export function thumbnailAsset(assets,variant){
 const {cover,square}=pickThumbnails(assets);
 return variant==='square'?square:cover;
}

// 새로 올리는 이미지의 표준 경로. 확장자만 바뀌어도 같은 이름을 유지한다.
export function thumbnailPaths(slug,ext){
 const clean=String(ext||'').replace(/^\./,'').toLowerCase();
 return {cover:`assets/thumbnails/${slug}.${clean}`,square:`assets/thumbnails/${slug}-square.${clean}`};
}

// 비율을 사람이 읽는 말로. 16:9 와 1:1 은 5% 안쪽이면 같은 것으로 본다.
export function describeRatio(width,height){
 if(!(width>0)||!(height>0))return {kind:'unknown',label:'비율을 알 수 없어요'};
 const ratio=width/height;
 if(Math.abs(ratio-1)<=0.05)return {kind:'square',label:'1:1'};
 if(Math.abs(ratio/COVER_RATIO-1)<=0.05)return {kind:'wide',label:'16:9'};
 return {kind:'other',label:ratio>=1?(ratio.toFixed(2)+':1'):('1:'+(1/ratio).toFixed(2))};
}
