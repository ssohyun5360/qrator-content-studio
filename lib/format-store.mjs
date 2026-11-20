import {read,write} from './storage.mjs';
import {DEFAULTS,PRESETS,validateFormat} from './format.mjs';
import {fail} from './core.mjs';

const KEY='studio/settings/home-format.json';
const HISTORY_MAX=20;

export async function loadFormat(){
 const found=await read(KEY);
 if(!found)return {version:0,values:{...DEFAULTS},updatedAt:null,history:[],etag:null};
 let values;
 try{values=validateFormat(found.value.values);}catch{values={...DEFAULTS};}
 return {version:Number(found.value.version)||0,values,updatedAt:found.value.updatedAt||null,history:Array.isArray(found.value.history)?found.value.history:[],etag:found.etag};
}

export async function saveFormat({values,preset,expectedVersion},now=new Date().toISOString()){
 const current=await loadFormat();
 if(Number(expectedVersion)!==current.version)fail(409,'다른 사람이 먼저 저장했습니다. 화면을 새로고침한 뒤 다시 바꿔 주세요.');
 let clean;
 if(preset!==undefined){
  if(!Object.hasOwn(PRESETS,preset))fail(400,'알 수 없는 서식 묶음입니다.');
  clean={...PRESETS[preset].values};
 }else clean=validateFormat(values,current.values);
 const changed=Object.keys(clean).filter(k=>clean[k]!==current.values[k]);
 if(!changed.length)return {...current,unchanged:true};
 const next={
  version:current.version+1,values:clean,updatedAt:now,
  history:[...current.history,{version:current.version+1,updatedAt:now,changed,...(preset!==undefined?{preset}:{})}].slice(-HISTORY_MAX)
 };
 await write(KEY,next,current.etag||undefined);
 return {...next,etag:null,unchanged:false};
}
