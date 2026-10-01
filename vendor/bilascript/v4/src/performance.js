export const PERFORMANCE_CONTRACT = Object.freeze({
  principle: "CVNSS4.0 ở frontend; JavaScript ở backend; không dịch từ vựng khi runtime.",
  runtimeTranslation: false,
  injectedRuntimeHelpers: false,
  operatorRewrite: false,
  numericRewrite: false,
  wrapperObjects: false
});
export function auditZeroCost(code){
  const injected=[];
  for(const name of ["BilaRuntime","BilaArray","__bilaRuntime","__bilaGet","__bilaCall"]) if(code.includes(name)) injected.push(name);
  return {zeroCost:injected.length===0,runtimeHelpers:injected,contract:PERFORMANCE_CONTRACT};
}
