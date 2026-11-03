/* Exercise generators. Every answer is computed by running the program in the emulator. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Emu = isNode ? require('./emu.js') : root.Emu;
  const Programs = isNode ? require('./programs.js') : root.Programs;
  const Content = isNode ? require('./content.js') : root.Content;

  /* ---------- random helpers ---------- */
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let uid = 0;

  const HEAD = ["format binary as 'img'", 'org 7C00h', 'mov ax, cs', 'mov ds, ax', ''];
  const TAIL = ['', 'jmp $', ''];
  const END = ['', 'times 510-($-$$) db 0', 'dw 0AA55h'];

  const INV = { jz: 'jnz', jnz: 'jz', ja: 'jbe', jbe: 'ja', jae: 'jb', jb: 'jae' };
  const TAKEN = {
    jz: (v, k, mode) => (mode === 'par' ? v % 2 === 0 : v === k), jnz: (v, k, mode) => (mode === 'par' ? v % 2 === 1 : v !== k),
    ja: (v, k) => v > k, jae: (v, k) => v >= k, jb: (v, k) => v < k, jbe: (v, k) => v <= k
  };

  /* sample n values in [lo,hi] where exactly m satisfy pred */
  function sampleData(n, m, pred, lo, hi, boundary) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const cats = shuffle(Array.from({ length: n }, (_, i) => i < m));
      const vals = cats.map(c => { for (let t = 0; t < 400; t++) { const v = ri(lo, hi); if (pred(v) === c) return v; } return null; });
      if (vals.includes(null)) continue;
      if (boundary != null) {
        const cb = pred(boundary); const idxs = cats.map((c, i) => c === cb ? i : -1).filter(i => i >= 0);
        if (idxs.length) vals[pick(idxs)] = boundary;
      }
      return vals;
    }
    throw new Error('sampleData failed');
  }

  const fmtList = a => a.map(v => String(v).padStart(2, '0')).join(', ');

  /* ---------- program generators ---------- */
  // returns {source, flipOp (line to flip), meta}
  function genFilter() {
    const useCmp = Math.random() < 0.55;
    const n = pick([6, 8, 10]);
    const step = pick([1, 2, 2]);
    const dir = pick(['fwd', 'fwd', 'bwd']);
    const fill = pick([0, 0, 1, 3, 5, 9]);
    let jop, pre = [], K = 0, mode;
    if (useCmp) { jop = pick(['ja', 'jae', 'jb', 'jbe']); K = ri(8, 30); mode = 'cmp'; pre = ['cmp al, ' + K]; }
    else { jop = pick(['jz', 'jnz']); mode = 'par'; pre = [Math.random() < 0.5 ? 'and al, 1' : 'test al, 1']; }
    const m = step === 2 ? n / 2 : ri(2, n - 2);
    const data = sampleData(n, m, v => TAKEN[jop](v, K, mode), 1, 60, useCmp && Math.random() < 0.7 ? K : null);
    const dstStart = dir === 'fwd' ? 'num2' : 'num2+' + (n - 1);
    const advance = dir === 'fwd' ? (step === 1 ? 'inc di' : 'add di, ' + step) : (step === 1 ? 'dec di' : 'sub di, ' + step);
    const body = ['mov al, [si]', ...pre, jop + ' @f'];
    if (pre[0].startsWith('and')) body.push('mov al, [si]');
    body.push('mov [di], al', advance, '@@:', 'inc si');
    const source = [...HEAD, 'mov si, num1', 'mov di, ' + dstStart, 'mov cx, ' + n, 'ciclo:', '', ...body, 'loop ciclo', ...TAIL,
      'num1 db ' + fmtList(data), 'num2 db ' + n + ' dup (' + fill + ')', ...END].join('\n');
    return { source, flip: jop + ' @f', flipTo: INV[jop] + ' @f', ask: ['num2'], ptr: [{ reg: 'si', label: 'num1' }, { reg: 'di', label: 'num2' }], family: useCmp ? 'Filtro con CMP' : 'Filtro por paridad', hint: useCmp ? "Recuerda: «cmp al,K» compara AL con K y el salto (" + jop + ") se TOMA cuando AL " + ({ ja: '>', jae: '≥', jb: '<', jbe: '≤' })[jop] + ' ' + K + ' ⇒ ese elemento NO se guarda.' : "«" + pre[0] + "» deja ZF=1 si el número es PAR. " + jop + ' salta (no guarda) con los ' + (jop === 'jz' ? 'PARES' : 'IMPARES') + '.' };
  }

  function genTwoArrays() {
    const useCmp = Math.random() < 0.5;
    const n = pick([6, 8, 10]);
    let jop, pre, K = 0, mode;
    if (useCmp) { jop = pick(['ja', 'jae', 'jb', 'jbe']); K = ri(8, 30); mode = 'cmp'; pre = ['cmp al, ' + K]; }
    else { jop = pick(['jz', 'jnz']); mode = 'par'; pre = ['test al, 1']; }
    const data = sampleData(n, n / 2, v => TAKEN[jop](v, K, mode), 1, 60, useCmp && Math.random() < 0.7 ? K : null);
    const f1 = pick([1, 3, 0, 5]); const f2 = pick([2, 4, 7, 9]);
    const source = [...HEAD, 'mov si, num1', 'mov di, num2', 'mov bx, num3', 'mov cx, ' + n, 'ciclo:', '', 'mov al, [si]', ...pre, jop + ' @f',
      'mov [di], al', 'add di, 2', 'jmp sgte', '@@:', 'mov [bx], al', 'add bx, 2', 'sgte:', 'inc si', 'loop ciclo', ...TAIL,
      'num1 db ' + fmtList(data), 'num2 db ' + n + ' dup (' + f1 + ')', 'num3 db ' + n + ' dup (' + f2 + ')', ...END].join('\n');
    return { source, flip: jop + ' @f', flipTo: INV[jop] + ' @f', ask: ['num2', 'num3'], ptr: [{ reg: 'si', label: 'num1' }, { reg: 'di', label: 'num2' }, { reg: 'bx', label: 'num3' }], family: 'Dos arreglos destino', hint: 'Si el salto (' + jop + ') NO se toma, el elemento va a num2 (DI); si se toma, va a num3 (BX). Cada uno avanza de 2 en 2.' };
  }

  const CLS = { upper: ['A', 'Z'], lower: ['a', 'z'], digit: ['0', '9'] };
  const clsName = { upper: 'mayúsculas', lower: 'minúsculas', digit: 'dígitos' };
  const randCh = c => { const lo = CLS[c][0].charCodeAt(0), hi = CLS[c][1].charCodeAt(0); return String.fromCharCode(ri(lo, hi)); };
  function genChars() {
    const n = ri(8, 12); const cls = pick(['upper', 'lower', 'digit']); const others = Object.keys(CLS).filter(c => c !== cls);
    const mode = pick(['posfwd', 'posbwd', 'compact']);
    let s = '';
    for (let i = 0; i < n; i++) s += Math.random() < 0.5 ? randCh(cls) : randCh(pick(others));
    const inCls = ch => ch >= CLS[cls][0] && ch <= CLS[cls][1];
    const cnt = [...s].filter(inCls).length; if (cnt < 2 || cnt > n - 2) return genChars();
    let s2 = ''; for (let i = 0; i < n; i++) s2 += randCh(pick(Object.keys(CLS)));
    const [lo, hi] = CLS[cls];
    const start = mode === 'posbwd' ? 'cadena2+' + (n - 1) : 'cadena2';
    const tail = mode === 'posfwd' ? ['inc si', 'inc di'] : mode === 'posbwd' ? ['inc si', 'dec di'] : ['inc si'];
    const store = mode === 'compact' ? ['mov [di], al', 'inc di'] : ['mov [di], al'];
    const source = [...HEAD, 'mov si, cadena', 'mov di, ' + start, 'mov cx, ' + n, 'ciclo:', '', 'mov al, [si]', "cmp al, '" + lo + "'", 'jb @f', "cmp al, '" + hi + "'", 'ja @f', ...store, '@@:', ...tail, 'loop ciclo', ...TAIL,
      "cadena db '" + s + "'", "cadena2 db '" + s2 + "'", ...END].join('\n');
    const other = pick(others); const [lo2, hi2] = CLS[other];
    return { source, replacements: [["cmp al, '" + lo + "'", "cmp al, '" + lo2 + "'"], ["cmp al, '" + hi + "'", "cmp al, '" + hi2 + "'"]], flipLabel: "'" + lo + "' y '" + hi + "'  →  '" + lo2 + "' y '" + hi2 + "'", ask: ['cadena2'], text: true, ptr: [{ reg: 'si', label: 'cadena' }, { reg: 'di', label: 'cadena2' }], family: 'Filtro de caracteres (' + clsName[cls] + ')', hint: "Los dos CMP forman un rango: lo que sea menor que '" + lo + "' o mayor que '" + hi + "' salta y se descarta. Los códigos ASCII: '0'=30h, 'A'=41h, 'a'=61h." + (mode === 'compact' ? ' DI avanza SOLO cuando se guarda (los guardados quedan consecutivos).' : mode === 'posfwd' ? ' DI avanza en TODAS las vueltas: cada carácter conserva su posición.' : ' DI retrocede en TODAS las vueltas: el resultado queda al revés.') };
  }

  function genStride() {
    const k = pick([2, 3]); const c = pick([3, 4]); const N = k * c; const dir = pick(['bwd', 'bwd', 'fwd']);
    const useTest = Math.random() < 0.5; const jop = pick(['jz', 'jnz']);
    const data = Array.from({ length: N }, () => ri(1, 60));
    const fill = pick([0, 0, 1, 7]);
    const pre = [useTest ? 'test al, 1' : 'and al, 1'];
    const setup = dir === 'bwd' ? ['mov si, num1+' + (N - 1), 'mov di, num2', 'mov cx, ' + c] : ['mov si, num1', 'mov di, num2', 'mov cx, ' + c];
    const body = ['mov al, [si]', ...pre, jop + ' @f'];
    if (!useTest) body.push('mov al, [si]');
    body.push('mov [di], al', 'inc di', '@@:', (dir === 'bwd' ? 'sub si, ' : 'add si, ') + k);
    const source = [...HEAD, ...setup, 'ciclo:', '', ...body, 'loop ciclo', ...TAIL, 'num1 db ' + fmtList(data), 'num2 db ' + c + ' dup (' + fill + ')', ...END].join('\n');
    return { source, flip: jop + ' @f', flipTo: INV[jop] + ' @f', ask: ['num2'], ptr: [{ reg: 'si', label: 'num1' }, { reg: 'di', label: 'num2' }], family: 'Recorrido de ' + k + ' en ' + k, hint: 'SI no avanza de 1 en 1 sino de ' + k + ' en ' + k + (dir === 'bwd' ? ', empezando por el ÚLTIMO elemento' : '') + '. Solo se leen ' + c + ' elementos (CX = ' + c + ').' };
  }

  function genUpper() {
    const n = ri(7, 10); let s = '';
    for (let i = 0; i < n; i++) s += randCh(pick(['lower', 'lower', 'upper', 'digit']));
    if (!/[a-z]/.test(s)) return genUpper();
    let s2 = ''; for (let i = 0; i < n; i++) s2 += '.';
    const source = [...HEAD, 'mov si, cadena', 'mov di, cadena2', 'mov cx, ' + n, 'ciclo:', '', 'mov al, [si]', "cmp al, 'a'", 'jb @f', "cmp al, 'z'", 'ja @f', 'sub al, 20h', '@@:', 'mov [di], al', 'inc si', 'inc di', 'loop ciclo', ...TAIL,
      "cadena db '" + s + "'", "cadena2 db '" + s2 + "'", ...END].join('\n');
    return { source, replacements: [["cmp al, 'a'", "cmp al, 'A'"], ["cmp al, 'z'", "cmp al, 'Z'"], ['sub al, 20h', 'add al, 20h']], flipLabel: "'a','z' y sub al,20h  →  'A','Z' y add al,20h", ask: ['cadena2'], text: true, ptr: [{ reg: 'si', label: 'cadena' }, { reg: 'di', label: 'cadena2' }], family: 'Extra: convertir a mayúsculas', hint: "Una minúscula se convierte en mayúscula restando 20h ('a'=61h → 'A'=41h). Aquí TODOS los caracteres se copian; solo cambian las minúsculas." };
  }

  function genAccum() {
    for (let t = 0; t < 50; t++) {
      const n = ri(5, 7); const K = ri(8, 25); const jop = pick(['jbe', 'jb', 'ja', 'jae']);
      const data = Array.from({ length: n }, () => ri(1, 40));
      const taken = v => TAKEN[jop](v, K);
      const sum = data.filter(v => !taken(v)).reduce((s, v) => s + v, 0);
      if (sum > 255 || sum === 0) continue;
      const source = [...HEAD, 'mov si, num1', 'mov cx, ' + n, 'mov bl, 0', 'mov dl, 0', 'ciclo:', '', 'mov al, [si]', 'cmp al, ' + K, jop + ' @f', 'add bl, al', 'inc dl', '@@:', 'inc si', 'loop ciclo', ...TAIL, 'num1 db ' + fmtList(data), ...END].join('\n');
      return { source, flip: jop + ' @f', flipTo: INV[jop] + ' @f', ask: [], regs: ['BL', 'DL'], ptr: [{ reg: 'si', label: 'num1' }], family: 'Extra: suma y cuenta en registros', hint: 'BL acumula la SUMA de los elementos que NO saltan y DL cuenta cuántos son. No se usa memoria destino.' };
    }
    return genAccum();
  }

  const GENS = { filter: genFilter, two: genTwoArrays, chars: genChars, stride: genStride, upper: genUpper, accum: genAccum };
  const CORE = ['filter', 'filter', 'two', 'chars', 'stride'];

  /* build + validate: every memory write must stay inside the destination arrays (also in the variant) */
  function runProg(src) {
    const r = Emu.runSource(src);
    if (!r.prog.ok) throw new Error('Generated program failed to assemble: ' + r.prog.error + '\n' + src);
    return r;
  }
  function writesInside(r) {
    const ext = r.prog.extents;
    for (const s of r.trace.steps) for (const w of s.writes) { if (!ext.some(e => w.addr >= e.addr && w.addr < e.addr + e.len)) return false; }
    return true;
  }
  function variantSource(g) {
    if (g.flip) { return Programs.applyVariant(g.source, { replace: [[g.flip, g.flipTo]] }); }
    return Programs.applyVariant(g.source, { replace: g.replacements });
  }
  function results(r, g) {
    const out = {};
    for (const lab of g.ask) {
      const v = Emu.readLabel(r.prog, r.trace.final.mem, lab).values;
      out[lab] = g.text ? String.fromCharCode(...v) : v;
    }
    if (g.regs) { const rr = r.trace.final.regs; out.BL = rr[3] & 0xFF; out.DL = (rr[2]) & 0xFF; }
    return out;
  }
  function genProgram(kind) {
    for (let t = 0; t < 60; t++) {
      const g = GENS[kind || pick(CORE)]();
      const r = runProg(g.source);
      if (r.trace.halted.reason !== 'jmp $' || !writesInside(r)) continue;
      const vSrc = variantSource(g); const vr = runProg(vSrc);
      if (vr.trace.halted.reason !== 'jmp $' || !writesInside(vr)) continue;
      const res = results(r, g), vres = results(vr, g);
      if (JSON.stringify(res) === JSON.stringify(vres)) continue; // the variant must change something
      g.run = r; g.res = res; g.variantSource = vSrc; g.vres = vres; g.vrun = vr;
      g.variantLabel = g.flipLabel || (g.flip + '  →  ' + g.flipTo);
      return g;
    }
    throw new Error('could not generate a valid program');
  }

  /* ---------- exercise builders ---------- */
  function exPredict(kind) {
    const g = genProgram(kind);
    return { id: ++uid, cat: 'pred', type: 'predict', title: g.family, prompt: g.regs ? '¿Qué valor tienen BL y DL cuando el programa llega a «jmp $»?' : '¿Qué se almacena en ' + g.ask.join(' y ') + ' al terminar el programa?', code: g.source, asks: g.ask, regs: g.regs, text: !!g.text, answer: g.res, hint: g.hint, runSource: g.source, ptr: g.ptr };
  }
  function exWhat(kind) {
    const g = genProgram(kind);
    return { id: ++uid, cat: 'what', type: 'predict', title: g.family + ' — ¿qué pasa si…?', prompt: g.regs ? '¿Qué valor tendrían BL y DL si ' + g.variantLabel + '?' : '¿Qué se almacenaría en ' + g.ask.join(' y ') + ' si ' + (g.flip ? 'en lugar de «' + g.flip + '» fuera «' + g.flipTo + '»' : 'se cambiara ' + g.variantLabel) + '?', code: g.source, asks: g.ask, regs: g.regs, text: !!g.text, answer: g.vres, hint: 'Primero decide qué cambia en el criterio de filtrado (¿qué elementos antes se guardaban y ahora no, y al revés?). Luego traza. ' + g.hint, runSource: g.variantSource, original: g.source, ptr: g.ptr };
  }
  function exJump() {
    for (let t = 0; t < 60; t++) {
      const g = genProgram(pick(['filter', 'filter', 'two']));
      if (!g.flip) continue;
      const op = g.flip.split(' ')[0];
      const cands = (op === 'jz' || op === 'jnz') ? ['jz', 'jnz'] : ['ja', 'jae', 'jb', 'jbe'];
      const masked = g.source.replace(g.flip, '??? @f');
      const matches = cands.filter(c => {
        const r = runProg(g.source.replace(g.flip, c + ' @f')); if (r.trace.halted.reason !== 'jmp $' || !writesInside(r)) return false;
        return JSON.stringify(results(r, g)) === JSON.stringify(g.res);
      });
      if (matches.length !== 1) continue;
      const shown = g.ask.map(l => l + ' = ' + (g.text ? "'" + g.res[l] + "'" : '[' + g.res[l].join(', ') + ']')).join('\n');
      return { id: ++uid, cat: 'jump', type: 'mcq', title: '¿Qué salto falta?', prompt: 'Al ejecutar este programa con el salto condicional correcto («???») quedan estos valores:\n' + shown + '\n¿Cuál es la instrucción que falta?', code: masked, opts: cands.map(c => c + ' @f'), ans: cands.indexOf(matches[0]), why: 'Probando cada salto en el emulador, solo «' + matches[0] + ' @f» produce exactamente ese resultado.', runSource: g.source };
    }
    return exJump();
  }

  const BANK = Content.MCQ;
  function exConcept(tags) {
    const pool = BANK.filter(q => !tags || tags.includes(q.tag));
    const q = pick(pool);
    const order = shuffle(q.o.map((t, i) => ({ t, i })));
    return { id: ++uid, cat: 'dir', type: 'mcq', title: q.tag === 'a' ? 'Pregunta a) — directivas' : q.tag === 'b' ? 'Pregunta b) — instrucciones' : q.tag === 'c' ? 'Pregunta c) — resultado' : 'Pregunta d) — variaciones', prompt: q.q, opts: order.map(o => o.t), ans: order.findIndex(o => o.i === q.a), why: q.w, bankRef: q };
  }

  function allPrograms() {
    const pool = Programs.EXAMS.map(e => e.source);
    for (let i = 0; i < 2; i++) { try { pool.push(genProgram().source); } catch (e) { /* ignore */ } }
    return pool;
  }
  let TITLE_CACHE = null;
  function titlePool() {
    if (TITLE_CACHE) return TITLE_CACHE;
    const set = new Map();
    for (const e of Programs.EXAMS) { const ls = e.source.split('\n'); ls.forEach((l, i) => { if (!l.trim()) return; const [ti, tx] = Content.explainLine(ls, i); if (ti && !set.has(ti)) set.set(ti, tx); }); }
    TITLE_CACHE = [...set.entries()].map(([title, text]) => ({ title, text })); return TITLE_CACHE;
  }
  function exInstr(src, lineIdx) {
    const pool = titlePool();
    let source = src, ls, idx, ti, tx;
    for (let t = 0; t < 40; t++) {
      source = src || pick(allPrograms()); ls = source.split('\n');
      const cands = ls.map((l, i) => i).filter(i => ls[i].trim() && !/^(format|org)/i.test(ls[i].trim()) && Content.explainLine(ls, i)[0]);
      idx = lineIdx != null ? lineIdx : pick(cands); [ti, tx] = Content.explainLine(ls, idx);
      if (ti) break;
    }
    const wrong = shuffle(pool.filter(p => p.title !== ti)).slice(0, 3);
    const opts = shuffle([{ t: ti, ok: true }, ...wrong.map(w => ({ t: w.title, ok: false }))]);
    return { id: ++uid, cat: 'instr', type: 'mcq', title: 'Pregunta b) — explica la instrucción subrayada', prompt: 'En este programa, ¿qué función tiene la línea subrayada:  ' + ls[idx].trim() + '  ?', code: source, mark: idx, opts: opts.map(o => o.t), ans: opts.findIndex(o => o.ok), why: tx };
  }

  /* ---------- number systems ---------- */
  const hexS = v => v.toString(16).toUpperCase();
  const withH = s => (/^[A-F]/.test(s) ? '0' + s : s) + 'h';
  function parseIn(s, base) {
    s = String(s).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return NaN;
    if (base === 16) { s = s.replace(/^0x/, '').replace(/h$/, ''); return /^[0-9a-f]+$/.test(s) ? parseInt(s, 16) : NaN; }
    if (base === 2) { s = s.replace(/b$/, ''); return /^[01]+$/.test(s) ? parseInt(s, 2) : NaN; }
    return /^-?\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }
  function exNumeric() {
    const kind = pick(['h2d', 'h2d', 'b2d', 'd2h', 'd2b', 'b2h', 'h2b']);
    const word = Math.random() < 0.25 && (kind === 'h2d' || kind === 'd2h');
    const v = word ? ri(256, 4095) : ri(10, 255);
    const bits8 = v.toString(2).padStart(8, '0');
    const bshort = v.toString(2);
    switch (kind) {
      case 'h2d': return numQ('Convierte a decimal: ' + withH(hexS(v)), String(v), 10, 'Multiplica cada dígito hex por 16^posición y suma: ' + hexS(v).split('').map((d, i, a) => d + '×' + Math.pow(16, a.length - 1 - i)).join(' + ') + ' = ' + v + '.');
      case 'b2d': return numQ('Convierte a decimal: ' + bshort + 'b', String(v), 10, 'Suma las potencias de 2 donde hay un 1: ' + bshort.split('').map((d, i, a) => d === '1' ? Math.pow(2, a.length - 1 - i) : null).filter(x => x !== null).join(' + ') + ' = ' + v + '.');
      case 'd2h': return numQ('Convierte a hexadecimal: ' + v + ' (responde p. ej. 3Ah)', hexS(v), 16, 'Divide entre 16 sucesivamente y toma los restos al revés: ' + v + ' = ' + hexS(v) + 'h.');
      case 'd2b': return numQ('Convierte a binario: ' + v + ' (responde con 0 y 1)', bshort, 2, 'Divide entre 2 sucesivamente (restos al revés) o resta potencias de 2: ' + v + ' = ' + bshort + 'b.');
      case 'b2h': return numQ('Convierte a hexadecimal: ' + bits8 + 'b', hexS(v), 16, 'Separa en grupos de 4 bits: ' + bits8.slice(0, 4) + ' ' + bits8.slice(4) + ' → ' + hexS(parseInt(bits8.slice(0, 4), 2)) + ' ' + hexS(parseInt(bits8.slice(4), 2)) + ' = ' + hexS(v) + 'h.');
      default: return numQ('Convierte a binario: ' + withH(hexS(v)) + ' (8 bits)', bits8, 2, 'Cada dígito hex son 4 bits: ' + hexS(v).padStart(2, '0').split('').map(d => parseInt(d, 16).toString(2).padStart(4, '0')).join(' ') + '.');
    }
  }
  function numQ(prompt, ans, base, why) { return { id: ++uid, cat: 'num', type: 'numeric', title: 'Sistemas numéricos', prompt, answer: ans, base, why }; }

  function exTF() {
    const kind = pick(['hd', 'bd', 'bh', 'fit', 'reg', 'hb']);
    const truth = Math.random() < 0.5; const v = ri(20, 250); let st, why;
    const off = () => v + pick([-12, -9, -6, -1, 1, 5, 11, 16]);
    switch (kind) {
      case 'hd': { const shown = truth ? v : off(); st = 'El número ' + withH(hexS(v)) + ' equivale al número decimal ' + shown + '.'; why = withH(hexS(v)) + ' = ' + v + ' en decimal' + (truth ? '.' : ', no ' + shown + '.'); break; }
      case 'bd': { const shown = truth ? v : off(); st = 'El número ' + v.toString(2) + 'b es el ' + shown + ' en decimal.'; why = v.toString(2) + 'b = ' + v + ' en decimal' + (truth ? '.' : ', no ' + shown + '.'); break; }
      case 'bh': { const shown = truth ? v : Math.max(1, off()); st = 'El número ' + v.toString(2) + 'b equivale al número ' + withH(hexS(shown)) + '.'; why = v.toString(2) + 'b = ' + withH(hexS(v)) + (truth ? '.' : ', no ' + withH(hexS(shown)) + '.'); break; }
      case 'fit': { const val = truth ? ri(256, 4000) : ri(10, 255); st = withH(hexS(val)) + ' necesita un registro mayor de un byte.'; why = withH(hexS(val)) + ' = ' + val + (val > 255 ? ' > 255 (FFh): no cabe en 8 bits, necesita 2 bytes.' : ' ≤ 255 (FFh): cabe en 1 byte.'); break; }
      case 'reg': { const val = truth ? ri(256, 400) : ri(1, 255); st = 'No es posible que BL sea igual a ' + val + '.'; why = 'BL es de 8 bits: solo admite 0..255. ' + val + (val > 255 ? ' no cabe ⇒ es imposible (verdadero).' : ' sí cabe ⇒ sí es posible (falso).'); break; }
      default: { const shown = truth ? v : off(); st = 'El número ' + withH(hexS(v)) + ' equivale al número binario ' + shown.toString(2) + 'b.'; why = withH(hexS(v)) + ' = ' + v.toString(2) + 'b' + (truth ? '.' : ', no ' + shown.toString(2) + 'b.'); }
    }
    return { id: ++uid, cat: 'num', type: 'mcq', title: 'Verdadero o falso (sistemas numéricos)', prompt: st, opts: ['Verdadero', 'Falso'], ans: truth ? 0 : 1, why };
  }
  function exAscii() {
    const k = pick([0, 1, 2, 3]);
    if (k === 0) { const c = pick([...'AEIMRZaemrz05279']); return numQ("¿Cuál es el código ASCII (en hexadecimal) del carácter '" + c + "'?", hexS(c.charCodeAt(0)), 16, "'" + c + "' = " + withH(hexS(c.charCodeAt(0))) + '. Recuerda: dígitos 30h, mayúsculas 41h, minúsculas 61h.'); }
    if (k === 1) { const c = pick([...'ABCDEFGHXYZ']); return numQ("¿Qué código (hex) tiene la MINÚSCULA de '" + c + "'? (pista: mayúscula + 20h)", hexS(c.toLowerCase().charCodeAt(0)), 16, "'" + c + "' = " + hexS(c.charCodeAt(0)) + 'h; la minúscula suma 20h ⇒ ' + hexS(c.toLowerCase().charCodeAt(0)) + 'h.'); }
    if (k === 2) { const c = ri(0, 9); return numQ("¿Qué código ASCII (decimal) tiene el carácter '" + c + "'?", String(48 + c), 10, "'0' = 30h = 48; el dígito d vale 48 + d."); }
    const c = pick([...'abcdefghijklmnopqrstuvwxyz']); return numQ("¿Cuántos caracteres hay desde 'a' hasta '" + c + "' contando ambos extremos?", String(c.charCodeAt(0) - 96), 10, "'" + c + "' − 'a' + 1 = " + (c.charCodeAt(0) - 96) + '.');
  }

  /* ---------- trace table ---------- */
  function exTrace() {
    for (let t = 0; t < 40; t++) {
      const g = genProgram(pick(['filter', 'two', 'chars', 'stride']));
      const r = g.run; const its = Emu.iterations(r.prog, r.trace).filter(it => it.some(s => s.op === 'loop'));
      if (its.length < 3) continue;
      const rows = its.slice(0, Math.min(its.length, 5));
      const regIdx = { si: 6, di: 7, bx: 3 };
      const cols = [{ key: 'al', label: 'AL (valor leído)' }, { key: 'stored', label: '¿Se guardó el elemento?', yn: true }];
      for (const p of g.ptr) cols.push({ key: p.reg, label: p.reg.toUpperCase() + ' al final de la vuelta (índice en ' + p.label + ')' });
      cols.push({ key: 'cx', label: 'CX al final' });
      const labelAddr = lab => r.prog.labels.get(lab);
      const data = rows.map(it => {
        const row = {};
        const rd = it.find(s => /^mov al, \[si\]/i.test(s.text)); row.al = String(rd.regs[0] & 0xFF);
        row.stored = it.some(s => s.writes.length > 0) ? 'Sí' : 'No';
        const last = it[it.length - 1];
        for (const p of g.ptr) row[p.reg] = String(last.regs[regIdx[p.reg]] - labelAddr(p.label));
        row.cx = String(last.regs[1]);
        return row;
      });
      if (g.text) data.forEach(row => { row.al = String.fromCharCode(+row.al); });
      return { id: ++uid, cat: 'trace', type: 'trace', title: 'Traceo por vueltas del ciclo', prompt: 'Completa la tabla de traceo de las primeras ' + rows.length + ' vueltas del ciclo.' + (g.text ? ' (AL: escribe el carácter.)' : '') + ' Los punteros se piden como ÍNDICE desde el comienzo del arreglo (0 = primer elemento).', code: g.source, cols, rows: data, hint: g.hint, runSource: g.source, text: !!g.text };
    }
    return exTrace();
  }

  /* ---------- registers/counting questions ---------- */
  function exCount() {
    const g = genProgram(pick(['filter', 'two', 'chars', 'stride']));
    const r = g.run; const writes = r.trace.steps.filter(s => s.writes.length > 0).length;
    const q = pick(['writes', 'si', 'iters']);
    const regs = r.trace.final.regs; const lastStep = r.trace.final;
    const siLab = g.ptr[0].label; const siIdx = regs[6] - r.prog.labels.get(siLab);
    const iters = Emu.iterations(r.prog, r.trace).filter(it => it.some(s => s.op === 'loop')).length;
    if (q === 'writes') return { id: ++uid, cat: 'trace', type: 'numeric', title: 'Contar escrituras', prompt: '¿Cuántas veces se ejecuta la instrucción «mov [di], al»' + (g.ask.length > 1 ? ' (o «mov [bx], al»), en total' : '') + ' durante todo el programa?', code: g.source, answer: String(writes), base: 10, why: 'Se cuentan los elementos que no se descartan: ' + writes + '.' };
    if (q === 'si') return { id: ++uid, cat: 'trace', type: 'numeric', title: 'Valor final de SI', prompt: '¿Qué valor (decimal) tiene SI − ' + siLab + ' (el desplazamiento de SI desde el comienzo de «' + siLab + '») cuando el programa llega a jmp $?' + (siIdx < 0 ? ' (puede ser negativo: SI puede quedar antes del comienzo del arreglo)' : ''), code: g.source, answer: String(siIdx), base: 10, why: 'SI se movió en cada vuelta; al final apunta a ' + siLab + (siIdx >= 0 ? '+' : '') + siIdx + '.' };
    return { id: ++uid, cat: 'trace', type: 'numeric', title: 'Vueltas del ciclo', prompt: '¿Cuántas veces se ejecuta el cuerpo del ciclo (cuántas vueltas da LOOP)?', code: g.source, answer: String(iters), base: 10, why: 'Es el valor inicial de CX: ' + iters + '.' };
  }

  /* ---------- public API ---------- */
  const MAKERS = {
    num: () => pick([exNumeric, exNumeric, exTF, exAscii])(),
    dir: () => exConcept(),
    instr: () => exInstr(),
    pred: () => exPredict(),
    what: () => exWhat(),
    trace: () => (Math.random() < 0.6 ? exTrace() : exCount()),
    jump: () => exJump(),
    extra: () => (Math.random() < 0.5 ? (Math.random() < 0.5 ? exPredict('upper') : exWhat('upper')) : (Math.random() < 0.5 ? exPredict('accum') : exWhat('accum')))
  };
  function make(cat) { return MAKERS[cat](); }

  /* full simulated question 3 */
  function makeSimulacro() {
    const g = genProgram(pick(['filter', 'two', 'chars', 'stride']));
    const ls = g.source.split('\n');
    const candidates = ls.map((l, i) => i).filter(i => ls[i].trim() && !/^(format|mov ax|mov ds)/i.test(ls[i].trim()) && Content.explainLine(ls, i)[0] && !/^times|^dw 0AA55h|^org/i.test(ls[i].trim()));
    const marked = shuffle(candidates).slice(0, 4).sort((a, b) => a - b);
    const allTitles = titlePool();
    const parts = marked.map(i => {
      const [ti, tx] = Content.explainLine(ls, i);
      const wrong = shuffle(allTitles.filter(p => p.title !== ti)).slice(0, 3);
      const opts = shuffle([{ t: ti, ok: true }, ...wrong.map(w => ({ t: w.title, ok: false }))]);
      return { line: i, opts: opts.map(o => o.t), ans: opts.findIndex(o => o.ok), why: tx };
    });
    const directive = pick([
      { stmt: 'org 7C00h', q: Content.MCQ[0] }, { stmt: 'times 510-($-$$) db 0', q: Content.MCQ[1] }, { stmt: 'dw 0AA55h', q: Content.MCQ[2] }]);
    const order = shuffle(directive.q.o.map((t, i) => ({ t, i })));
    return { id: ++uid, g, code: g.source, marked, parts,
      a: { prompt: '¿Para qué se utiliza la instrucción «' + directive.stmt + '»?', opts: order.map(o => o.t), ans: order.findIndex(o => o.i === directive.q.a), why: directive.q.w },
      c: { asks: g.ask, text: !!g.text, answer: g.res, regs: g.regs },
      d: { prompt: g.flip ? '¿Qué se almacenaría si en lugar de «' + g.flip + '» fuera «' + g.flipTo + '»?' : '¿Qué se almacenaría si ' + g.variantLabel + '?', asks: g.ask, text: !!g.text, answer: g.vres, regs: g.regs, runSource: g.variantSource } };
  }

  /* answer parsing / checking */
  function parseList(str, text, n) {
    if (text) return str.replace(/^['"]|['"]$/g, '');
    const toks = str.trim().split(/[\s,;]+/).filter(Boolean);
    return toks.map(t => { t = t.toLowerCase(); if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t, 16); if (/^[0-9a-f]+h$/.test(t)) return parseInt(t.slice(0, -1), 16); if (/^[01]+b$/.test(t)) return parseInt(t.slice(0, -1), 2); return /^-?\d+$/.test(t) ? parseInt(t, 10) : NaN; });
  }
  function checkList(user, expected, text) {
    if (text) return { ok: user === expected, cells: [...expected].map((c, i) => user[i] === c) };
    const cells = expected.map((v, i) => user[i] === v);
    return { ok: user.length === expected.length && cells.every(Boolean), cells };
  }

  const Ex = { make, makeSimulacro, genProgram, parseIn, parseList, checkList, exInstr, exConcept, MAKERS, pick, shuffle, ri };
  if (isNode) module.exports = Ex; else root.Ex = Ex;
})(typeof window !== 'undefined' ? window : globalThis);
