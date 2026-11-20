import {fail} from './core.mjs';

// 홈페이지 글 서식 설정: 정렬·글꼴 크기·간격. 값은 항목별 허용 범위 안으로만 저장된다.
export const ALIGN_OPTIONS=['left','center'];

export const LIMITS={
 titleSize:{min:24,max:44,step:1},
 headingSize:{min:18,max:40,step:1},
 bodySize:{min:14,max:20,step:1},
 lineHeight:{min:1.4,max:2.2,step:0.05},
 paragraphGap:{min:6,max:28,step:1},
 sectionGap:{min:28,max:100,step:2}
};

export const LABELS={
 titleAlign:'제목 정렬',headingAlign:'소제목 정렬',bodyAlign:'본문 정렬',boxAlign:'요약·목차 박스 정렬',
 titleSize:'제목 글자 크기',headingSize:'소제목 글자 크기',bodySize:'본문 글자 크기',
 lineHeight:'본문 줄 간격',paragraphGap:'문단 간격',sectionGap:'소제목 구간 간격'
};

// 기본값 = 지금 스튜디오 검토 화면에서 확인·승인한 모양(제목·본문 가운데, 소제목 왼쪽).
export const DEFAULTS={
 titleAlign:'center',headingAlign:'left',bodyAlign:'center',boxAlign:'left',
 titleSize:30,headingSize:22,bodySize:16,lineHeight:1.8,paragraphGap:14,sectionGap:40
};

export const PRESETS={
 studio:{label:'스튜디오 기본',values:DEFAULTS},
 original:{label:'원본 홈페이지',values:{
  titleAlign:'left',headingAlign:'left',bodyAlign:'left',boxAlign:'left',
  titleSize:32,headingSize:32,bodySize:17,lineHeight:1.6,paragraphGap:14,sectionGap:60
 }}
};

const ALIGN_KEYS=['titleAlign','headingAlign','bodyAlign','boxAlign'];

export function validateFormat(input,base=DEFAULTS){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'서식 값이 올바르지 않습니다.');
 const out={...base};
 for(const [key,value] of Object.entries(input)){
  if(!(key in DEFAULTS))fail(400,`알 수 없는 서식 항목입니다: ${String(key).slice(0,40)}`);
  if(ALIGN_KEYS.includes(key)){
   if(!ALIGN_OPTIONS.includes(value))fail(400,`${LABELS[key]}은(는) 왼쪽 또는 가운데만 선택할 수 있습니다.`);
   out[key]=value;continue;
  }
  const n=typeof value==='number'?value:(typeof value==='string'&&value.trim()!==''?Number(value):NaN);
  const {min,max}=LIMITS[key];
  if(!Number.isFinite(n)||n<min||n>max)fail(400,`${LABELS[key]}은(는) ${min}~${max} 사이로 입력해 주세요.`);
  out[key]=key==='lineHeight'?Math.round(n*100)/100:Math.round(n);
 }
 return out;
}

// 홈페이지 글 HTML(<style>) 끝에 덧붙이는 서식 규칙. 원본 CSS는 그대로 두고 아래 값만 덮어쓴다.
// 목록·표·FAQ·안내 박스 안의 글은 읽기 편하도록 항상 왼쪽 정렬이다.
export function formatCss(values){
 const f=validateFormat(values);
 const R='#qrator-blog';
 const headings=`${R} .article-section h2,${R} .qbv-faq h2,${R} .qbv-bridge h2`;
 const body=`${R} .qbe-intro p,${R} .article-section>p,${R} .qbv-bridge>p`;
 return [
  '/* 홈페이지 글 서식(스튜디오 설정) */',
  `${R} h1,${R} .subhead{text-align:${f.titleAlign}}`,
  `${headings}{text-align:${f.headingAlign}}`,
  `${body}{text-align:${f.bodyAlign}}`,
  `${R} .qbv-toc,${R} .qbv-summary{text-align:${f.boxAlign}}`,
  `${R} .article-section{margin-top:${f.sectionGap}px}`,
  `${R} .qbe-intro p+p,${R} .article-section p+p,${R} .qbv-bridge p+p{margin-top:${f.paragraphGap}px}`,
  `@media(min-width:601px){${R} h1{font-size:${f.titleSize}px}${headings}{font-size:${f.headingSize}px}${R} .qbe-intro p,${R} .article-section>p,${R} .article-section li,${R} .qbv-bridge>p{font-size:${f.bodySize}px;line-height:${f.lineHeight}}}`,
  ''
 ].join('\n');
}
