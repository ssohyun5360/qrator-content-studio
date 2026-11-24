import satori from 'satori';
import opentype from '@shuding/opentype.js';
import {readFileSync} from 'node:fs';

// 확정 디자인 '커버/1안 파랑 16x9' (1920x1080 컴포넌트 -> 1280x720). 기준 구현: 도구\auto\make_cover_16x9.py
export const COVER_SIZE={width:1280,height:720};
export const TITLE_MAX_WIDTH=640;
const K=1280/1920;
const FONT_PX=100*K,LINE_PX=122*K,SPACING_PX=-3*K;
const BG='#edf4ff',BAR='#214eb5',BLUE='#2f6be8',NAVY='#13203f';
const TITLE_TOP=274;

const asset=name=>readFileSync(new URL('./assets/'+name,import.meta.url));
const dataUri=(name,mime)=>`data:${mime};base64,${asset(name).toString('base64')}`;

let cache=null;
function load(){
 if(cache)return cache;
 const font=asset('Pretendard-ExtraBold.otf');
 const buffer=font.buffer.slice(font.byteOffset,font.byteOffset+font.byteLength);
 cache={
  font,parsed:opentype.parse(buffer),
  art:dataUri('cover-art.png','image/png'),
  badge:dataUri('cover-badge.png','image/png'),
  logo:dataUri('qrator-logo.svg','image/svg+xml')
 };
 return cache;
}

// 제목 한 줄이 차지하는 폭(px). 글자 사이 간격(-2px)을 마지막 글자 뒤까지 포함해 브라우저와 같게 계산한다.
export function measureLine(text){
 const {parsed}=load();
 return parsed.getAdvanceWidth(text,FONT_PX,{kerning:true})+SPACING_PX*[...text].length;
}

function checkLine(label,text){
 if(typeof text!=='string'||!text.trim())throw new Error(`${label} 문구를 입력해 주세요.`);
 if(/[\r\n]/.test(text)||[...text].length>30)throw new Error(`${label} 문구는 한 줄, 30자 이내로 입력해 주세요.`);
 const width=measureLine(text);
 if(width>TITLE_MAX_WIDTH)throw new Error(`${label} 문구가 너무 깁니다(폭 ${Math.round(width)}px, 한계 ${TITLE_MAX_WIDTH}px). 글자 크기는 줄이지 않으니 문구를 줄여 주세요.`);
 return text.trim();
}

const box=(style,extra={})=>({type:'div',props:{style:{display:'flex',position:'absolute',...style},...extra}});
const img=(src,width,height,left,top)=>({type:'img',props:{src,width,height,style:{position:'absolute',left,top}}});
const title=(text,top,color)=>box({left:100,top,width:1000,height:LINE_PX,fontFamily:'Pretendard',fontWeight:800,fontSize:FONT_PX,lineHeight:`${LINE_PX}px`,letterSpacing:`${SPACING_PX}px`,whiteSpace:'nowrap',color},{children:text});

// 반환: 글자가 path 로 그려진 SVG 문자열(폰트가 없어도 어디서나 같게 보인다).
export async function renderCoverSvg({line1,line2}){
 const first=checkLine('제목 1줄',line1),second=checkLine('제목 2줄',line2);
 const {font,art,badge,logo}=load();
 const tree={type:'div',props:{style:{display:'flex',position:'relative',width:COVER_SIZE.width,height:COVER_SIZE.height,background:BG},children:[
  box({left:0,top:0,width:COVER_SIZE.width,height:Math.round(24*K),background:BAR}),
  img(badge,148,43,100,220),
  img(art,450,378,730,185.8),
  title(first,TITLE_TOP,BLUE),
  title(second,TITLE_TOP+LINE_PX,NAVY),
  img(logo,94,23,100,658)
 ]}};
 return satori(tree,{...COVER_SIZE,fonts:[{name:'Pretendard',data:font,weight:800,style:'normal'}]});
}

// 목록용 1:1 썸네일(720x720). 같은 디자인을 가운데 정렬로 옮긴 것이라 목록에서 정사각형으로 잘려도 제목·로고가 온전하다.
// 상세 화면에는 위의 16:9 커버를, 글 목록에는 이 1:1 을 쓴다(파일명 끝이 -square 인 이미지가 목록용).
export const SQUARE_SIZE={width:720,height:720};
const centerTitle=(text,top,color)=>box({left:0,top,width:SQUARE_SIZE.width,height:LINE_PX,justifyContent:'center',fontFamily:'Pretendard',fontWeight:800,fontSize:FONT_PX,lineHeight:`${LINE_PX}px`,letterSpacing:`${SPACING_PX}px`,whiteSpace:'nowrap',color},{children:text});

export async function renderSquareCoverSvg({line1,line2}){
 const first=checkLine('제목 1줄',line1),second=checkLine('제목 2줄',line2);
 const {font,art,badge,logo}=load();
 const {width,height}=SQUARE_SIZE;
 const tree={type:'div',props:{style:{display:'flex',position:'relative',width,height,background:BG},children:[
  box({left:0,top:0,width,height:Math.round(24*K),background:BAR}),
  img(badge,148,43,(width-148)/2,100),
  centerTitle(first,168,BLUE),
  centerTitle(second,168+LINE_PX,NAVY),
  img(art,279,234,(width-279)/2,366),
  img(logo,94,23,(width-94)/2,656)
 ]}};
 return satori(tree,{width,height,fonts:[{name:'Pretendard',data:font,weight:800,style:'normal'}]});
}
