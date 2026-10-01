import { lex, BilaSyntaxError } from "./lexer.js";

const PRECEDENCE = { "??":1, "||":2, "&&":3, "|":4, "^":5, "&":6, "==":7, "!=":7, "===":7, "!==":7, "<":8, ">":8, "<=":8, ">=":8, "in":8, "instanceof":8, "<<":9, ">>":9, ">>>":9, "+":10, "-":10, "*":11, "/":11, "%":11, "**":12 };
const ASSIGN = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "**=", "??="]);
const UNARY_KW = { KW_TYPEOF: "typeof", KW_VOID: "void", KW_DELETE: "delete" };
const BINARY_KW = { KW_IN: "in", KW_INSTANCEOF: "instanceof" };
const locFrom = (start, end = start) => ({ start: start?.start || start || null, end: end?.end || end?.start || end || null });

export class Parser {
  constructor(source) {
    const out = lex(source);
    this.mode = out.mode;
    this.directive = out.directive;
    this.tokens = out.tokens;
    this.source = out.source;
    this.i = 0;
  }
  cur() { return this.tokens[this.i]; }
  next() { return this.tokens[this.i++]; }
  at(value) { return this.cur().value === value; }
  atKw(id) { return this.cur().type === "keyword" && this.cur().value === id; }
  eat(value) { if (this.at(value)) return this.next(); return null; }
  eatKw(id) { if (this.atKw(id)) return this.next(); return null; }
  expect(value, message = `Mong đợi '${value}'`) { if (!this.at(value)) throw new BilaSyntaxError(message, this.cur()); return this.next(); }
  expectKw(id, message = `Mong đợi ${id}`) { if (!this.atKw(id)) throw new BilaSyntaxError(message, this.cur()); return this.next(); }
  expectIdentifier() { const t=this.cur(); if(t.type!=="identifier") throw new BilaSyntaxError("Mong đợi định danh",t); this.next(); return {type:"Identifier",name:t.value,loc:locFrom(t)}; }
  expectTypeClose() {
    const t=this.cur();
    if(t?.type==="punctuator" && typeof t.value==="string" && t.value.startsWith(">")){
      const rest=t.value.slice(1);
      const firstEnd={offset:t.start.offset+1,line:t.start.line,column:t.start.column+1};
      if(rest){ this.tokens[this.i]={...t,value:rest,raw:rest,start:firstEnd}; } else this.i++;
      return {...t,value:">",raw:">",end:firstEnd};
    }
    return this.expect(">");
  }
  parseTypeRef() {
    const id=this.expectIdentifier(); const typeArguments=[];
    if(this.eat("<")){ if(!this.at(">")){ do typeArguments.push(this.parseTypeRef()); while(this.eat(",")); } this.expectTypeClose(); }
    return {type:"BilaTypeReference",name:id.name,typeArguments,loc:id.loc};
  }
  parseTypeAnnotation() {
    const colon=this.eat(":"); if(!colon) return null;
    const types=[this.parseTypeRef()]; while(this.eat("|")) types.push(this.parseTypeRef());
    return {type:"BilaTypeAnnotation",types,loc:{start:colon.start,end:types.at(-1).loc?.end}};
  }
  parseBindingPattern() {
    if(this.cur().type==="identifier") return this.expectIdentifier();
    if(this.eat("[")){ const elements=[]; while(!this.at("]")){ if(this.eat(",")){elements.push(null);continue;} if(this.eat("...")){const argument=this.parseBindingPattern();elements.push({type:"RestElement",argument,loc:argument.loc});break;} const p=this.parseBindingPattern(); elements.push(p); if(!this.eat(","))break; } const end=this.expect("]"); return {type:"ArrayPattern",elements,loc:{start:elements.find(Boolean)?.loc?.start||end.start,end:end.end}}; }
    if(this.eat("{")){ const properties=[]; while(!this.at("}")){ if(this.eat("...")){const argument=this.parseBindingPattern();properties.push({type:"RestElement",argument,loc:argument.loc});break;} const key=this.expectIdentifier(); let value=key; if(this.eat(":")) value=this.parseBindingPattern(); properties.push({type:"Property",key,value,kind:"init",computed:false,shorthand:value===key,loc:{start:key.loc.start,end:value.loc.end}}); if(!this.eat(","))break; } const end=this.expect("}"); return {type:"ObjectPattern",properties,loc:{start:properties[0]?.loc?.start||end.start,end:end.end}}; }
    throw new BilaSyntaxError("Mong đợi binding pattern",this.cur());
  }

