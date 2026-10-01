
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { normalize } from "./normalize.js";
import { generateDetailed } from "./codegen-js.js";
import { buildSourceMap } from "./source-map.js";
import { auditZeroCost } from "./performance.js";
import { VERSION } from "./vocabulary.js";
export function compile(source,options={}){
  const parsed=parse(source); const semanticDiagnostics=analyze(parsed.ast); const normalized=normalize(parsed.ast,{mode:parsed.mode});
  const diagnostics=[...semanticDiagnostics,...normalized.diagnostics]; const errors=diagnostics.filter(x=>x.severity==="error");
  if(options.failOnSemanticError!==false&&errors.length){ const e=new Error(errors.map(x=>`${x.code}: ${x.message}`).join("\n")); e.name="BilaCompileTimeError"; e.diagnostics=diagnostics; throw e; }
  const generated=generateDetailed(normalized.ast); const performance=auditZeroCost(generated.code);
  const map=options.sourceMap?buildSourceMap(generated.marks,{file:options.fileName||"output.js",source:options.sourceName||"input.bila",sourceContent:String(source)}):null;
  return {version:VERSION,backend:"javascript",mode:parsed.mode,ast:parsed.ast,normalizedAst:normalized.ast,diagnostics,normalization:normalized.metadata,code:generated.code,map,performance};
}
export { parse } from "./parser.js"; export { lex } from "./lexer.js"; export { analyze } from "./semantic.js"; export { normalize } from "./normalize.js"; export { generate,generateDetailed } from "./codegen-js.js"; export { buildSourceMap } from "./source-map.js"; export { auditZeroCost,PERFORMANCE_CONTRACT } from "./performance.js"; export * from "./type-system.js";
