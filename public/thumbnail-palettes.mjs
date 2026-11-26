export const THUMBNAIL_TEXT_COLOR='#1B2559';
export const DEFAULT_PALETTES=[
 {id:'trust-blue',name:'신뢰 블루',main:'#2D55D9'},
 {id:'insight-purple',name:'인사이트 퍼플',main:'#6848DB'},
 {id:'checkbook-coral',name:'체크북 코랄',main:'#E95342'},
 {id:'calm-green',name:'차분 그린',main:'#198C75'},
 {id:'gold-amber',name:'골드 앰버',main:'#D18C08'}
];
export const DEFAULT_TYPE_PALETTES={guide:'trust-blue',insight:'insight-purple',workbook:'checkbook-coral'};
export const THUMBNAIL_TYPES=[{id:'guide',label:'등기 가이드'},{id:'insight',label:'인사이트'},{id:'workbook',label:'실무 체크북'}];
const HEX=/^#[0-9A-Fa-f]{6}$/;
export function isHexColor(value){return typeof value==='string'&&HEX.test(value);}
export function paletteColors(main){
 if(!isHexColor(main))throw new Error('메인 색상을 확인해 주세요.');
 const channel=offset=>parseInt(main.slice(offset,offset+2),16);
 const mix=(amount)=>'#'+[1,3,5].map(offset=>Math.round(channel(offset)*(1-amount)+255*amount).toString(16).padStart(2,'0')).join('').toUpperCase();
 return {main:main.toUpperCase(),sub:mix(.62),background:mix(.91),text:THUMBNAIL_TEXT_COLOR};
}
export function normalizePalettes(value){
 const saved=Array.isArray(value?.sets)?value.sets:[];
 const defaults=DEFAULT_PALETTES.map(p=>({...p}));
 const custom=saved.filter(p=>p&&typeof p.id==='string'&&/^custom-[a-z0-9-]{1,32}$/.test(p.id)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.trim().length<=20&&isHexColor(p.main)).slice(0,12).map(p=>({id:p.id,name:p.name.trim(),main:p.main.toUpperCase()}));
 const overwritten=defaults.map(p=>{const edit=saved.find(s=>s?.id===p.id);return edit&&isHexColor(edit.main)?{...p,main:edit.main.toUpperCase()}:p;});
 const sets=[...overwritten,...custom.filter(p=>!overwritten.some(d=>d.id===p.id))];
 const selection={...DEFAULT_TYPE_PALETTES};
 for(const type of Object.keys(selection)){const id=value?.types?.[type];if(sets.some(p=>p.id===id))selection[type]=id;}
 return {sets,types:selection};
}
export function selectedPalette(value,type='guide'){
 const normalized=normalizePalettes(value);
 const id=normalized.types[type]||normalized.types.guide;
 const set=normalized.sets.find(s=>s.id===id)||normalized.sets[0];
 return {...set,...paletteColors(set.main)};
}
