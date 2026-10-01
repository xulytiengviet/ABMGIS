export function generateDetailed(ast) {
  const out=[]; const marks=[]; let level=0,line=0,column=0;
  const ind=()=>"  ".repeat(level);
  const emit=s=>{ out.push(s); for(const ch of s){ if(ch==="\n"){line++;column=0;} else column++; } };
  const mark=n=>{ const p=n?.loc?.start; if(p?.line) marks.push({generated:{line,column},original:p}); };
  const id=n=>n.jsName||n.name;
  function stmt(n){ mark(n); switch(n.type){
    case "EmptyStatement": emit(ind()+";\n"); break;
    case "BlockStatement": emit("{\n"); level++; n.body.forEach(stmt); level--; emit(ind()+"}"); break;
    case "VariableDeclaration": emit(ind()+n.kind+" "+n.declarations.map(d=>pattern(d.id)+(d.init?" = "+expr(d.init):"")).join(", ")+";\n"); break;
    case "FunctionDeclaration": emit(ind()+(n.async?"async ":"")+`function ${expr(n.id)}(${n.params.map(pattern).join(", ")}) `); stmt(n.body); emit("\n"); break;
    case "IfStatement": emit(ind()+`if (${expr(n.test)}) `); stmt(n.consequent); if(n.alternate){ emit(" else "); stmt(n.alternate); } emit("\n"); break;
    case "WhileStatement": emit(ind()+`while (${expr(n.test)}) `); stmt(n.body); emit("\n"); break;
    case "DoWhileStatement": emit(ind()+"do "); stmt(n.body); emit(` while (${expr(n.test)});\n`); break;
    case "ForStatement": { const init=n.init?(n.init.type==="VariableDeclaration"?n.init.kind+" "+n.init.declarations.map(d=>pattern(d.id)+(d.init?" = "+expr(d.init):"")).join(", "):expr(n.init)):""; emit(ind()+`for (${init}; ${n.test?expr(n.test):""}; ${n.update?expr(n.update):""}) `); stmt(n.body); emit("\n"); break; }
    case "ReturnStatement": emit(ind()+"return"+(n.argument?" "+expr(n.argument):"")+";\n"); break;
    case "BreakStatement": emit(ind()+"break;\n"); break;
    case "ContinueStatement": emit(ind()+"continue;\n"); break;
    case "ThrowStatement": emit(ind()+"throw "+expr(n.argument)+";\n"); break;
    case "TryStatement": emit(ind()+"try "); stmt(n.block); if(n.handler){ emit(` catch (${expr(n.handler.param)}) `); stmt(n.handler.body); } if(n.finalizer){ emit(" finally "); stmt(n.finalizer); } emit("\n"); break;
      case "ClassDeclaration": { emit(ind()+`class ${expr(n.id)}${n.superClass?` extends ${expr(n.superClass)}`:""} {\n`); level++; for(const md of n.body.body){ emit(ind()+(md.static?"static ":"")+(md.async?"async ":"")+`${md.key.name}(${md.params.map(pattern).join(", ")}) `); stmt(md.body); emit("\n"); } level--; emit(ind()+"}\n"); break; }
      case "ImportDeclaration": { const specs=n.specifiers.map(s=>s.type==="ImportDefaultSpecifier"?s.local.name:(s.imported.name===s.local.name?s.imported.name:`${s.imported.name} as ${s.local.name}`)); const head=n.specifiers[0]?.type==="ImportDefaultSpecifier"?specs[0]:`{ ${specs.join(", ")} }`; emit(ind()+`import ${head} from ${JSON.stringify(n.source.value)};\n`); break; }
      case "ExportNamedDeclaration": { if(n.declaration){ emit(ind()+"export "); const before=out.length; stmt(n.declaration); if(out.length>before&&out[before].startsWith(ind()))out[before]=out[before].slice(ind().length); } else emit(ind()+`export { ${n.specifiers.map(s=>s.local.name===s.exported.name?s.local.name:`${s.local.name} as ${s.exported.name}`).join(", ")} };\n`); break; }
      case "ExpressionStatement": emit(ind()+expr(n.expression)+";\n"); break;
    default: throw new Error(`Codegen chưa hỗ trợ statement ${n.type}`);
  }}
  function expr(n){ switch(n.type){
    case "Identifier": return id(n);
    case "ThisExpression": return "this";
    case "Literal": if(n.numericKind) return n.raw; if(typeof n.value==="boolean") return String(n.value); if(n.value===null) return "null"; return n.raw ?? (typeof n.value==="string"?JSON.stringify(n.value):String(n.value));
    case "RegexLiteral": case "TemplateLiteralRaw": return n.raw;
    case "ArrayExpression": return "["+n.elements.map(expr).join(", ")+"]";
    case "ObjectExpression": return "{"+n.properties.map(p=>p.type==="SpreadElement"?"..."+expr(p.argument):p.shorthand?expr(p.key):`${p.key.type==="Identifier"?p.key.name:p.key.raw}: ${expr(p.value)}`).join(", ")+"}";
    case "SpreadElement": return "..."+expr(n.argument);
    case "UnaryExpression": return (/[A-Za-z]/.test(n.operator)?n.operator+" ":n.operator)+expr(n.argument);
    case "UpdateExpression": return n.prefix?n.operator+expr(n.argument):expr(n.argument)+n.operator;
    case "BinaryExpression": case "LogicalExpression": return `(${expr(n.left)} ${n.operator} ${expr(n.right)})`;
    case "AssignmentExpression": return `${expr(n.left)} ${n.operator} ${expr(n.right)}`;
    case "ConditionalExpression": return `(${expr(n.test)} ? ${expr(n.consequent)} : ${expr(n.alternate)})`;
    case "CallExpression": return `${expr(n.callee)}${n.optional?"?.":""}(${n.arguments.map(expr).join(", ")})`;
    case "NewExpression": return `new ${expr(n.callee)}(${n.arguments.map(expr).join(", ")})`;
    case "AwaitExpression": return `await ${expr(n.argument)}`;
    case "MemberExpression": { const obj=expr(n.object); if(n.computed) return `${obj}${n.optional?"?.":""}[${expr(n.property)}]`; return `${obj}${n.optional?"?.":"."}${n.jsProperty||n.property.name}`; }
    case "FunctionExpression": return `function${n.id?" "+expr(n.id):""}(${n.params.map(pattern).join(", ")}) ${blockExpr(n.body)}`;
    case "ArrowFunctionExpression": return `(${n.params.map(pattern).join(", ")}) => ${n.expression?expr(n.body):blockExpr(n.body)}`;
    default: throw new Error(`Codegen chưa hỗ trợ expression ${n.type}`);
  }}
  function pattern(n){
    if(!n)return ""; if(n.type==="Identifier")return n.name; if(n.type==="RestElement")return "..."+pattern(n.argument);
    if(n.type==="ArrayPattern")return "["+n.elements.map(x=>x?pattern(x):"").join(", ")+"]";
    if(n.type==="ObjectPattern")return "{"+n.properties.map(p=>p.type==="RestElement"?pattern(p):(p.shorthand?pattern(p.key):`${pattern(p.key)}: ${pattern(p.value)}`)).join(", ")+"}";
    return expr(n);
  }
  function blockExpr(b){ const save=level; const local=[]; const oldOut=out.splice(0,out.length); const oldMarks=marks.splice(0,marks.length); const oldLine=line,oldColumn=column; level=0; line=0; column=0; stmt(b); const text=out.join(""); out.splice(0,out.length,...oldOut); marks.splice(0,marks.length,...oldMarks); level=save; line=oldLine; column=oldColumn; return text.trimEnd(); }
  ast.body.forEach(stmt); const code=out.join("").trimEnd()+"\n"; return {code,marks};
}
export function generate(ast){ return generateDetailed(ast).code; }