  parseProgram() {
    const start=this.cur(); const body=[]; while(this.cur().type!=="eof") body.push(this.parseStatement());
    const sourceType=body.some(n=>["ImportDeclaration","ExportNamedDeclaration"].includes(n.type))?"module":"script";
    return {type:"Program",sourceType,bilaMode:this.mode,directive:this.directive,body,loc:locFrom(start,this.cur())};
  }
  parseStatement() {
    const t=this.cur();
    if(this.eat(";")) return {type:"EmptyStatement",loc:locFrom(t)};
    if(this.at("{")) return this.parseBlock();
    if(t.type==="keyword") {
      switch(t.value) {
        case "KW_VAR": return this.parseVariableStatement(true);
        case "KW_FUNCTION": return this.parseFunctionDeclaration();
        case "KW_IF": return this.parseIf();
        case "KW_WHILE": return this.parseWhile();
        case "KW_DO": return this.parseDoWhile();
        case "KW_FOR": return this.parseFor();
        case "KW_RETURN": return this.parseReturn();
        case "KW_BREAK": { const s=this.next(); this.eat(";"); return {type:"BreakStatement",loc:locFrom(s)}; }
        case "KW_CONTINUE": { const s=this.next(); this.eat(";"); return {type:"ContinueStatement",loc:locFrom(s)}; }
        case "KW_THROW": return this.parseThrow();
        case "KW_TRY": return this.parseTry();
        case "KW_CLASS": return this.parseClassDeclaration();
        case "KW_IMPORT": return this.parseImportDeclaration();
        case "KW_EXPORT": return this.parseExportDeclaration();
        case "KW_ASYNC": return this.parseAsyncStatement();
      }
    }
    const start=this.cur(); const expression=this.parseExpression(); const end=this.eat(";")||this.tokens[this.i-1];
    return {type:"ExpressionStatement",expression,loc:locFrom(start,end)};
  }
  parseBlock() { const start=this.expect("{"); const body=[]; while(!this.at("}")){ if(this.cur().type==="eof") throw new BilaSyntaxError("Khối lệnh chưa đóng",this.cur()); body.push(this.parseStatement()); } const end=this.expect("}"); return {type:"BlockStatement",body,loc:locFrom(start,end)}; }
  parseVariableStatement(withSemicolon=true) {
    const start=this.expectKw("KW_VAR"); const declarations=[];
    do {
      const id=this.parseBindingPattern(); const typeAnnotation=this.parseTypeAnnotation(); let init=null;
      if(this.eat("=")) init=this.parseExpression();
      declarations.push({type:"VariableDeclarator",id,typeAnnotation,init,loc:{start:id.loc.start,end:(init?.loc?.end||typeAnnotation?.loc?.end||id.loc.end)}});
    } while(this.eat(","));
    const end=withSemicolon?(this.eat(";")||this.tokens[this.i-1]):this.tokens[this.i-1];
    return {type:"VariableDeclaration",kind:"var",declarations,loc:locFrom(start,end)};
  }
  parseFunctionDeclaration(asyncFlag=false, asyncStart=null) {
    const fn=this.expectKw("KW_FUNCTION"); const start=asyncStart||fn; const id=this.expectIdentifier(); this.expect("("); const params=[];
    if(!this.at(")")){ do { let p; if(this.eat("...")){const argument=this.parseBindingPattern();p={type:"RestElement",argument,loc:argument.loc};} else p=this.parseBindingPattern(); p.typeAnnotation=this.parseTypeAnnotation(); params.push(p); } while(this.eat(",")); }
    this.expect(")"); const returnType=this.parseTypeAnnotation(); const body=this.parseBlock();
    return {type:"FunctionDeclaration",id,params,returnType,body,async:asyncFlag,generator:false,loc:{start:start.start,end:body.loc.end}};
  }
  parseIf() { const start=this.expectKw("KW_IF"); this.expect("("); const test=this.parseExpression(); this.expect(")"); const consequent=this.parseStatement(); let alternate=null; if(this.eatKw("KW_ELSE")) alternate=this.parseStatement(); return {type:"IfStatement",test,consequent,alternate,loc:{start:start.start,end:(alternate?.loc?.end||consequent.loc?.end)}}; }
  parseWhile() { const start=this.expectKw("KW_WHILE"); this.expect("("); const test=this.parseExpression(); this.expect(")"); const body=this.parseStatement(); return {type:"WhileStatement",test,body,loc:{start:start.start,end:body.loc?.end}}; }
  parseDoWhile() { const start=this.expectKw("KW_DO"); const body=this.parseStatement(); this.expectKw("KW_WHILE"); this.expect("("); const test=this.parseExpression(); this.expect(")"); const end=this.eat(";")||this.tokens[this.i-1]; return {type:"DoWhileStatement",body,test,loc:locFrom(start,end)}; }
  parseFor() { const start=this.expectKw("KW_FOR"); this.expect("("); let init=null,test=null,update=null; if(!this.at(";")) init=this.atKw("KW_VAR")?this.parseVariableStatement(false):this.parseExpression(); this.expect(";"); if(!this.at(";")) test=this.parseExpression(); this.expect(";"); if(!this.at(")")) update=this.parseExpression(); this.expect(")"); const body=this.parseStatement(); return {type:"ForStatement",init,test,update,body,loc:{start:start.start,end:body.loc?.end}}; }
  parseReturn() { const start=this.expectKw("KW_RETURN"); let argument=null; if(!this.at(";")&&!this.at("}")&&this.cur().type!=="eof") argument=this.parseExpression(); const end=this.eat(";")||this.tokens[this.i-1]; return {type:"ReturnStatement",argument,loc:locFrom(start,end)}; }
  parseThrow() { const start=this.expectKw("KW_THROW"); const argument=this.parseExpression(); const end=this.eat(";")||this.tokens[this.i-1]; return {type:"ThrowStatement",argument,loc:locFrom(start,end)}; }
  parseTry() { const start=this.expectKw("KW_TRY"); const block=this.parseBlock(); let handler=null,finalizer=null; if(this.eatKw("KW_CATCH")){ this.expect("("); const param=this.expectIdentifier(); this.expect(")"); const body=this.parseBlock(); handler={type:"CatchClause",param,body,loc:{start:param.loc.start,end:body.loc.end}}; } if(this.eatKw("KW_FINALLY")) finalizer=this.parseBlock(); if(!handler&&!finalizer) throw new BilaSyntaxError("thuv/try cần chupr_layb/catch hoặc cujb_cugl/finally",this.cur()); return {type:"TryStatement",block,handler,finalizer,loc:{start:start.start,end:(finalizer?.loc?.end||handler?.loc?.end||block.loc.end)}}; }

