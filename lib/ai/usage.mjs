import {read,write} from '../storage.mjs';
import {fail} from '../core.mjs';

export function kstDate(now=Date.now()){return new Date(now+9*3600*1000).toISOString().slice(0,10);}

export function dailyLimit(env){
 const n=parseInt(env.AI_DAILY_LIMIT||'10',10);
 return Number.isFinite(n)?Math.min(Math.max(n,1),200):10;
}

const keyFor=now=>'studio/ai-usage/'+kstDate(now)+'.json';

export async function usedToday(now=Date.now()){
 const found=await read(keyFor(now));
 return found?.value.count||0;
}

export async function reserve(env,now=Date.now()){
 const key=keyFor(now),limit=dailyLimit(env);
 for(let i=0;i<3;i++){
  const found=await read(key);
  const count=found?.value.count||0;
  if(count>=limit)fail(429,`오늘 AI 생성 한도(${limit}건)를 모두 사용했습니다.`);
  try{await write(key,{count:count+1},found?.etag);return count+1;}
  catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}
 }
 fail(409,'요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.');
}
