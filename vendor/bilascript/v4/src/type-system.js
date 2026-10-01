
export const CERTAINTY = Object.freeze({ PROVEN:"PROVEN", DECLARED:"DECLARED", EXTERNAL:"EXTERNAL", UNKNOWN:"UNKNOWN", CONFLICT:"CONFLICT" });
const BUILTIN = Object.freeze({
  Magz:"array", Sob:"number", Chujg:"string", Lalf_lij:"boolean", Suh_vatf:"object", Haml_sob:"function", Wayl:"date",
  Array:"array", Number:"number", String:"string", Boolean:"boolean", Object:"object", Function:"function", Date:"date",
  any:"any", unknown:"unknown", void:"void", null:"null"
});
export function typeRefName(ref){ return ref?.name || null; }
export function typeFromAnnotation(annotation){
  if(!annotation?.types?.length) return null;
  const members=annotation.types.map(t=>({kind:BUILTIN[t.name]||`named:${t.name}`,args:(t.typeArguments||[]).map(x=>typeFromAnnotation({types:[x]}))}));
  return members.length===1?members[0]:{kind:"union",members};
}
export function typeKind(type){ return typeof type==="string"?type:type?.kind||null; }
export function receiverKinds(type){
  if(!type) return [];
  if(typeof type==="string") return [type];
  if(type.kind==="union") return [...new Set(type.members.flatMap(receiverKinds))];
  return [type.kind];
}
export function receiverProven(type, allowed){ const kinds=receiverKinds(type); return kinds.length>0 && kinds.every(k=>allowed.includes(k)); }
export function compatible(declared, actual){
  if(!declared||!actual) return true;
  const dk=receiverKinds(declared), ak=receiverKinds(actual);
  if(dk.includes("any")||dk.includes("unknown")) return true;
  return ak.every(k=>dk.includes(k));
}
export function describeType(type){
  if(!type) return "unknown";
  if(typeof type==="string") return type;
  if(type.kind==="union") return type.members.map(describeType).join(" | ");
  if(type.args?.length) return `${type.kind}<${type.args.map(describeType).join(", ")}>`;
  return type.kind;
}