  parseAsyncStatement(){ const start=this.expectKw("KW_ASYNC"); if(this.atKw("KW_FUNCTION")) return this.parseFunctionDeclaration(true,start); throw new BilaSyntaxError("async hiện hỗ trợ trước haml_sob/function",this.cur()); }
  parseClassDeclaration(){
    const start=this.expectKw("KW_CLASS"); const id=this.expectIdentifier(); let superClass=null; if(this.eatKw("KW_EXTENDS")) superClass=this.parsePostfix(this.parsePrimary()); this.expect("{"); const body=[];
    while(!this.at("}")){ let isStatic=false,isAsync=false; if(this.eatKw("KW_STATIC"))isStatic=true; if(this.eatKw("KW_ASYNC"))isAsync=true; const key=this.expectIdentifier(); this.expect("("); const params=[]; if(!this.at(")")){do{let p=this.parseBindingPattern();p.typeAnnotation=this.parseTypeAnnotation();params.push(p);}while(this.eat(","));} this.expect(")"); const returnType=this.parseTypeAnnotation(); const block=this.parseBlock(); body.push({type:"MethodDefinition",key,params,returnType,body:block,kind:key.name==="constructor"?"constructor":"method",static:isStatic,async:isAsync,loc:{start:key.loc.start,end:block.loc.end}}); }
    const end=this.expect("}"); return {type:"ClassDeclaration",id,superClass,body:{type:"ClassBody",body,loc:locFrom(start,end)},loc:locFrom(start,end)};
  }
  parseImportDeclaration(){
    const start=this.expectKw("KW_IMPORT"); const specifiers=[];
    if(this.eat("{")){ if(!this.at("}")){do{const imported=this.expectIdentifier();let local=imported;if(this.eatKw("KW_AS"))local=this.expectIdentifier();specifiers.push({type:"ImportSpecifier",imported,local});}while(this.eat(","));}this.expect("}"); }
    else { const local=this.expectIdentifier(); specifiers.push({type:"ImportDefaultSpecifier",local}); }
    this.expectKw("KW_FROM","Mong đợi tuk/from"); const src=this.cur(); if(src.type!=="string")throw new BilaSyntaxError("Import source phải là chuỗi",src);this.next();this.eat(";");return {type:"ImportDeclaration",specifiers,source:{type:"Literal",value:src.value,raw:src.raw,loc:locFrom(src)},loc:locFrom(start,src)};
  }
  parseExportDeclaration(){
    const start=this.expectKw("KW_EXPORT"); if(this.atKw("KW_FUNCTION")){const declaration=this.parseFunctionDeclaration();return {type:"ExportNamedDeclaration",declaration,specifiers:[],loc:{start:start.start,end:declaration.loc.end}};} if(this.atKw("KW_CLASS")){const declaration=this.parseClassDeclaration();return {type:"ExportNamedDeclaration",declaration,specifiers:[],loc:{start:start.start,end:declaration.loc.end}};} if(this.atKw("KW_VAR")){const declaration=this.parseVariableStatement(true);return {type:"ExportNamedDeclaration",declaration,specifiers:[],loc:{start:start.start,end:declaration.loc.end}};}
    this.expect("{");const specifiers=[];if(!this.at("}")){do{const local=this.expectIdentifier();let exported=local;if(this.eatKw("KW_AS"))exported=this.expectIdentifier();specifiers.push({type:"ExportSpecifier",local,exported});}while(this.eat(","));}const end=this.expect("}");this.eat(";");return {type:"ExportNamedDeclaration",declaration:null,specifiers,loc:locFrom(start,end)};
  }

