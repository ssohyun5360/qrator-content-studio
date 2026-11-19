import {fail} from '../core.mjs';
import {STEP_NAMES} from './pipeline.mjs';

// 1단계: 실제 AI 호출 없이 흐름만 검증하는 가짜 단계. 어떤 글도 저장하지 않는다.
export function mockRunners(){
 return Object.fromEntries(STEP_NAMES.map(name=>[name,async()=>({mock:true,step:name})]));
}

// 실제 단계(주제·중복검사·원고·검사·템플릿·썸네일·저장)는 2~5단계에서 이 함수에 연결한다.
export function getRunners(env){
 if(env.AI_MOCK==='1')return mockRunners();
 fail(503,'실제 AI 생성 단계는 아직 준비 중입니다.');
}
