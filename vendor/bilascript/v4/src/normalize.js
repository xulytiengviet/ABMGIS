
import { GLOBAL_SPECS, MEMBER_SPECS } from "./vocabulary.js";
import { CERTAINTY, compatible, describeType, receiverProven, typeFromAnnotation, typeKind } from "./type-system.js";

class Scope {
  constructor(parent=null){ this.parent=parent; this.bindings=new Map(); }
  define(name,info={}){ const value={name,kind:"variable",type:null,certainty:CERTAINTY.UNKNOWN,mutations:0,...info}; this.bindings.set(name,value); return value; }
  get(name){ return this.bindings.get(name)||this.parent?.get(name)||null; }
}
const clone=x=>JSON.parse(JSON.stringify(x));
function literalType(n){
  if(n?.type==="ArrayExpression") return {kind:"array",args:[]};
  if(n?.type==="ObjectExpression") return {kind:"object"};
  if(n?.type==="Literal"){
    if(typeof n.value==="string") return {kind:"string"};
    if(typeof n.value==="boolean") return {kind:"boolean"};
    if(n.value===null && n.raw && /^[0-9.]/.test(n.raw.replace(/^[-+]/,""))) return {kind:"number"};
    if(n.value===null) return {kind:"null"};
  }
  if(n?.type==="RegexLiteral") return {kind:"regexp"};
  if(["FunctionExpression","ArrowFunctionExpression"].includes(n?.type)) return {kind:"function"};
  return null;
}
export function normalize(inputAst,{mode="bila"}={}){
  const ast=clone(inputAst); const diagnostics=[];
  const metadata={resolvedGlobals:0,resolvedMembers:0,unresolvedMemberAliases:0,declaredTypes:0,typeConflicts:0,symbols:0};
  const report=(severity,node,code,message)=>{ const p=node?.loc?.start; diagnostics.push({severity,code,message,line:p?.line||null,column:p?.column||null}); };
  const aliasFailure=(node,spec,name)=>{ metadata.unresolvedMemberAliases++; report(mode==="strict"?"error":"warning",node,mode==="strict"?"BILA-T310":"BILA-S310",`Không thể chứng minh receiver của '${name}' thuộc [${spec.receivers.join(", ")}]. ${mode==="strict"?"Strict mode dừng biên dịch":"Giữ nguyên property để bảo vệ user/npm API"}.`); };

  function bindingNames(p,out=[]){ if(!p)return out; if(p.type==="Identifier")out.push(p.name); else if(p.type==="RestElement")bindingNames(p.argument,out); else if(p.type==="ArrayPattern")p.elements.forEach(x=>bindingNames(x,out)); else if(p.type==="ObjectPattern")p.properties.forEach(x=>bindingNames(x.type==="RestElement"?x.argument:x.value,out)); return out; }
  function predeclare(body,scope){
    for(const n of body||[]){
      if(n?.type==="VariableDeclaration") for(const d of n.declarations) for(const name of bindingNames(d.id)) { scope.define(name,{declaration:d}); metadata.symbols++; }
      if(n?.type==="FunctionDeclaration"&&n.id) { scope.define(n.id.name,{kind:"function",type:{kind:"function"},certainty:CERTAINTY.PROVEN,declaration:n}); metadata.symbols++; }
    }
  }
  function infer(n,scope){
    const lit=literalType(n); if(lit) return {type:lit,certainty:CERTAINTY.PROVEN};
    if(!n) return {type:null,certainty:CERTAINTY.UNKNOWN};
    if(n.type==="Identifier"){
      const b=scope.get(n.name); if(b?.type) return {type:b.type,certainty:b.certainty};
      const g=GLOBAL_SPECS[n.name]; if(g?.type) return {type:{kind:g.type},certainty:CERTAINTY.PROVEN};
    }
    if(n.type==="NewExpression"&&n.callee?.type==="Identifier"){
      const g=GLOBAL_SPECS[n.callee.name]; if(g?.type) return {type:{kind:g.type},certainty:CERTAINTY.PROVEN};
      const b=scope.get(n.callee.name); if(b?.type) return {type:b.type,certainty:b.certainty};
    }
    return {type:n.inferredType||null,certainty:n.typeCertainty||CERTAINTY.UNKNOWN};
  }
  function visit(node,scope,context={}){
    if(!node||typeof node!=="object") return;
    switch(node.type){
      case "Program": predeclare(node.body,scope); node.body.forEach(n=>visit(n,scope)); return;
      case "BlockStatement": { const child=new Scope(scope); predeclare(node.body,child); node.body.forEach(n=>visit(n,child)); return; }
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": case "MethodDefinition": {
        const fnScope=new Scope(scope); if(node.id) fnScope.define(node.id.name,{kind:"function",type:{kind:"function"},certainty:CERTAINTY.PROVEN});
        for(const p of node.params||[]){ const declared=typeFromAnnotation(p.typeAnnotation); for(const name of bindingNames(p)) fnScope.define(name,{kind:"parameter",type:declared,certainty:declared?CERTAINTY.DECLARED:CERTAINTY.UNKNOWN}); if(declared) metadata.declaredTypes++; }
        visit(node.body,fnScope); return;
      }
      case "VariableDeclaration":
        for(const d of node.declarations){
          if(d.init) visit(d.init,scope); if(d.id?.type!=="Identifier") { if(d.init) visit(d.init,scope); continue; }
          const binding=scope.get(d.id.name)||scope.define(d.id.name,{declaration:d});
          const declared=typeFromAnnotation(d.typeAnnotation); const actual=infer(d.init,scope);
          if(declared){ metadata.declaredTypes++; binding.type=declared; binding.certainty=CERTAINTY.DECLARED; d.declaredType=declared; if(actual.type&&!compatible(declared,actual.type)){ metadata.typeConflicts++; report("error",d,"BILA-T201",`Kiểu khai báo ${describeType(declared)} không tương thích giá trị ${describeType(actual.type)}.`); } }
          else { binding.type=actual.type; binding.certainty=actual.certainty; }
          d.inferredType=binding.type; d.typeCertainty=binding.certainty;
        } return;
      case "AssignmentExpression": {
        visit(node.right,scope); visit(node.left,scope);
        if(node.left?.type==="Identifier"){ const b=scope.get(node.left.name); if(b){ const actual=infer(node.right,scope); b.mutations++; if(b.certainty===CERTAINTY.DECLARED && actual.type && !compatible(b.type,actual.type)) report("error",node,"BILA-T202",`Gán ${describeType(actual.type)} vào '${b.name}' đã khai báo ${describeType(b.type)}.`); else if(b.certainty!==CERTAINTY.DECLARED){ b.type=actual.type; b.certainty=actual.certainty; } } }
        return;
      }
      case "Identifier": {
        if(context.propertyKey||context.declaration) return;
        const local=scope.get(node.name);
        if(!local&&GLOBAL_SPECS[node.name]){ const spec=GLOBAL_SPECS[node.name]; node.jsName=spec.js; node.inferredType={kind:spec.type}; node.typeCertainty=CERTAINTY.PROVEN; metadata.resolvedGlobals++; }
        else if(local?.type){ node.inferredType=local.type; node.typeCertainty=local.certainty; }
        return;
      }
      case "MemberExpression": {
        visit(node.object,scope); if(node.computed) visit(node.property,scope); else visit(node.property,scope,{propertyKey:true});
        const r=infer(node.object,scope); node.receiverType=r.type; node.receiverCertainty=r.certainty;
        if(!node.computed&&node.property?.type==="Identifier"&&MEMBER_SPECS[node.property.name]){
          const spec=MEMBER_SPECS[node.property.name];
          if(receiverProven(r.type,spec.receivers)&&r.certainty!==CERTAINTY.UNKNOWN&&r.certainty!==CERTAINTY.CONFLICT){ node.jsProperty=spec.js; node.bilaProperty=node.property.name; metadata.resolvedMembers++; }
          else aliasFailure(node,spec,node.property.name);
        } return;
      }
      case "NewExpression": case "CallExpression": visit(node.callee,scope); (node.arguments||[]).forEach(a=>visit(a,scope)); { const r=infer(node,scope); node.inferredType=r.type; node.typeCertainty=r.certainty; } return;
      case "Property": visit(node.key,scope,{propertyKey:true}); visit(node.value,scope); return;
      case "CatchClause": { const child=new Scope(scope); if(node.param?.name) child.define(node.param.name,{kind:"catch"}); visit(node.body,child); return; }
    }
    for(const [k,v] of Object.entries(node)) if(!["type","loc","jsName","jsProperty","receiverType","receiverCertainty","inferredType","typeCertainty","declaredType","typeAnnotation","returnType","bilaGlobal","bilaProperty"].includes(k)){
      if(Array.isArray(v)) v.forEach(x=>visit(x,scope)); else if(v&&typeof v==="object") visit(v,scope);
    }
  }
  visit(ast,new Scope());
  return {ast,diagnostics,metadata};
}
