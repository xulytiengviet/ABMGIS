import { compile } from "../vendor/bilascript/v4/src/compiler.js";

export function compileBilaModel(source) {
  const result = compile(String(source), {
    sourceMap: false,
    failOnSemanticError: true,
    sourceName: "model.bila",
    fileName: "model.js"
  });
  return {
    code: result.code,
    diagnostics: result.diagnostics || [],
    version: result.version,
    performance: result.performance
  };
}
