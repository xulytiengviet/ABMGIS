/** BilaScript v3.5 canonical vocabulary. MIT License. Copyright (c) 2026 Long Ngo. */
export const VERSION = "4.0.0";

export const KEYWORD_SPECS = Object.freeze({
  haml_sob: { id: "KW_FUNCTION", js: "function" },
  bilb: { id: "KW_VAR", js: "var" },
  neub: { id: "KW_IF", js: "if" },
  kac: { id: "KW_ELSE", js: "else" },
  vil: { id: "KW_FOR", js: "for" },
  trogp_ki: { id: "KW_WHILE", js: "while" },
  trov_ved: { id: "KW_RETURN", js: "return" },
  moix: { id: "KW_NEW", js: "new" },
  voy_jaj_trir: { id: "KW_NULL", js: "null" },
  thatf: { id: "KW_TRUE", js: "true" },
  sai: { id: "KW_FALSE", js: "false" },
  thuv: { id: "KW_TRY", js: "try" },
  chupr_layb: { id: "KW_CATCH", js: "catch" },
  nemj: { id: "KW_THROW", js: "throw" },
  cujb_cugl: { id: "KW_FINALLY", js: "finally" },
  laml: { id: "KW_DO", js: "do" },
  zugk: { id: "KW_BREAK", js: "break" },
  tifb_tucr: { id: "KW_CONTINUE", js: "continue" },
  lopx: { id: "KW_CLASS", js: "class" },
  nhapf: { id: "KW_IMPORT", js: "import" },
  xadb: { id: "KW_EXPORT", js: "export" },
  tuk: { id: "KW_FROM", js: "from" }
});

export const JS_PASSTHROUGH = Object.freeze({
  typeof: { id: "KW_TYPEOF", js: "typeof" },
  void: { id: "KW_VOID", js: "void" },
  delete: { id: "KW_DELETE", js: "delete" },
  in: { id: "KW_IN", js: "in" },
  instanceof: { id: "KW_INSTANCEOF", js: "instanceof" },
  this: { id: "KW_THIS", js: "this" },
  async: { id: "KW_ASYNC", js: "async" },
  await: { id: "KW_AWAIT", js: "await" },
  extends: { id: "KW_EXTENDS", js: "extends" },
  static: { id: "KW_STATIC", js: "static" },
  as: { id: "KW_AS", js: "as" }
});

export const JS_TO_KEYWORD = Object.freeze(Object.fromEntries(
  Object.entries(KEYWORD_SPECS).map(([canonical, spec]) => [spec.js, { ...spec, canonical }])
));

export const KEYWORD_JS = Object.freeze(Object.fromEntries([
  ...Object.values(KEYWORD_SPECS).map(spec => [spec.id, spec.js]),
  ...Object.values(JS_PASSTHROUGH).map(spec => [spec.id, spec.js])
]));

export const MAPPED_ENGLISH = new Set(Object.values(KEYWORD_SPECS).map(x => x.js));

export function resolveKeyword(word, mode = "bila") {
  if (Object.prototype.hasOwnProperty.call(KEYWORD_SPECS, word)) {
    const spec = KEYWORD_SPECS[word];
    return { ...spec, canonical: word, surface: "bila" };
  }
  if (Object.prototype.hasOwnProperty.call(JS_PASSTHROUGH, word)) {
    return { ...JS_PASSTHROUGH[word], canonical: null, surface: "javascript-required" };
  }
  if (mode !== "strict" && Object.prototype.hasOwnProperty.call(JS_TO_KEYWORD, word)) {
    return { ...JS_TO_KEYWORD[word], surface: "javascript-compat" };
  }
  return null;
}

export const GLOBAL_SPECS = Object.freeze({
  Magz: { js: "Array", type: "array" },
  Suh_vatf: { js: "Object", type: "object" },
  Haml_sob: { js: "Function", type: "function" },
  Wayl: { js: "Date", type: "date" },
  mony_Tolj: { js: "Math", type: "math" },
  Chujg: { js: "String", type: "string-constructor" },
  Sob: { js: "Number", type: "number-constructor" },
  Lalf_lij: { js: "Boolean", type: "boolean-constructor" }
});

export const MEMBER_SPECS = Object.freeze({
  dof_zail: { js: "length", receivers: ["array", "string"] },
  dayq: { js: "push", receivers: ["array"] },
  layb_cujb: { js: "pop", receivers: ["array"] },
  sapx_xepb: { js: "sort", receivers: ["array"] },
  daoz_wush: { js: "reverse", receivers: ["array"] },
  ahj_xar: { js: "map", receivers: ["array"] },
  locr: { js: "filter", receivers: ["array"] },
  cho_moig: { js: "forEach", receivers: ["array"] },
  motf_vail: { js: "some", receivers: ["array"] },
  takj: { js: "split", receivers: ["string"] },
  chujg_con: { js: "substring", receivers: ["string"] },
  kopx: { js: "match", receivers: ["string"] },
  timl_civb: { js: "search", receivers: ["string"] },
  thay_theb: { js: "replace", receivers: ["string"] },
  denb_chujg: { js: "toString", receivers: ["array", "string", "number", "object", "date", "boolean"] },
  goir: { js: "call", receivers: ["function"] },
  ap_zugr: { js: "apply", receivers: ["function"] },
  waug_nhily: { js: "random", receivers: ["math"] },
  laml_tronl: { js: "round", receivers: ["math"] },
  cano_bacf_hai: { js: "sqrt", receivers: ["math"] },
  jaj_trir_tydf_doib: { js: "abs", receivers: ["math"] },
  trand: { js: "ceil", receivers: ["math"] },
  sanl: { js: "floor", receivers: ["math"] },
  lys_thuak: { js: "pow", receivers: ["math"] }
});
