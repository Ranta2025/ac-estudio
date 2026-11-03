/* Mini assembler + 8086 emulator for the FASM boot-sector subset used in the exams.
 * Works in the browser (global `Emu`) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  const REG8 = { al: [0, 0], cl: [1, 0], dl: [2, 0], bl: [3, 0], ah: [0, 1], ch: [1, 1], dh: [2, 1], bh: [3, 1] };
  const REG16 = { ax: 0, cx: 1, dx: 2, bx: 3, sp: 4, bp: 5, si: 6, di: 7 };
  const SREG = { es: 0, cs: 1, ss: 2, ds: 3 };
  const R16N = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const SN = ['ES', 'CS', 'SS', 'DS'];

  const COND = {
    jz: ['ZF=1', f => f.ZF], je: ['ZF=1', f => f.ZF],
    jnz: ['ZF=0', f => !f.ZF], jne: ['ZF=0', f => !f.ZF],
    ja: ['CF=0 y ZF=0 (mayor, sin signo)', f => !f.CF && !f.ZF], jnbe: ['CF=0 y ZF=0 (mayor, sin signo)', f => !f.CF && !f.ZF],
    jae: ['CF=0 (mayor o igual, sin signo)', f => !f.CF], jnb: ['CF=0 (mayor o igual, sin signo)', f => !f.CF], jnc: ['CF=0', f => !f.CF],
    jb: ['CF=1 (menor, sin signo)', f => !!f.CF], jnae: ['CF=1 (menor, sin signo)', f => !!f.CF], jc: ['CF=1', f => !!f.CF],
    jbe: ['CF=1 o ZF=1 (menor o igual, sin signo)', f => f.CF || f.ZF], jna: ['CF=1 o ZF=1 (menor o igual, sin signo)', f => f.CF || f.ZF],
    jg: ['ZF=0 y SF=OF (mayor, con signo)', f => !f.ZF && f.SF === f.OF], jnle: ['ZF=0 y SF=OF (mayor, con signo)', f => !f.ZF && f.SF === f.OF],
    jge: ['SF=OF (mayor o igual, con signo)', f => f.SF === f.OF], jnl: ['SF=OF (mayor o igual, con signo)', f => f.SF === f.OF],
    jl: ['SF≠OF (menor, con signo)', f => f.SF !== f.OF], jnge: ['SF≠OF (menor, con signo)', f => f.SF !== f.OF],
    jle: ['ZF=1 o SF≠OF (menor o igual, con signo)', f => f.ZF || f.SF !== f.OF], jng: ['ZF=1 o SF≠OF (menor o igual, con signo)', f => f.ZF || f.SF !== f.OF],
    js: ['SF=1', f => !!f.SF], jns: ['SF=0', f => !f.SF],
    jo: ['OF=1', f => !!f.OF], jno: ['OF=0', f => !f.OF],
    jp: ['PF=1', f => !!f.PF], jpe: ['PF=1', f => !!f.PF], jnp: ['PF=0', f => !f.PF], jpo: ['PF=0', f => !f.PF]
  };

  const INS = new Set(['mov', 'add', 'sub', 'inc', 'dec', 'and', 'or', 'xor', 'not', 'neg', 'test', 'cmp', 'shl', 'shr', 'xchg', 'loop', 'jmp', 'jcxz', 'nop', 'hlt']
    .concat(Object.keys(COND)));

  function hx(v, bits) {
    const w = bits === 8 ? 2 : 4;
    let s = ((v >>> 0) & (bits === 8 ? 0xFF : 0xFFFF)).toString(16).toUpperCase().padStart(w, '0');
    if (/^[A-F]/.test(s)) s = '0' + s;
    return s + 'h';
  }
  function bn(v, bits) { return ((v >>> 0) & (bits === 8 ? 0xFF : 0xFFFF)).toString(2).padStart(bits, '0') + 'b'; }
  function mask(bits) { return bits === 8 ? 0xFF : 0xFFFF; }
  function vs(v, bits) { return v + ' (' + hx(v, bits) + ')'; }
  function chr(v) { return (v >= 32 && v < 127) ? "'" + String.fromCharCode(v) + "'" : null; }

  /* ---------------- expressions ---------------- */
  function parseNumberWord(w) {
    if (/^\d+$/.test(w)) return parseInt(w, 10);
    if (/^0x[0-9a-f]+$/i.test(w)) return parseInt(w.slice(2), 16);
    if (/^[0-9][0-9a-f]*h$/i.test(w)) return parseInt(w.slice(0, -1), 16);
    if (/^[01]+b$/i.test(w)) return parseInt(w.slice(0, -1), 2);
    return null;
  }
  function tokenizeExpr(s) {
    const toks = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'" || c === '"') {
        const j = s.indexOf(c, i + 1);
        if (j < 0) throw new Error('Cadena sin cerrar');
        toks.push({ t: 'str', v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      if ('+-*/()'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
      const m = /^[A-Za-z0-9_@.$?]+/.exec(s.slice(i));
      if (!m) throw new Error("Carácter no válido en la expresión: '" + c + "'");
      toks.push({ t: 'w', v: m[0] }); i += m[0].length;
    }
    return toks;
  }
  function evalExpr(str, ctx) {
    const toks = tokenizeExpr(str); let p = 0;
    function prim() {
      const t = toks[p++];
      if (!t) throw new Error('Expresión incompleta: "' + str + '"');
      if (t.t === 'op') {
        if (t.v === '(') { const v = add(); const c = toks[p++]; if (!c || c.v !== ')') throw new Error('Falta ")"'); return v; }
        if (t.v === '-') return -prim();
        if (t.v === '+') return prim();
        throw new Error('Expresión no válida: "' + str + '"');
      }
      if (t.t === 'str') {
        if (!t.v.length) throw new Error('Cadena vacía en expresión');
        let v = 0; for (let i = t.v.length - 1; i >= 0; i--) v = v * 256 + t.v.charCodeAt(i); return v;
      }
      const w = t.v;
      if (w === '$') return ctx.here;
      if (w === '$$') return ctx.start;
      if (w === '@f' || w === '@F') { if (ctx.anonF == null) { if (ctx.lenient) return 0; throw new Error('@f sin un @@ posterior'); } return ctx.anonF; }
      if (w === '@b' || w === '@B') { if (ctx.anonB == null) { if (ctx.lenient) return 0; throw new Error('@b sin un @@ anterior'); } return ctx.anonB; }
      const n = parseNumberWord(w); if (n !== null) return n;
      if (ctx.labels && ctx.labels.has(w)) return ctx.labels.get(w);
      if (ctx.lenient) return 0;
      throw new Error('Etiqueta no definida: ' + w);
    }
    function mul() { let v = unary(); while (toks[p] && toks[p].t === 'op' && (toks[p].v === '*' || toks[p].v === '/')) { const o = toks[p++].v; const r = unary(); v = o === '*' ? v * r : Math.trunc(v / r); } return v; }
    function unary() { return prim(); }
    function add() { let v = mul(); while (toks[p] && toks[p].t === 'op' && (toks[p].v === '+' || toks[p].v === '-')) { const o = toks[p++].v; const r = mul(); v = o === '+' ? v + r : v - r; } return v; }
    const v = add();
    if (p < toks.length) throw new Error('Sobra texto en la expresión: "' + str + '"');
    return v;
  }
  function refsLabel(expr) {
    return tokenizeExpr(expr).some(t => t.t === 'w' && parseNumberWord(t.v) === null && t.v !== '$' && t.v !== '$$');
  }

  /* ---------------- text helpers ---------------- */
  function stripComment(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; }
      else if (c === "'" || c === '"') q = c;
      else if (c === ';') return s.slice(0, i);
    }
    return s;
  }
  function splitTop(s, sep) {
    sep = sep || ',';
    const out = []; let cur = '', q = null, depth = 0;
    for (const c of s) {
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim() !== '' || out.length) out.push(cur.trim());
    return out;
  }

  /* ---------------- operands ---------------- */
  function parseOperand(str) {
    let s = str.trim();
    const low = s.toLowerCase();
    if (REG8[low]) return { t: 'r8', idx: REG8[low][0], hi: REG8[low][1], name: low.toUpperCase() };
    if (low in REG16) return { t: 'r16', idx: REG16[low], name: low.toUpperCase() };
    if (low in SREG) return { t: 'seg', idx: SREG[low], name: low.toUpperCase() };
    let size = 0;
    const pm = /^(byte|word)\s+(.*)$/i.exec(s);
    if (pm) { size = pm[1].toLowerCase() === 'byte' ? 8 : 16; s = pm[2].trim(); }
    if (s[0] === '[' && s[s.length - 1] === ']') {
      const inner = s.slice(1, -1);
      const terms = inner.match(/[+-]?[^+-]+/g) || [];
      const regs = []; const rest = [];
      for (const t of terms) {
        const nm = t.replace(/^[+-]/, '').trim().toLowerCase();
        if (['bx', 'bp', 'si', 'di'].includes(nm) && !t.startsWith('-')) regs.push(nm);
        else rest.push(t.trim());
      }
      let expr = rest.join('').replace(/^\+/, '');
      return { t: 'mem', regs, expr: expr === '' ? null : expr, size, text: s };
    }
    return { t: 'imm', expr: s };
  }

  /* ---------------- sizes (approximate real encodings) ---------------- */
  function memBytes(m) {
    if (m.regs.length === 0) return 3;
    if (m.expr == null) return (m.regs.length === 1 && m.regs[0] === 'bp') ? 2 : 1;
    if (refsLabel(m.expr)) return 3;
    const d = m.dispLen;
    return (d >= -128 && d <= 127) ? 2 : 3;
  }
  function insSize(op, a, b, bits) {
    const isAcc = o => o && ((o.t === 'r8' && o.idx === 0 && !o.hi) || (o.t === 'r16' && o.idx === 0));
    const fit8 = o => !(o.expr && refsLabel(o.expr)) && o.vlen >= -128 && o.vlen <= 127;
    switch (op) {
      case 'mov':
        if (a.t === 'seg' || (b && b.t === 'seg')) return (a.t === 'mem' || b.t === 'mem') ? 1 + memBytes(a.t === 'mem' ? a : b) : 2;
        if (a.t === 'r8' && b.t === 'imm') return 2;
        if (a.t === 'r16' && b.t === 'imm') return 3;
        if (a.t !== 'mem' && b.t !== 'mem') return 2;
        if (a.t === 'mem' && b.t === 'imm') return 1 + memBytes(a) + (bits === 8 ? 1 : 2);
        { const m = a.t === 'mem' ? a : b; const r = a.t === 'mem' ? b : a;
          if (m.regs.length === 0 && isAcc(r)) return 3;
          return 1 + memBytes(m); }
      case 'add': case 'sub': case 'and': case 'or': case 'xor': case 'cmp': case 'test':
        if (b.t === 'imm') {
          if (a.t === 'mem') return 1 + memBytes(a) + (bits === 8 ? 1 : (op === 'test' ? 2 : (fit8(b) ? 1 : 2)));
          if (bits === 8) return isAcc(a) ? 2 : 3;
          if (op === 'test') return isAcc(a) ? 3 : 4;
          return isAcc(a) ? 3 : (fit8(b) ? 3 : 4);
        }
        if (a.t === 'mem' || b.t === 'mem') return 1 + memBytes(a.t === 'mem' ? a : b);
        return 2;
      case 'inc': case 'dec':
        if (a.t === 'r16') return 1; if (a.t === 'r8') return 2; return 1 + memBytes(a);
      case 'not': case 'neg': return a.t === 'mem' ? 1 + memBytes(a) : 2;
      case 'shl': case 'shr': return (b.t === 'imm' && b.vlen > 1) ? (a.t === 'mem' ? 2 + memBytes(a) : 3) : (a.t === 'mem' ? 1 + memBytes(a) : 2);
      case 'xchg': if (a.t === 'r16' && b.t === 'r16' && (a.idx === 0 || b.idx === 0)) return 1; return a.t === 'mem' || b.t === 'mem' ? 1 + memBytes(a.t === 'mem' ? a : b) : 2;
      case 'nop': case 'hlt': return 1;
      default: return 2; // jumps / loop
    }
  }

  /* ---------------- data ---------------- */
  function emitData(args, unit, ctx) {
    const out = []; let isText = false;
    for (const raw of args) {
      const a = raw.trim();
      if (a === '') continue;
      const dm = /^(.+?)\s+dup\s*\((.*)\)\s*$/i.exec(a);
      if (dm) {
        const n = evalExpr(dm[1], ctx);
        if (n < 0 || n > 65536) throw new Error('dup con contador inválido: ' + n);
        const inner = emitData(splitTop(dm[2]), unit, ctx);
        if (inner.isText) isText = true;
        for (let i = 0; i < n; i++) for (const x of inner.bytes) out.push(x);
        continue;
      }
      const sm = /^(['"])([^'"]*)\1$/.exec(a);
      if (sm && (unit === 'db' || sm[2].length <= 2)) {
        if (unit === 'db') { for (const ch of sm[2]) out.push(ch.charCodeAt(0) & 0xFF); isText = true; }
        else { let v = 0; for (let i = sm[2].length - 1; i >= 0; i--) v = v * 256 + sm[2].charCodeAt(i); out.push(v & 0xFF, (v >> 8) & 0xFF); }
        continue;
      }
      let v = a === '?' ? 0 : evalExpr(a, ctx);
      if (unit === 'db') out.push(v & 0xFF);
      else if (unit === 'dw') out.push(v & 0xFF, (v >> 8) & 0xFF);
      else { out.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF); }
    }
    return { bytes: out, isText };
  }

  /* ---------------- assembler ---------------- */
  const LABEL_RE = /^([A-Za-z_.@][\w@.$]*)\s*:(?!:)\s*(.*)$/;

  function assemble(src) {
    const lines = src.replace(/\r/g, '').split('\n');
    const items = []; const labels = new Map(); const labelInfo = []; const anon = [];
    let addr = 0, start = 0, pending = [];
    const errors = [];
    const lenCtx = () => ({ labels, here: addr, start, lenient: true, anonF: null, anonB: anon.length ? anon[anon.length - 1] : null });

    function attach(item) { for (const l of pending) { l.item = item; l.kind = item.kind === 'ins' ? 'code' : (item.kind === 'data' || item.kind === 'times') ? 'data' : 'other'; } pending = []; }

    try {
      for (let li = 0; li < lines.length; li++) {
        let s = stripComment(lines[li]).trim();
        if (!s) continue;
        try {
          let m;
          while ((m = LABEL_RE.exec(s)) && !INS.has(m[1].toLowerCase())) {
            const name = m[1]; s = m[2].trim();
            if (name === '@@') { anon.push(addr); }
            else {
              if (labels.has(name)) throw new Error('Etiqueta repetida: ' + name);
              labels.set(name, addr);
              const info = { name, addr, line: li, kind: 'other', item: null }; labelInfo.push(info); pending.push(info);
            }
          }
          if (!s) continue;
          const wm = /^([A-Za-z_.][\w.]*)\b\s*(.*)$/.exec(s);
          if (!wm) throw new Error('No entiendo esta línea: ' + s);
          const w = wm[1].toLowerCase(); const rest = wm[2];

          if (w === 'format' || w === 'use16') continue;
          if (w === 'use32' || w === 'use64') throw new Error('Solo se simula modo real de 16 bits (use16)');
          if (w === 'org') { start = addr = evalExpr(rest, { labels, here: addr, start, lenient: false }); continue; }
          if (w === 'times') {
            const tm = /^(.+?)\s+(db|dw|dd)\s+(.+)$/i.exec(rest);
            if (!tm) throw new Error('Sintaxis de times: times N db valor');
            const n = evalExpr(tm[1], { labels, here: addr, start, lenient: true });
            if (n < 0) throw new Error('times con contador negativo (' + n + '): el programa ya se pasó de 510 bytes');
            const unit = tm[2].toLowerCase();
            const e = emitData(splitTop(tm[3]), unit, lenCtx());
            const it = { kind: 'times', addr, line: li, text: s, count: n, unit, args: splitTop(tm[3]), size: n * e.bytes.length };
            attach(it); items.push(it); addr += it.size; continue;
          }
          // data definitions
          let dlabel = null, dunit = null, dargs = null;
          let dm = /^(db|dw|dd)\s+(.*)$/i.exec(s);
          if (dm) { dunit = dm[1].toLowerCase(); dargs = dm[2]; }
          else {
            dm = /^([A-Za-z_.@][\w@.$]*)\s+(db|dw|dd)\s+(.*)$/i.exec(s);
            if (dm) { dlabel = dm[1]; dunit = dm[2].toLowerCase(); dargs = dm[3]; }
          }
          if (dunit) {
            if (dlabel) {
              if (labels.has(dlabel)) throw new Error('Etiqueta repetida: ' + dlabel);
              labels.set(dlabel, addr);
              const info = { name: dlabel, addr, line: li, kind: 'data', item: null }; labelInfo.push(info); pending.push(info);
            }
            const args = splitTop(dargs);
            const e = emitData(args, dunit, lenCtx());
            const it = { kind: 'data', unit: dunit, addr, line: li, text: s, args, size: e.bytes.length, isText: e.isText };
            attach(it); items.push(it); addr += it.size; continue;
          }
          // instruction
          if (!INS.has(w)) throw new Error('Instrucción no soportada por el simulador: ' + w);
          const opStrs = rest === '' ? [] : splitTop(rest);
          const ops = opStrs.map(parseOperand);
          const it = { kind: 'ins', op: w, ops, addr, line: li, text: s.replace(/\s+/g, ' '), anonIdx: anon.length };
          // lenient values for size
          const lc = lenCtx();
          for (const o of ops) {
            if (o.t === 'imm') { try { o.vlen = evalExpr(o.expr, lc); } catch (e) { o.vlen = 0; } }
            if (o.t === 'mem') { o.dispLen = o.expr ? evalExpr(o.expr, lc) : 0; }
          }
          it.bits = sizeBits(it, true);
          it.size = insSize(w, ops[0], ops[1], it.bits);
          attach(it); items.push(it); addr += it.size;
        } catch (e) { e.line = li; throw e; }
      }
      // pass 2: resolve operands
      const end = addr;
      for (const it of items) {
        if (it.kind !== 'ins') continue;
        const ctx = { labels, here: it.addr, start, lenient: false, anonF: anon[it.anonIdx], anonB: it.anonIdx > 0 ? anon[it.anonIdx - 1] : null };
        try {
          for (const o of it.ops) {
            if (o.t === 'imm') { o.v = evalExpr(o.expr, ctx); o.isAddr = refsLabel(o.expr); }
            if (o.t === 'mem') { o.disp = o.expr ? evalExpr(o.expr, ctx) : 0; o.isAddr = !!(o.expr && refsLabel(o.expr)); }
          }
          it.bits = sizeBits(it, false);
          validate(it);
        } catch (e) { e.line = it.line; throw e; }
      }
      // memory image
      const mem = new Uint8Array(65536);
      const dataEnd = [];
      for (const it of items) {
        if (it.kind === 'data') {
          const e = emitData(it.args, it.unit, { labels, here: it.addr, start, lenient: false });
          e.bytes.forEach((b, i) => { mem[(it.addr + i) & 0xFFFF] = b; });
        } else if (it.kind === 'times') {
          const e = emitData(it.args, it.unit, { labels, here: it.addr, start, lenient: false });
          for (let k = 0; k < it.count; k++) e.bytes.forEach((b, i) => { mem[(it.addr + k * e.bytes.length + i) & 0xFFFF] = b; });
        }
      }
      // data extents
      const extents = [];
      let cur = null;
      for (const it of items) {
        if (it.kind === 'data') {
          const lab = labelInfo.find(l => l.item === it);
          if (lab || !cur) { cur = { label: lab ? lab.name : null, addr: it.addr, len: 0, unit: it.unit, isText: false, line: it.line }; extents.push(cur); }
          cur.len += it.size; cur.isText = cur.isText || it.isText;
        } else cur = null;
      }
      const codeBytes = items.filter(i => i.kind === 'ins').reduce((s, i) => s + i.size, 0);
      const dataBytes = items.filter(i => i.kind === 'data').reduce((s, i) => s + i.size, 0);
      const padItems = items.filter(i => i.kind === 'times');
      const padBytes = padItems.reduce((s, i) => s + i.size, 0);
      const byAddr = new Map(); items.forEach(i => { if (i.kind === 'ins') byAddr.set(i.addr, i); });
      const layout = { start, end, total: end - start, codeBytes, dataBytes, padBytes, sigBytes: (end - start >= 2 && mem[end - 2] === 0x55 && mem[end - 1] === 0xAA) ? 2 : 0 };
      return { ok: true, lines, items, labels, labelInfo, anon, start, end, mem, extents: extents.filter(x => x.label), byAddr, layout, source: src };
    } catch (e) {
      return { ok: false, error: e.message, line: e.line != null ? e.line : null, lines };
    }
  }

  function sizeBits(it, lenient) {
    const [a, b] = it.ops;
    const jumpish = it.op === 'loop' || it.op === 'jmp' || it.op === 'jcxz' || COND[it.op];
    if (jumpish || it.op === 'nop' || it.op === 'hlt') return 16;
    for (const o of [a, b]) { if (!o) continue; if (o.t === 'r8') return 8; if (o.t === 'r16' || o.t === 'seg') return 16; }
    for (const o of [a, b]) { if (o && o.t === 'mem' && o.size) return o.size; }
    if (lenient) return 8;
    throw new Error('FASM: no se sabe el tamaño del operando; escribe "byte [..]" o "word [..]"');
  }
  function validate(it) {
    const [a, b] = it.ops; const op = it.op;
    const need = { mov: 2, add: 2, sub: 2, and: 2, or: 2, xor: 2, cmp: 2, test: 2, xchg: 2, shl: 2, shr: 2, inc: 1, dec: 1, not: 1, neg: 1, loop: 1, jmp: 1, jcxz: 1, nop: 0, hlt: 0 };
    const n = COND[op] ? 1 : need[op];
    if (it.ops.length !== n) throw new Error(op + ' necesita ' + n + ' operando(s)');
    if (a && a.t === 'imm' && !['loop', 'jmp', 'jcxz'].includes(op) && !COND[op]) throw new Error('El destino de ' + op + ' no puede ser un número');
    if (a && b && a.t === 'mem' && b.t === 'mem') throw new Error('No se puede operar de memoria a memoria en una sola instrucción (usa un registro)');
    if (op === 'mov' && a.t === 'seg' && b.t === 'imm') throw new Error('mov a un registro de segmento no admite un número: usa mov ax, cs / mov ds, ax');
    if (op === 'mov' && a.t === 'seg' && b.t === 'seg') throw new Error('mov entre registros de segmento no existe: pasa por AX');
    if (a && b && a.t !== 'mem' && b.t !== 'mem' && b.t !== 'imm') {
      const sa = a.t === 'r8' ? 8 : 16, sb = b.t === 'r8' ? 8 : 16;
      if (sa !== sb) throw new Error('Los dos registros deben tener el mismo tamaño (' + a.name + ' y ' + b.name + ' no lo tienen)');
    }
    if (a && b && (a.t === 'r8' || (a.t === 'mem' && it.bits === 8)) && b.t === 'imm' && (b.v > 255 || b.v < -128))
      throw new Error('El valor ' + b.v + ' no cabe en 1 byte (rango 0..255)');
    if (a && b && (a.t === 'r16') && b.t === 'imm' && (b.v > 65535 || b.v < -32768))
      throw new Error('El valor ' + b.v + ' no cabe en 2 bytes');
  }

  /* ---------------- CPU ---------------- */
  function ea(cpu, o) {
    let s = o.disp || 0;
    for (const r of o.regs) s += cpu.regs[REG16[r]];
    return s & 0xFFFF;
  }
  function rd(cpu, o, bits) {
    switch (o.t) {
      case 'imm': return o.v & mask(bits);
      case 'r8': { const v = cpu.regs[o.idx]; return o.hi ? (v >> 8) & 0xFF : v & 0xFF; }
      case 'r16': return cpu.regs[o.idx];
      case 'seg': return cpu.sregs[o.idx];
      case 'mem': { const a = ea(cpu, o); return bits === 8 ? cpu.mem[a] : (cpu.mem[a] | (cpu.mem[(a + 1) & 0xFFFF] << 8)); }
    }
  }
  function wr(cpu, o, bits, v) {
    v &= mask(bits);
    switch (o.t) {
      case 'r8': { const cur = cpu.regs[o.idx]; cpu.regs[o.idx] = o.hi ? ((cur & 0x00FF) | (v << 8)) : ((cur & 0xFF00) | v); break; }
      case 'r16': cpu.regs[o.idx] = v; break;
      case 'seg': cpu.sregs[o.idx] = v; break;
      case 'mem': {
        const a = ea(cpu, o);
        const old = bits === 8 ? cpu.mem[a] : (cpu.mem[a] | (cpu.mem[(a + 1) & 0xFFFF] << 8));
        cpu.mem[a] = v & 0xFF; if (bits === 16) cpu.mem[(a + 1) & 0xFFFF] = v >> 8;
        cpu.writes.push({ addr: a, old, val: v, bits });
        break;
      }
    }
  }
  function parity(v) { let x = v & 0xFF, c = 0; while (x) { c += x & 1; x >>= 1; } return c % 2 === 0 ? 1 : 0; }
  function setSZP(f, r, bits) { f.ZF = r === 0 ? 1 : 0; f.SF = (r & (bits === 8 ? 0x80 : 0x8000)) ? 1 : 0; f.PF = parity(r); }
  function alu(cpu, op, a, b, bits) {
    const f = cpu.flags, m = mask(bits), sg = bits === 8 ? 0x80 : 0x8000; let r;
    switch (op) {
      case 'add': r = a + b; f.CF = r > m ? 1 : 0; f.OF = ((a ^ r) & (b ^ r) & sg) ? 1 : 0; r &= m; break;
      case 'sub': case 'cmp': r = a - b; f.CF = a < b ? 1 : 0; f.OF = ((a ^ b) & (a ^ r) & sg) ? 1 : 0; r &= m; break;
      case 'and': case 'test': r = a & b; f.CF = 0; f.OF = 0; break;
      case 'or': r = a | b; f.CF = 0; f.OF = 0; break;
      case 'xor': r = a ^ b; f.CF = 0; f.OF = 0; break;
    }
    setSZP(f, r, bits); return r;
  }

  function memName(prog, a) {
    for (const e of prog.extents) if (a >= e.addr && a < e.addr + e.len) return a === e.addr ? e.label : e.label + '+' + (a - e.addr);
    return null;
  }
  function codeName(prog, a) {
    for (const l of prog.labelInfo) if (l.addr === a && l.kind === 'code') return l.name;
    const ai = prog.anon.indexOf(a); if (ai >= 0) return '@@';
    return null;
  }
  function addrTxt(prog, a) {
    const n = memName(prog, a) || codeName(prog, a);
    return hx(a, 16) + (n ? ' = ' + n : '');
  }
  function flagTxt(f) { return 'ZF=' + f.ZF + ', CF=' + f.CF + ', SF=' + f.SF; }
  function opTxt(o) { return o.t === 'imm' ? o.expr : o.t === 'mem' ? o.text.replace(/^(byte|word)\s+/i, '').toUpperCase().replace(/\bBYTE\b|\bWORD\b/, '') : o.name; }

  function exec(cpu, it, prog) {
    const op = it.op, [a, b] = it.ops, bits = it.bits;
    const f = cpu.flags; let ex = '', taken = null, next = it.addr + it.size, halt = null;
    const memDesc = o => { const ad = ea(cpu, o); return opTxt(o) + ' (dirección ' + addrTxt(prog, ad) + ')'; };
    switch (op) {
      case 'mov': {
        const v = rd(cpu, b, bits);
        const oldTxt = a.t === 'mem' ? (() => { const ad = ea(cpu, a); return bits === 8 ? cpu.mem[ad] : cpu.mem[ad] | (cpu.mem[(ad + 1) & 0xFFFF] << 8); })() : null;
        const dstDesc = a.t === 'mem' ? memDesc(a) : null;
        wr(cpu, a, bits, v);
        if (b.t === 'imm') ex = b.isAddr ? 'Carga en ' + a.name + ' la dirección de «' + b.expr + '» = ' + hx(v, 16) + '. Ojo: es un número (la dirección), no el contenido de memoria.' : (a.t === 'mem' ? 'Escribe el número ' + vs(v, bits) + ' en la memoria ' + dstDesc + '. Antes había ' + oldTxt + '.' : 'Carga el número ' + vs(v, bits) + ' en ' + a.name + '.');
        else if (b.t === 'mem') ex = 'Lee ' + (bits / 8) + ' byte' + (bits === 16 ? 's' : '') + ' de la memoria ' + memDesc(b) + ' ⇒ ' + vs(v, bits) + (bits === 8 && chr(v) ? ' [' + chr(v) + ']' : '') + ' y lo copia en ' + a.name + '.';
        else if (a.t === 'mem') ex = 'Escribe ' + b.name + ' = ' + vs(v, bits) + (bits === 8 && chr(v) ? ' [' + chr(v) + ']' : '') + ' en la memoria ' + dstDesc + '. Antes había ' + oldTxt + '.';
        else ex = 'Copia ' + b.name + ' (' + vs(v, bits) + ') en ' + a.name + '.' + (a.t === 'seg' ? '' : '');
        break;
      }
      case 'xchg': { const x = rd(cpu, a, bits), y = rd(cpu, b, bits); wr(cpu, a, bits, y); wr(cpu, b, bits, x); ex = 'Intercambia ' + opTxt(a) + ' (' + x + ') y ' + opTxt(b) + ' (' + y + ').'; break; }
      case 'add': case 'sub': {
        const x = rd(cpu, a, bits), y = rd(cpu, b, bits), r = alu(cpu, op, x, y, bits); wr(cpu, a, bits, r);
        const isPtr = a.t === 'r16' && (memName(prog, x) || memName(prog, r));
        ex = a.name + ' ← ' + x + (op === 'add' ? ' + ' : ' − ') + y + ' = ' + vs(r, bits) + (isPtr ? '. Es un puntero: ahora apunta a ' + (memName(prog, r) || hx(r, 16)) + '.' : '.') + ' Banderas: ' + flagTxt(f) + '.';
        break;
      }
      case 'inc': case 'dec': {
        const x = rd(cpu, a, bits); const cf = f.CF;
        const r = alu(cpu, op === 'inc' ? 'add' : 'sub', x, 1, bits); f.CF = cf; wr(cpu, a, bits, r);
        const isPtr = a.t === 'r16' && memName(prog, r);
        ex = opTxt(a) + ' ← ' + x + (op === 'inc' ? ' + 1' : ' − 1') + ' = ' + r + (isPtr ? '. El puntero ahora apunta a ' + memName(prog, r) + '.' : '.') + ' (INC/DEC no tocan CF).';
        break;
      }
      case 'and': case 'or': case 'xor': case 'test': {
        const x = rd(cpu, a, bits), y = rd(cpu, b, bits), r = alu(cpu, op, x, y, bits);
        const sym = { and: 'AND', test: 'AND', or: 'OR', xor: 'XOR' }[op];
        const calc = bn(x, bits) + ' ' + sym + ' ' + bn(y, bits) + ' = ' + bn(r, bits);
        if (op === 'test') ex = 'TEST hace ' + a.name + ' AND ' + y + ' pero NO guarda el resultado: ' + calc + '. ' + a.name + ' sigue valiendo ' + x + '. Solo cambian las banderas: ZF=' + f.ZF + (f.ZF ? ' (resultado 0)' : ' (resultado ≠ 0)') + '.';
        else { wr(cpu, a, bits, r); ex = opTxt(a) + ' ← ' + opTxt(a) + ' ' + sym + ' ' + y + ': ' + calc + ' = ' + r + '. ' + (op === 'and' ? 'AND DESTRUYE el valor anterior de ' + opTxt(a) + '. ' : '') + 'ZF=' + f.ZF + (f.ZF ? ' (resultado 0)' : ' (resultado ≠ 0)') + '.'; }
        break;
      }
      case 'cmp': {
        const x = rd(cpu, a, bits), y = rd(cpu, b, bits); alu(cpu, 'cmp', x, y, bits);
        const rel = x === y ? 'son IGUALES' : x > y ? x + ' > ' + y + ' (sin signo)' : x + ' < ' + y + ' (sin signo)';
        ex = 'Resta ' + x + ' − ' + y + ' sin guardar el resultado; solo actualiza banderas: ZF=' + f.ZF + ', CF=' + f.CF + '. Conclusión: ' + rel + '.';
        break;
      }
      case 'not': { const x = rd(cpu, a, bits); const r = (~x) & mask(bits); wr(cpu, a, bits, r); ex = 'Invierte todos los bits de ' + a.name + ': ' + bn(x, bits) + ' → ' + bn(r, bits) + '.'; break; }
      case 'neg': { const x = rd(cpu, a, bits); const r = alu(cpu, 'sub', 0, x, bits); wr(cpu, a, bits, r); ex = a.name + ' ← 0 − ' + x + ' = ' + r + ' (complemento a 2).'; break; }
      case 'shl': case 'shr': {
        const x = rd(cpu, a, bits); let n = b.t === 'imm' ? b.v : (cpu.regs[1] & 0xFF); n &= 31;
        let r = op === 'shl' ? (x << n) & mask(bits) : x >>> n; if (n > 0) { f.CF = op === 'shl' ? ((x >> (bits - n)) & 1) : ((x >> (n - 1)) & 1); setSZP(f, r, bits); }
        wr(cpu, a, bits, r); ex = (op === 'shl' ? 'Desplaza a la izquierda ' : 'Desplaza a la derecha ') + n + ' bit(s): ' + x + ' → ' + r + (op === 'shl' ? ' (multiplicar ×' + (1 << n) + ')' : ' (dividir ÷' + (1 << n) + ')') + '.'; break;
      }
      case 'jmp': {
        const t = a.v & 0xFFFF; next = t; taken = true;
        if (t === it.addr) { halt = 'jmp $'; ex = 'JMP $: «$» es la dirección de esta misma instrucción, así que salta a sí misma para siempre. Es la forma de "detener" el programa (bucle infinito de parada). La simulación termina aquí.'; }
        else ex = 'Salto incondicional a ' + addrTxt(prog, t) + '.';
        break;
      }
      case 'loop': {
        cpu.regs[1] = (cpu.regs[1] - 1) & 0xFFFF; const t = a.v & 0xFFFF;
        if (cpu.regs[1] !== 0) { next = t; taken = true; ex = 'LOOP: CX ← CX − 1 = ' + cpu.regs[1] + '. Como CX ≠ 0, salta a ' + addrTxt(prog, t) + ' (otra vuelta).'; }
        else { taken = false; ex = 'LOOP: CX ← CX − 1 = 0. Como CX = 0, NO salta: el ciclo terminó y sigue la instrucción siguiente.'; }
        break;
      }
      case 'jcxz': { const t = a.v & 0xFFFF; if (cpu.regs[1] === 0) { next = t; taken = true; } else taken = false; ex = 'JCXZ salta si CX = 0. CX = ' + cpu.regs[1] + ' ⇒ ' + (taken ? 'SALTA.' : 'no salta.'); break; }
      case 'nop': ex = 'No hace nada.'; break;
      case 'hlt': halt = 'hlt'; ex = 'HLT detiene el procesador.'; break;
      default: {
        const c = COND[op]; const t = a.v & 0xFFFF; taken = !!c[1](f);
        if (taken) next = t;
        ex = op.toUpperCase() + ' salta si ' + c[0] + '. Ahora ' + flagTxt(f) + ' ⇒ ' + (taken ? 'SÍ salta a ' + addrTxt(prog, t) + '.' : 'NO salta: continúa con la instrucción siguiente.');
      }
    }
    return { ex, taken, next, halt };
  }

  function run(prog, opts) {
    opts = opts || {};
    const maxSteps = opts.maxSteps || 5000;
    const cpu = { regs: new Array(8).fill(0), sregs: [0, 0, 0, 0], flags: { CF: 0, ZF: 0, SF: 0, OF: 0, PF: 0 }, mem: new Uint8Array(prog.mem), writes: [] };
    cpu.regs[4] = prog.start; // SP just below the loaded sector
    let ip = prog.start;
    const snap = (extra) => Object.assign({ regs: cpu.regs.slice(), sregs: cpu.sregs.slice(), flags: Object.assign({}, cpu.flags), mem: cpu.mem.slice(prog.start, prog.end) }, extra);
    const steps = [];
    const initial = snap({ ip });
    let halted = null;
    while (steps.length < maxSteps) {
      const it = prog.byAddr.get(ip);
      if (!it) { halted = { reason: 'noins', msg: 'IP = ' + hx(ip, 16) + ' no apunta a una instrucción (cayó en datos o relleno). Falta un «jmp $» al final del código.' }; break; }
      cpu.writes = [];
      let r;
      try { r = exec(cpu, it, prog); } catch (e) { halted = { reason: 'error', msg: e.message }; break; }
      const s = snap({ n: steps.length + 1, ip: it.addr, line: it.line, text: it.text, op: it.op, explain: r.ex, taken: r.taken, next: r.next, writes: cpu.writes.slice(), item: it });
      steps.push(s);
      if (r.halt) { halted = { reason: r.halt, msg: r.halt === 'jmp $' ? 'El programa llegó a «jmp $» (parada).' : 'HLT' }; break; }
      ip = r.next;
    }
    if (!halted) halted = { reason: 'limit', msg: 'Se alcanzó el límite de ' + maxSteps + ' pasos (¿bucle infinito? ¿CX = 0 al entrar a LOOP da 65536 vueltas).' };
    const last = steps.length ? steps[steps.length - 1] : initial;
    return { steps, initial, final: last, halted };
  }

  /* ---------------- read helpers ---------------- */
  function readLabel(prog, memArr, label) {
    // memArr is a slice from prog.start..end (snapshot.mem)
    const e = prog.extents.find(x => x.label === label);
    if (!e) return null;
    const out = [];
    const step = e.unit === 'dw' ? 2 : 1;
    for (let a = e.addr; a < e.addr + e.len; a += step) {
      const o = a - prog.start;
      out.push(step === 1 ? memArr[o] : memArr[o] | (memArr[o + 1] << 8));
    }
    return { extent: e, values: out };
  }

  function runSource(src, opts) {
    const prog = assemble(src);
    if (!prog.ok) return { prog };
    return { prog, trace: run(prog, opts) };
  }

  /* split the run into loop iterations (a taken backward jump closes one) */
  function iterations(prog, trace) {
    const its = []; let cur = [];
    for (const s of trace.steps) {
      cur.push(s);
      if (s.taken && s.next <= s.ip && s.next !== s.ip) { its.push(cur); cur = []; }
      else if ((s.op === 'loop') && s.taken === false) { its.push(cur); cur = []; }
    }
    if (cur.length) its.push(cur);
    return its;
  }

  const Emu = { assemble, run, runSource, readLabel, iterations, hx, bn, vs, chr, memName, R16N, SN, REG16, COND, evalExpr };
  if (typeof module !== 'undefined' && module.exports) module.exports = Emu;
  else root.Emu = Emu;
})(typeof window !== 'undefined' ? window : globalThis);
