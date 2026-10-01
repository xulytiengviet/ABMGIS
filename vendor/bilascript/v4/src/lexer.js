import { resolveKeyword, MAPPED_ENGLISH } from "./vocabulary.js";

const OPS = [
  ">>>=", "===", "!==", "**=", "??=", ">>>", "...", "=>", "==", "!=", "<=", ">=",
  "++", "--", "+=", "-=", "*=", "/=", "%=", "&&", "||", "??", "?.", "**", "<<", ">>",
  "&=", "|=", "^="
];
const ONE = new Set("{}()[];,.?:+-*/%<>=!&|^~");
const idStart = ch => !!ch && (ch === "$" || ch === "_" || /\p{ID_Start}/u.test(ch));
const idPart = ch => !!ch && (ch === "$" || ch === "_" || /\p{ID_Continue}/u.test(ch));

export class BilaSyntaxError extends SyntaxError {
  constructor(message, token) {
    const p = token?.start || token;
    super(`${message}${p?.line ? ` tại dòng ${p.line}, cột ${p.column}` : ""}`);
    this.name = "BilaSyntaxError";
    this.token = token || null;
  }
}

export function detectProfile(source) {
  const re = /^\uFEFF?\s*---(?:bila(?::(strict|js))?|cvss|cvnss|cvnss40|cvnss4)---\s*(?:\r?\n|$)/;
  const m = source.match(re);
  if (!m) return { mode: "bila", source, directive: null, lineOffset: 0, offset: 0 };
  return {
    mode: m[1] || "bila",
    source: source.slice(m[0].length),
    directive: m[0].trim(),
    lineOffset: (m[0].match(/\n/g) || []).length,
    offset: m[0].length
  };
}

function canStartRegex(prev) {
  if (!prev) return true;
  if (prev.type === "keyword") {
    return !new Set(["KW_TRUE", "KW_FALSE", "KW_NULL", "KW_THIS"]).has(prev.value);
  }
  if (prev.type === "punctuator") {
    return new Set(["(", "{", "[", ",", ";", ":", "?", "=", "==", "===", "!=", "!==", "!", "&&", "||", "??", "=>", "+=", "-=", "*=", "/=", "%="]).has(prev.value);
  }
  return false;
}

export function lex(input) {
  const original = String(input);
  const profile = detectProfile(original);
  const source = profile.source;
  const tokens = [];
  let i = 0, line = 1 + profile.lineOffset, column = 1;
  let prev = null;

  const peek = (n = 0) => source[i + n] || "";
  const pos = () => ({ offset: profile.offset + i, line, column });
  const advance = () => {
    const ch = source[i++] || "";
    if (ch === "\n") { line++; column = 1; } else column++;
    return ch;
  };
  const add = (type, value, raw, start, extra = {}) => {
    const token = { type, value, raw, start, end: pos(), ...extra };
    tokens.push(token); prev = token; return token;
  };

  while (i < source.length) {
    const ch = peek();
    if (/\s/u.test(ch)) { advance(); continue; }
    if (ch === "/" && peek(1) === "/") { while (i < source.length && advance() !== "\n") {} continue; }
    if (ch === "/" && peek(1) === "*") {
      const start = pos(); advance(); advance();
      while (i < source.length && !(peek() === "*" && peek(1) === "/")) advance();
      if (i >= source.length) throw new BilaSyntaxError("Comment chưa đóng", start);
      advance(); advance(); continue;
    }

    const start = pos();
    if (idStart(ch)) {
      let raw = advance();
      while (idPart(peek())) raw += advance();
      if (profile.mode === "strict" && MAPPED_ENGLISH.has(raw)) {
        throw new BilaSyntaxError(`Từ khóa English '${raw}' bị cấm trong bila:strict; hãy dùng canonical CVNSS4.0`, start);
      }
      const kw = resolveKeyword(raw, profile.mode);
      if (kw) add("keyword", kw.id, raw, start, { js: kw.js, canonical: kw.canonical, surface: kw.surface });
      else add("identifier", raw, raw, start);
      continue;
    }

    if (/\d/.test(ch) || (ch === "." && /\d/.test(peek(1)))) {
      let raw = "", kind = "number";
      const takeWhile = re => { while (re.test(peek())) raw += advance(); };
      if (ch === "0" && /[xX]/.test(peek(1))) {
        raw += advance() + advance(); takeWhile(/[0-9A-Fa-f_]/);
      } else if (ch === "0" && /[bB]/.test(peek(1))) {
        raw += advance() + advance(); takeWhile(/[01_]/);
      } else if (ch === "0" && /[oO]/.test(peek(1))) {
        raw += advance() + advance(); takeWhile(/[0-7_]/);
      } else {
        takeWhile(/[0-9_]/);
        if (peek() === ".") { raw += advance(); takeWhile(/[0-9_]/); }
        if (/[eE]/.test(peek())) { raw += advance(); if (/[+-]/.test(peek())) raw += advance(); takeWhile(/[0-9_]/); }
      }
      if (peek() === "n") { raw += advance(); kind = "bigint"; }
      add("number", null, raw, start, { numericKind: kind });
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = advance(); let raw = quote, value = "", closed = false;
      while (i < source.length) {
        const c = advance(); raw += c;
        if (c === quote) { closed = true; break; }
        if (c === "\n" || c === "") break;
        if (c === "\\") { const e = advance(); raw += e; value += "\\" + e; }
        else value += c;
      }
      if (!closed) throw new BilaSyntaxError("Chuỗi chưa đóng", start);
      add("string", value, raw, start); continue;
    }

    if (ch === "`") {
      let raw = advance(), closed = false, interpolation = false;
      while (i < source.length) {
        const c = advance(); raw += c;
        if (c === "\\") { const e = advance(); raw += e; continue; }
        if (c === "$" && peek() === "{") interpolation = true;
        if (c === "`") { closed = true; break; }
      }
      if (!closed) throw new BilaSyntaxError("Template literal chưa đóng", start);
      // Template interpolation is a structural JavaScript passthrough in v4.
      // The complete template is preserved verbatim; CVNSS4.0 aliases inside ${...}
      // are not semantically lowered yet, so no runtime helper or hidden rewrite is added.
      add("template", raw, raw, start); continue;
    }

    if (ch === "/" && canStartRegex(prev)) {
      let raw = advance(), inClass = false, closed = false;
      while (i < source.length) {
        const c = advance(); raw += c;
        if (c === "\\") { const e = advance(); raw += e; continue; }
        if (c === "[") inClass = true;
        if (c === "]") inClass = false;
        if (c === "/" && !inClass) { closed = true; break; }
        if (c === "\n") break;
      }
      if (!closed) throw new BilaSyntaxError("Regex literal chưa đóng", start);
      while (/[A-Za-z]/.test(peek())) raw += advance();
      add("regex", raw, raw, start); continue;
    }

    const op = OPS.find(x => source.startsWith(x, i));
    if (op) { for (let k = 0; k < op.length; k++) advance(); add("punctuator", op, op, start); continue; }
    if (ONE.has(ch)) { advance(); add("punctuator", ch, ch, start); continue; }
    throw new BilaSyntaxError(`Ký tự không hợp lệ '${ch}'`, start);
  }
  const eofPos = pos();
  tokens.push({ type: "eof", value: "<eof>", raw: "", start: eofPos, end: eofPos });
  return { mode: profile.mode, directive: profile.directive, tokens, source: original };
}
