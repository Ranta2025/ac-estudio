/* More question-3 exercises: code completion, instruction-by-instruction tracing, partial state,
 * jump counting, true/false, flags & registers, addresses & sizes. Answers always come from the emulator
 * (or exact arithmetic checked in tests).
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Emu = isNode ? require('./emu.js') : root.Emu;
  const Content = isNode ? require('./content.js') : root.Content;
  const Ex = isNode ? require('./exercises.js') : root.Ex;
  const { genProgram, runProg, results, pick, shuffle, ri } = Ex;
  let uid = 5000;
  const uniq = a => [...new Set(a)];

  /* ================= code completion ================= */
  function slotCands(line) {
    const t = line.trim(); let m;
    if ((m = /^mov cx, (\d+)$/.exec(t))) { const n = +m[1]; return { kind: 'count', cands: uniq([n, n - 1, n + 1, n * 2]).filter(x => x > 0).map(x => 'mov cx, ' + x) }; }
    if ((m = /^mov (si|di|bx), ([A-Za-z][A-Za-z0-9]*)(?:\+(\d+))?$/.exec(t))) {
      const off = +(m[3] || 0); const offs = uniq([off, off + 1, off > 0 ? off - 1 : 0, 0, off + 2]).filter(x => x >= 0);
      return { kind: 'init-' + m[1], cands: offs.map(o => 'mov ' + m[1] + ', ' + m[2] + (o ? '+' + o : '')) };
    }
    if ((m = /^(inc|dec) (si|di|bx)$/.exec(t))) { const o = m[1] === 'inc' ? 'dec' : 'inc'; const r = m[2]; return { kind: 'adv-' + r, cands: [t, o + ' ' + r, (m[1] === 'inc' ? 'add ' : 'sub ') + r + ', 2', (m[1] === 'inc' ? 'sub ' : 'add ') + r + ', 2'] }; }
    if ((m = /^(add|sub) (si|di|bx), (\d+)$/.exec(t))) {
      const n = +m[3], o = m[1] === 'add' ? 'sub' : 'add'; const r = m[2];
      return { kind: 'adv-' + r, cands: uniq([t, o + ' ' + r + ', ' + n, m[1] + ' ' + r + ', ' + (n + 1), n > 1 ? m[1] + ' ' + r + ', ' + (n - 1) : (m[1] === 'add' ? 'inc ' : 'dec ') + r]) };
    }
    if ((m = /^(jz|jnz) @f$/.exec(t))) return { kind: 'jump', cands: ['jz @f', 'jnz @f', 'ja @f', 'jb @f'] };
    if ((m = /^(ja|jae|jb|jbe) @f$/.exec(t))) return { kind: 'jump', cands: ['ja @f', 'jae @f', 'jb @f', 'jbe @f'] };
    if ((m = /^(and|test) al, 1$/.exec(t))) return { kind: 'bit', cands: ['and al, 1', 'test al, 1', 'and al, 0', 'or al, 1'] };
    if ((m = /^cmp al, (\d+)$/.exec(t))) { const k = +m[1]; return { kind: 'cmpK', cands: uniq([k, k + 1, k - 1, k + 3]).filter(x => x > 0).map(x => 'cmp al, ' + x) }; }
    if ((m = /^cmp al, '(.)'$/.exec(t))) return { kind: 'cmpC', cands: [t, ...shuffle(['A', 'Z', 'a', 'z', '0', '9'].filter(c => c !== m[1]).map(c => "cmp al, '" + c + "'")).slice(0, 3)] };
    if (/^mov \[(di|bx)\], al$/.test(t)) { const r = /\[(\w+)\]/.exec(t)[1]; return { kind: 'store', cands: [t, 'mov [' + (r === 'di' ? 'bx' : 'di') + '], al', 'mov [si], al', 'mov al, [' + r + ']'] }; }
    if (/^sub al, 20h$/.test(t)) return { kind: 'case', cands: ['sub al, 20h', 'add al, 20h', 'and al, 20h', 'or al, 20h'] };
    return null;
  }

  function exFillCode() {
    for (let attempt = 0; attempt < 80; attempt++) {
      const g = genProgram(pick(['filter', 'filter', 'two', 'chars', 'stride', 'upper']));
      const lines = g.source.split('\n');
      const byKind = {};
      lines.forEach((l, i) => { const sc = slotCands(l); if (sc) (byKind[sc.kind] = byKind[sc.kind] || []).push(i); });
      const kinds = shuffle(Object.keys(byKind)); const want = ri(2, 3); const chosen = [];
      for (const k of kinds) { if (chosen.length >= want) break; chosen.push(pick(byKind[k])); }
      if (chosen.length < 2) continue;
      chosen.sort((a, b) => a - b);
      const slots = []; let ok = true;
      for (const i of chosen) {
        const orig = lines[i].trim(); const { cands } = slotCands(lines[i]);
        const wrong = [];
        for (const c of cands) {
          if (c === orig || wrong.includes(c)) continue;
          const mod = lines.slice(); mod[i] = c;
          try { const r = runProg(mod.join('\n')); if (r.trace.halted.reason === 'jmp $' && JSON.stringify(results(r, g)) === JSON.stringify(g.res)) continue; } catch (e) { continue; }
          wrong.push(c);
        }
        if (wrong.length < 2) { ok = false; break; }
        const opts = shuffle([orig, ...shuffle(wrong).slice(0, 3)]);
        slots.push({ line: i, orig, opts, ans: opts.indexOf(orig), why: Content.explainLine(lines, i) });
      }
      if (!ok) continue;
      const blanked = lines.slice(); slots.forEach((s, k) => { blanked[s.line] = '________   ; (' + (k + 1) + ')'; });
      const verify = choices => {
        const mod = lines.slice(); slots.forEach((s, k) => { mod[s.line] = s.opts[choices[k]]; });
        try { const r = runProg(mod.join('\n')); return r.trace.halted.reason === 'jmp $' && JSON.stringify(results(r, g)) === JSON.stringify(g.res); } catch (e) { return false; }
      };
      return { id: ++uid, cat: 'fill', type: 'fill', title: 'Completa el código', prompt: 'Elige la instrucción correcta para cada espacio en blanco, de modo que el programa cumpla este objetivo:\n«' + g.goal + '»', code: blanked.join('\n'), full: g.source, slots, verify, hint: g.hint, runSource: g.source };
    }
    return exFillCode();
  }

  /* ================= instruction-by-instruction trace ================= */
  const FLAG_OPS = new Set(['cmp', 'test', 'and', 'or', 'xor', 'add', 'sub', 'inc', 'dec', 'neg', 'shl', 'shr']);
  function exTraceStep() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = genProgram(pick(['filter', 'two', 'chars', 'stride']));
      const r = g.run; const steps = r.trace.steps;
      const first = steps.findIndex(s => /^mov al, \[si\]/i.test(s.text));
      const N = Math.min(steps.length, first + ri(11, 14));
      const regIdx = { si: 6, di: 7, bx: 3 };
      const cols = [{ key: 'al', label: 'AL' }, ...g.ptr.map(p => ({ key: p.reg, label: p.reg.toUpperCase() + ' (índice en ' + p.label + ')' })), { key: 'cx', label: 'CX' }, { key: 'zf', label: 'ZF' }, { key: 'cf', label: 'CF' }];
      const alStr = v => (g.text && v >= 32 ? String.fromCharCode(v) : String(v));
      let prev = r.trace.initial; let flagsSeen = false; const rows = [];
      for (let k = 0; k < N; k++) {
        const s = steps[k]; const cells = {};
        const flagOp = FLAG_OPS.has(s.op);
        if (flagOp) flagsSeen = true;
        cells.al = { v: alStr(s.regs[0] & 0xFF), ask: (s.regs[0] & 0xFF) !== (prev.regs[0] & 0xFF) };
        for (const p of g.ptr) { const v = s.regs[regIdx[p.reg]], pv = prev.regs[regIdx[p.reg]]; cells[p.reg] = v === 0 ? { v: '—', ask: false } : { v: String(v - r.prog.labels.get(p.label)), ask: v !== pv }; }
        cells.cx = { v: String(s.regs[1]), ask: s.regs[1] !== prev.regs[1] };
        cells.zf = flagsSeen ? { v: String(s.flags.ZF), ask: flagOp } : { v: '—', ask: false };
        cells.cf = flagsSeen ? { v: String(s.flags.CF), ask: flagOp && s.op !== 'inc' && s.op !== 'dec' } : { v: '—', ask: false };
        rows.push({ ins: s.text, cells }); prev = s;
      }
      const asked = rows.reduce((n, row) => n + Object.values(row.cells).filter(c => c.ask).length, 0);
      if (asked < 8 || asked > 34) continue;
      return { id: ++uid, cat: 'trace', type: 'tracestep', title: 'Traceo instrucción por instrucción', prompt: 'Completa la tabla de traceo. Para cada instrucción escribe el valor que toma cada registro o bandera DESPUÉS de ejecutarla (solo las celdas vacías; las demás se mantienen). Los punteros se piden como ÍNDICE desde el comienzo del arreglo (0 = primer elemento); «—» significa «aún sin valor».' + (g.text ? ' AL: escribe el carácter.' : '') + ' ZF/CF: 0 ó 1.', code: g.source, cols, rows, hint: g.hint, runSource: g.source, text: !!g.text };
    }
    return exTraceStep();
  }

  /* ================= state in the middle of the loop ================= */
  function exPartial() {
    for (let attempt = 0; attempt < 60; attempt++) {
      const g = genProgram(pick(['filter', 'two', 'chars', 'stride']));
      const r = g.run; const its = Emu.iterations(r.prog, r.trace).filter(it => it.some(s => s.op === 'loop'));
      if (its.length < 4) continue;
      const j = ri(2, Math.min(its.length - 1, 5));
      const snap = its[j - 1][its[j - 1].length - 1].mem; const ans = {};
      for (const lab of g.ask) { const v = Emu.readLabel(r.prog, snap, lab).values; ans[lab] = g.text ? String.fromCharCode(...v) : v; }
      if (JSON.stringify(ans) === JSON.stringify(g.res)) continue;
      return { id: ++uid, cat: 'trace', type: 'predict', title: 'Estado a mitad del ciclo', prompt: '¿Cómo quedan ' + g.ask.join(' y ') + ' justo al terminar la vuelta ' + j + ' del ciclo (cuando ya se ejecutó el LOOP de esa vuelta)?', code: g.source, asks: g.ask, regs: null, text: !!g.text, answer: ans, hint: 'Traza solo las ' + j + ' primeras vueltas; lo que aún no se escribió conserva su valor inicial. ' + g.hint, runSource: g.source, ptr: g.ptr };
    }
    return exPartial();
  }

  /* ================= counting jumps ================= */
  function exJumps() {
    for (let attempt = 0; attempt < 60; attempt++) {
      const g = genProgram(pick(['filter', 'two', 'chars', 'stride']));
      const r = g.run; const conds = r.prog.items.filter(i => i.kind === 'ins' && Emu.COND[i.op]);
      if (!conds.length) continue;
      const it = pick(conds);
      const exec = r.trace.steps.filter(s => s.ip === it.addr);
      const taken = exec.filter(s => s.taken).length;
      const askTaken = Math.random() < 0.5;
      const ans = askTaken ? taken : exec.length - taken;
      return { id: ++uid, cat: 'trace', type: 'numeric', title: 'Contar saltos', prompt: '¿Cuántas veces ' + (askTaken ? 'SALTA' : 'NO salta') + ' la instrucción «' + it.text + '» durante todo el programa?', code: g.source, answer: String(ans), base: 10, why: 'La instrucción se ejecuta ' + exec.length + ' veces; salta ' + taken + ' y no salta ' + (exec.length - taken) + '. (Se comprueba trazando cada vuelta y viendo si el salto se toma.)', runSource: g.source };
    }
    return exJumps();
  }

  /* ================= true / false ================= */
  function exVF() {
    const [s, v, w] = pick(Content.VF);
    return { id: ++uid, cat: 'vf', type: 'mcq', title: 'Verdadero o falso', prompt: s, opts: ['Verdadero', 'Falso'], ans: v ? 0 : 1, why: w };
  }

  /* ================= flags and registers (micro-traces) ================= */
  const stateOf = r => r.trace.final;
  function runLines(lines, data) { return Emu.runSource(['org 7C00h', ...lines, 'jmp $', ...(data || [])].join('\n')); }
  const stepTxt = r => r.trace.steps.filter(s => s.op !== 'jmp').map(s => s.text + '   →   ' + s.explain);
  function micro(prompt, lines, data, fieldsFn, title) {
    const r = runLines(lines, data);
    if (!r.prog.ok) throw new Error('micro program failed: ' + r.prog.error);
    const fields = fieldsFn(r).map(f => Object.assign({ kind: 'num', exact: true, unit: '', steps: stepTxt(r) }, f));
    return { id: ++uid, cat: 'micro', type: 'calc', title: title || 'Banderas y registros', statement: null, prompt, code: [...lines, ...(data || [])].join('\n'), questions: [], fields, tip: null };
  }
  const MICRO = [
    () => { const A = ri(1, 255), B = pick([1, 3, 15, 240, 255, 85, 170, 7]), op = pick(['and', 'or', 'xor']); return micro('Después de ejecutar estas instrucciones, ¿cuánto vale AL (en decimal)?', ['mov al, ' + A, op + ' al, ' + B], null, r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }]); },
    () => { const op = pick(['add', 'sub']); const A = op === 'add' ? ri(120, 250) : ri(1, 100), B = op === 'add' ? ri(30, 200) : ri(40, 200); return micro('¿Cuánto valen AL (decimal) y CF después de ejecutar estas instrucciones?', ['mov al, ' + A, op + ' al, ' + B], null, r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }, { key: 'cf', label: 'CF', answer: stateOf(r).flags.CF }]); },
    () => { const A = ri(1, 30), B = Math.random() < 0.3 ? A : ri(1, 30), j = pick(['ja', 'jae', 'jb', 'jbe', 'jz', 'jnz']); return micro('BL arranca en 0. ¿Cuánto valen ZF, CF y BL al llegar a «jmp $»?', ['mov bl, 0', 'mov al, ' + A, 'cmp al, ' + B, j + ' @f', 'mov bl, 1', '@@:'], null, r => [{ key: 'zf', label: 'ZF', answer: stateOf(r).flags.ZF }, { key: 'cf', label: 'CF', answer: stateOf(r).flags.CF }, { key: 'bl', label: 'BL', answer: stateOf(r).regs[3] & 0xFF }]); },
    () => { const A = ri(2, 99); return micro('¿Cuánto valen AL (decimal) y ZF después de ejecutar «test al, 1»?', ['mov al, ' + A, 'test al, 1'], null, r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }, { key: 'zf', label: 'ZF', answer: stateOf(r).flags.ZF }]); },
    () => { const v = pick([['mov al, 255', 'inc al'], ['mov al, 0', 'dec al'], ['mov al, 255', 'add al, 1']]); return micro('¿Cuánto valen AL (decimal), ZF y CF después de ejecutar estas instrucciones? (Fíjate en qué instrucción afecta a CF.)', v, null, r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }, { key: 'zf', label: 'ZF', answer: stateOf(r).flags.ZF }, { key: 'cf', label: 'CF', answer: stateOf(r).flags.CF }]); },
    () => { const vals = Array.from({ length: 7 }, () => ri(1, 60)); const k = ri(0, 6); const adv = pick(['', 'add', 'sub']); let idx = k; const lines = ['mov si, num1+' + k]; if (adv) { const j = ri(1, 3); idx = adv === 'add' ? k + j : k - j; if (idx < 0 || idx > 6) return MICRO[5](); lines.push(adv + ' si, ' + j); } lines.push('mov al, [si]'); return micro('¿Cuánto vale AL (decimal) al llegar a «jmp $»?', lines, ['num1 db ' + vals.join(', ')], r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }], 'Punteros y memoria'); },
    () => { const c = pick([...'abcdefghmnopqrstxyz']); const op = pick([['sub al, 20h', 'resta'], ['add al, 1', 'suma']]); return micro("¿Cuánto vale AL (en decimal) después de ejecutar estas instrucciones? (ASCII: 'a' = 97, 'A' = 65)", ["mov al, '" + c + "'", op[0]], null, r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }], 'ASCII en registros'); },
    () => { const N = ri(3, 8), K = ri(2, 9); return micro('¿Cuánto valen BL y CX al llegar a «jmp $»?', ['mov cx, ' + N, 'mov bl, 0', 'ciclo:', 'add bl, ' + K, 'loop ciclo'], null, r => [{ key: 'bl', label: 'BL', answer: stateOf(r).regs[3] & 0xFF }, { key: 'cx', label: 'CX', answer: stateOf(r).regs[1] }], 'Ciclo con acumulador'); },
    () => { const A = ri(10, 200); return micro('¿Cuánto valen AL (decimal) y CF después de «shl al, 1»? (desplaza un bit a la izquierda: multiplica por 2)', ['mov al, ' + A, 'shl al, 1'], null, r => [{ key: 'al', label: 'AL', answer: stateOf(r).regs[0] & 0xFF }, { key: 'cf', label: 'CF', answer: stateOf(r).flags.CF }]); }
  ];
  function exMicro() { return pick(MICRO)(); }

  /* ================= addresses and sizes ================= */
  const hexOf = v => { let s = v.toString(16).toUpperCase(); if (/^[A-F]/.test(s)) s = '0' + s; return s + 'h'; };
  function fld(key, label, answer, unit, steps, hex) { return Object.assign({ key, label, kind: 'num', answer, unit: unit || '', steps, exact: true }, hex ? { base: 16, display: hexOf(answer), placeholder: 'en hexadecimal, p. ej. 7C3Ah' } : {}); }
  function lay(prompt, code, fields) { return { id: ++uid, cat: 'layout', type: 'calc', title: 'Direcciones y tamaños', statement: null, prompt, code: code || null, questions: [], fields, tip: null }; }
  const LAYOUT = [
    () => { const N = ri(40, 220); return lay('El código y los datos del programa ocupan ' + N + ' bytes antes de la línea «times 510-($-$$) db 0». ¿Cuántos bytes de relleno (ceros) escribe esa línea?', null, [fld('r', 'Ceros', 510 - N, 'bytes', ['$ − $$ = ' + N + ' (bytes usados hasta ahí).', 'Relleno = 510 − ' + N + ' = ' + (510 - N) + ' ceros; después la firma de 2 bytes completa los 512.'])]); },
    () => fakeSig(),
    () => { const A = 0x7C00 + ri(0x20, 0x70), N = ri(4, 12); const vals = Array.from({ length: N }, () => ri(1, 60)); return lay('El arreglo «num1» empieza en la dirección ' + hexOf(A) + '. ¿En qué dirección empieza «num2», que se define justo a continuación?', 'num1 db ' + vals.join(', ') + '\nnum2 db 5 dup (0)', [fld('r', 'Dirección de num2', A + N, '', ['num1 ocupa ' + N + ' bytes (uno por cada valor).', 'num2 = ' + hexOf(A) + ' + ' + N + ' = ' + hexOf(A + N) + '.'], true)]); },
    () => { const A = 0x7C00 + ri(0x20, 0x70), K = ri(1, 9); return lay('«num1» está en la dirección ' + hexOf(A) + '. ¿Qué valor (dirección) tiene SI después de «mov si, num1+' + K + '»?', 'mov si, num1+' + K, [fld('r', 'SI', A + K, '', ['«mov si, num1+' + K + '» carga la dirección: ' + hexOf(A) + ' + ' + K + ' = ' + hexOf(A + K) + '.'], true)]); },
    () => { const w = pick(['HOLA', 'CASA', 'MESA', 'ARCO', 'DATO', 'LOOP', 'JUEGO']); const k = ri(1, w.length); return lay('«cadena db \'' + w + '\'». ¿Qué código ASCII (hexadecimal) tiene el carácter número ' + k + ' (el ' + k + '.º, contando desde 1)?', "cadena db '" + w + "'", [fld('r', 'Código', w.charCodeAt(k - 1), '', ["El " + k + ".º carácter es '" + w[k - 1] + "' = " + hexOf(w.charCodeAt(k - 1)) + ' (mayúsculas: 41h + posición en el alfabeto).'], true)]); },
    () => { const v = ri(0x1000, 0xFFFE); const lo = v & 0xFF, hi = v >> 8; return lay('¿Qué dos bytes se guardan en memoria, en orden de dirección creciente, con «dw ' + hexOf(v) + '»?', 'dw ' + hexOf(v), [fld('b1', 'Primer byte', lo, '', ['El 8086 es little-endian: primero el byte BAJO: ' + hexOf(lo) + '.'], true), fld('b2', 'Segundo byte', hi, '', ['Después el byte ALTO: ' + hexOf(hi) + '. (Como dw 0AA55h deja 55h, AAh.)'], true)]); },
    () => { const n = ri(2, 12), vs = pick([[1], [2, 3], [0, 1, 2]]); return lay('¿Cuántos bytes reserva en memoria esta línea?', 'num2 db ' + n + ' dup (' + vs.join(', ') + ')', [fld('r', 'Bytes', n * vs.length, 'bytes', ['DUP repite ' + n + ' veces el grupo de ' + vs.length + ' byte(s): ' + n + ' × ' + vs.length + ' = ' + n * vs.length + '.'])]); }
  ];
  function fakeSig() {
    const org = pick([0x7C00]); return lay('Con «org 7C00h», el sector mide 512 bytes. ¿En qué dirección quedan el byte 55h y el byte AAh de la firma?', 'org 7C00h\n...\ntimes 510-($-$$) db 0\ndw 0AA55h', [fld('a', 'Dirección de 55h', org + 510, '', [hexOf(org) + ' + 510 (1FEh) = ' + hexOf(org + 510) + '.'], true), fld('b', 'Dirección de AAh', org + 511, '', ['El siguiente byte: ' + hexOf(org + 511) + '.'], true)]);
  }
  function exLayout() { return pick(LAYOUT)(); }

  const MAKERS = {
    fill: () => (Math.random() < 0.75 ? exFillCode() : Ex.exJump()),
    trace: () => { const r = Math.random(); return r < 0.34 ? exTraceStep() : r < 0.56 ? Ex.exTrace() : r < 0.76 ? exPartial() : r < 0.9 ? exJumps() : Ex.exCount(); },
    vf: exVF, micro: exMicro, layout: exLayout
  };
  Object.assign(Ex.MAKERS, MAKERS);
  const E2 = { exFillCode, exTraceStep, exPartial, exJumps, exVF, exMicro, exLayout, MICRO, LAYOUT, slotCands };
  if (isNode) module.exports = E2; else root.Ex2 = E2;
})(typeof window !== 'undefined' ? window : globalThis);