  parseExpression() { return this.parseAssignment(); }
  parseAssignment() { let left=this.parseConditional(); if(this.at("=>")){ if(left.type!=="Identifier") throw new BilaSyntaxError("Tham số arrow đơn phải là định danh",this.cur()); this.next(); return this.finishArrow([left],left.loc.start); } if(ASSIGN.has(this.cur().value)){ const operator=this.next().value; const right=this.parseAssignment(); return {type:"AssignmentExpression",operator,left,right,loc:{start:left.loc?.start,end:right.loc?.end}}; } return left; }
  parseConditional() { let test=this.parseBinary(1); if(this.eat("?")){ const consequent=this.parseExpression(); this.expect(":"); const alternate=this.parseAssignment(); return {type:"ConditionalExpression",test,consequent,alternate,loc:{start:test.loc?.start,end:alternate.loc?.end}}; } return test; }
  operatorOf(token) { if(token.type==="punctuator") return token.value; return BINARY_KW[token.value]||null; }
  parseBinary(minPrec) { let left=this.parseUnary(); while(true){ const op=this.operatorOf(this.cur()); const prec=PRECEDENCE[op]||0; if(prec<minPrec) break; this.next(); const right=this.parseBinary(op==="**"?prec:prec+1); left={type:(op==="&&"||op==="||"||op==="??")?"LogicalExpression":"BinaryExpression",operator:op,left,right,loc:{start:left.loc?.start,end:right.loc?.end}}; } return left; }
  parseUnary() { const t=this.cur(); if(this.atKw("KW_AWAIT")){ const start=this.next(); const argument=this.parseUnary(); return {type:"AwaitExpression",argument,loc:{start:start.start,end:argument.loc?.end}}; } if(t.type==="punctuator"&&new Set(["!","+","-","~"]).has(t.value)){ this.next(); const argument=this.parseUnary(); return {type:"UnaryExpression",operator:t.value,prefix:true,argument,loc:{start:t.start,end:argument.loc?.end}}; } if(t.type==="keyword"&&UNARY_KW[t.value]){ this.next(); const argument=this.parseUnary(); return {type:"UnaryExpression",operator:UNARY_KW[t.value],prefix:true,argument,loc:{start:t.start,end:argument.loc?.end}}; } if(this.atKw("KW_NEW")){ const start=this.next(); const callee=this.parsePostfix(this.parsePrimary()); let args=[]; if(callee.type==="CallExpression") return {type:"NewExpression",callee:callee.callee,arguments:callee.arguments,loc:{start:start.start,end:callee.loc?.end}}; if(this.eat("(")) args=this.parseArgumentsAfterOpen(); return {type:"NewExpression",callee,arguments:args,loc:{start:start.start,end:(args.at(-1)?.loc?.end||callee.loc?.end)}}; } return this.parsePostfix(this.parsePrimary()); }
  parsePostfix(expr) { while(true){ if(this.eat("(")){ const args=this.parseArgumentsAfterOpen(); expr={type:"CallExpression",callee:expr,arguments:args,optional:false,loc:{start:expr.loc?.start,end:(args.at(-1)?.loc?.end||this.tokens[this.i-1].end)}}; continue; } if(this.eat("?.")){ if(this.eat("(")){ const args=this.parseArgumentsAfterOpen(); expr={type:"CallExpression",callee:expr,arguments:args,optional:true,loc:{start:expr.loc?.start,end:(args.at(-1)?.loc?.end||this.tokens[this.i-1].end)}}; continue; } if(this.eat("[")){ const property=this.parseExpression(); const end=this.expect("]"); expr={type:"MemberExpression",object:expr,property,computed:true,optional:true,loc:{start:expr.loc?.start,end:end.end}}; continue; } const p=this.expectIdentifier(); expr={type:"MemberExpression",object:expr,property:p,computed:false,optional:true,loc:{start:expr.loc?.start,end:p.loc.end}}; continue; } if(this.eat(".")){ const p=this.expectIdentifier(); expr={type:"MemberExpression",object:expr,property:p,computed:false,optional:false,loc:{start:expr.loc?.start,end:p.loc.end}}; continue; } if(this.eat("[")){ const property=this.parseExpression(); const end=this.expect("]"); expr={type:"MemberExpression",object:expr,property,computed:true,optional:false,loc:{start:expr.loc?.start,end:end.end}}; continue; } if(this.at("++")||this.at("--")){ const op=this.next(); expr={type:"UpdateExpression",operator:op.value,argument:expr,prefix:false,loc:{start:expr.loc?.start,end:op.end}}; continue; } break; } return expr; }
  parseArgumentsAfterOpen() { const args=[]; if(!this.at(")")){ do { if(this.eat("...")){ const argument=this.parseAssignment(); args.push({type:"SpreadElement",argument,loc:argument.loc}); } else args.push(this.parseAssignment()); } while(this.eat(",")); } this.expect(")"); return args; }
  finishArrow(params,start) { const body=this.at("{")?this.parseBlock():this.parseAssignment(); return {type:"ArrowFunctionExpression",params,body,expression:body.type!=="BlockStatement",async:false,loc:{start,end:body.loc?.end}}; }
  tryParenArrow() { const save=this.i; const start=this.cur().start; this.next(); const params=[]; try { if(!this.at(")")){ do { if(this.cur().type!=="identifier") throw new Error("not-arrow"); {const p=this.parseBindingPattern();p.typeAnnotation=this.parseTypeAnnotation();params.push(p);} } while(this.eat(",")); } this.expect(")"); if(!this.eat("=>")) throw new Error("not-arrow"); return this.finishArrow(params,start); } catch(e){ if(e instanceof BilaSyntaxError && e.message.includes("not-arrow")) throw e; this.i=save; return null; } }
  parsePrimary() {
    const t=this.cur();
    if(t.type==="number"){ this.next(); return {type:"Literal",value:null,raw:t.raw,numericKind:t.numericKind,loc:locFrom(t)}; }
    if(t.type==="string"){ this.next(); return {type:"Literal",value:t.value,raw:t.raw,loc:locFrom(t)}; }
    if(t.type==="regex"){ this.next(); return {type:"RegexLiteral",raw:t.raw,loc:locFrom(t)}; }
    if(t.type==="template"){ this.next(); return {type:"TemplateLiteralRaw",raw:t.raw,loc:locFrom(t)}; }
    if(t.type==="keyword"&&new Set(["KW_TRUE","KW_FALSE","KW_NULL"]).has(t.value)){ this.next(); return {type:"Literal",value:t.value==="KW_NULL"?null:t.value==="KW_TRUE",raw:t.raw,loc:locFrom(t)}; }
    if(this.atKw("KW_THIS")){ this.next(); return {type:"ThisExpression",loc:locFrom(t)}; }
    if(this.atKw("KW_FUNCTION")) return this.parseFunctionExpression();
    if(t.type==="identifier"){ this.next(); return {type:"Identifier",name:t.value,loc:locFrom(t)}; }
    if(this.at("(")){ const arrow=this.tryParenArrow(); if(arrow) return arrow; this.expect("("); const e=this.parseExpression(); this.expect(")"); return e; }
    if(this.eat("[")){ const start=t; const elements=[]; if(!this.at("]")){ do { if(this.eat("...")){ const argument=this.parseAssignment(); elements.push({type:"SpreadElement",argument,loc:argument.loc}); } else elements.push(this.parseAssignment()); } while(this.eat(",")); } const end=this.expect("]"); return {type:"ArrayExpression",elements,loc:locFrom(start,end)}; }
    if(this.eat("{")){ const start=t; const properties=[]; if(!this.at("}")){ do { if(this.eat("...")){ const argument=this.parseAssignment(); properties.push({type:"SpreadElement",argument,loc:argument.loc}); continue; } const k=this.cur(); let key; if(k.type==="identifier") key=this.expectIdentifier(); else if(k.type==="string"||k.type==="number"){ this.next(); key={type:"Literal",value:k.value,raw:k.raw,loc:locFrom(k)}; } else throw new BilaSyntaxError("Khóa object không hợp lệ",k); if(this.eat(":")){ const value=this.parseAssignment(); properties.push({type:"Property",key,value,kind:"init",computed:false,shorthand:false,loc:{start:key.loc?.start,end:value.loc?.end}}); } else if(key.type==="Identifier"){ properties.push({type:"Property",key,value:{...key},kind:"init",computed:false,shorthand:true,loc:key.loc}); } else throw new BilaSyntaxError("Object shorthand cần định danh",k); } while(this.eat(",")); } const end=this.expect("}"); return {type:"ObjectExpression",properties,loc:locFrom(start,end)}; }
    throw new BilaSyntaxError(`Biểu thức không hợp lệ gần '${t.raw||t.value}'`,t);
  }
  parseFunctionExpression() { const start=this.expectKw("KW_FUNCTION"); let id=null; if(this.cur().type==="identifier") id=this.expectIdentifier(); this.expect("("); const params=[]; if(!this.at(")")){ do params.push(this.expectIdentifier()); while(this.eat(",")); } this.expect(")"); const body=this.parseBlock(); return {type:"FunctionExpression",id,params,body,async:false,generator:false,loc:{start:start.start,end:body.loc.end}}; }
}

export function parse(source){ const p=new Parser(source); const ast=p.parseProgram(); return {ast,mode:p.mode,directive:p.directive,source:p.source}; }
