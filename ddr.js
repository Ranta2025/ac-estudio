/* Question 2 engine: processor + DDR memory timing.
 * Pure functions (works in the browser as `DDR` and in Node via require).
 *
 * Model (matches the six exam statements):
 *   a) t_fetch   = ciclos / f_CPU                         (GHz -> ns)
 *   b) transfers = ceil( bytes / (8 * canales) )          (bus de 64 bits = 8 B por módulo)
 *   c) f_bus     = MT/s / 2                               (DDR: 2 transferencias por ciclo)
 *   d) t_mem     = transfers / MT/s                       (us -> ns)
 *   e) notación alternativa: PCn-X  <->  DDRn-(X/8)
 *   f) t_total   = t_fetch + t_mem
 */
(function (root) {
  'use strict';

  /* exact marketing pairs (MT/s -> MB/s per module) used in the course */
  const PAIRS = [
    { gen: '', mts: 400, mbps: 3200 }, { gen: '2', mts: 800, mbps: 6400 }, { gen: '3', mts: 1600, mbps: 12800 },
    { gen: '4', mts: 2400, mbps: 19200 }, { gen: '4', mts: 3200, mbps: 25600 },
    { gen: '5', mts: 4800, mbps: 38400 }, { gen: '5', mts: 5200, mbps: 41600 }, { gen: '5', mts: 5600, mbps: 44800 },
    { gen: '5', mts: 6000, mbps: 48000 }, { gen: '5', mts: 6400, mbps: 51200 }
  ];
  const CH_NAME = { 1: 'un solo canal (canal simple)', 2: 'doble canal', 3: 'triple canal', 4: 'cuádruple canal' };

  const ddrName = (gen, mts) => 'DDR' + gen + '-' + mts;
  const pcName = (gen, mbps) => 'PC' + gen + '-' + mbps;

  function fmt(x, d) {
    d = d == null ? 3 : d;
    const r = Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
    return String(r);
  }

  function normName(s) {
    return String(s).toUpperCase().replace(/\s+/g, '').replace(/^(DDR\d?|PC\d?)(\d{3,6})$/, '$1-$2');
  }
  function parseMem(name) {
    const n = normName(name);
    const m = /^(DDR|PC)(\d?)-(\d+)$/.exec(n);
    if (!m) return null;
    const prefix = m[1], gen = m[2], num = parseInt(m[3], 10);
    const mts = prefix === 'DDR' ? num : num / 8;
    const mbps = prefix === 'DDR' ? num * 8 : num;
    return { prefix, gen, num, mts, mbps, ddr: ddrName(gen, Math.round(mts)), pc: pcName(gen, Math.round(mbps)), busMHz: mts / 2, given: n };
  }

  /* p = { cpuGHz, cycles, mem, channels, bytes } */
  function solve(p) {
    const mem = parseMem(p.mem);
    if (!mem) throw new Error('Memoria no reconocida: ' + p.mem);
    const fetchNs = p.cycles / p.cpuGHz;
    const perTransfer = 8 * p.channels;
    const exact = p.bytes / perTransfer;
    const transfers = Math.ceil(exact - 1e-9);
    const integer = Math.abs(exact - Math.round(exact)) < 1e-9;
    const busMHz = mem.mts / 2;
    const memNs = transfers / mem.mts * 1000;
    const memNsExact = exact / mem.mts * 1000;
    const alt = mem.prefix === 'DDR' ? mem.pc : mem.ddr;
    const totalNs = fetchNs + memNs;
    return {
      mem, fetchNs, perTransfer, exact, transfers, integer, busMHz, memNs, memNsExact, alt, totalNs,
      totalNsExact: fetchNs + memNsExact, busCycles: transfers / 2, busPeriodNs: 1000 / busMHz, cpuPeriodNs: 1 / p.cpuGHz,
      bandwidthGBs: mem.mbps * p.channels / 1000
    };
  }

  function statement(p) {
    const c = p.channels;
    const mods = c === 1 ? 'Cuenta con 1 memoria ' : 'Cuenta con ' + c + ' memorias ';
    return 'Un procesador que funciona a ' + p.cpuGHz + ' GHz incluye una instrucción capaz de transferir una secuencia de Bytes. La captación, decodificación y resolución de las direcciones es de ' + p.cycles + ' ciclos de reloj. ' +
      mods + normName(p.mem) + ' conectadas en ' + CH_NAME[c] + ' para transferir ' + p.bytes + ' bytes de datos.';
  }
  const PARTS = {
    a: '¿Cuántos ns se emplearon en la captación, decodificación y resolución de las direcciones?',
    b: '¿Cuántas transferencias de datos son necesarias?',
    c: '¿Cuál es la frecuencia del bus?',
    d: '¿Cuánto demora la memoria en el proceso?',
    e: '¿Cuál es la notación alternativa de las memorias?',
    f: '¿Cuánto demora el procesador en total para ejecutar la instrucción?'
  };

  /* worked steps for each part */
  function steps(p, s) {
    const m = s.mem; const st = {};
    st.a = ['Fórmula: t = ciclos ÷ f_CPU.   (Con la frecuencia en GHz, el resultado sale directo en ns, porque 1 GHz ↔ 1 ns de período.)',
      't = ' + p.cycles + ' ÷ ' + p.cpuGHz + ' GHz = ' + fmt(s.fetchNs) + ' ns'];
    st.b = ['Cada módulo mueve 64 bits = 8 bytes por transferencia, y los canales trabajan en paralelo:  bytes por transferencia = 8 B × canales = 8 × ' + p.channels + ' = ' + s.perTransfer + ' B.',
      'Transferencias = bytes ÷ bytes por transferencia = ' + p.bytes + ' ÷ ' + s.perTransfer + ' = ' + fmt(s.exact) + (s.integer ? '' : '  → no es entero: la última transferencia queda incompleta, se redondea hacia ARRIBA ⇒ ' + s.transfers),
      'Resultado: ' + s.transfers + ' transferencias'];
    st.c = [m.prefix === 'DDR' ? 'El nombre ' + m.given + ' ya da la velocidad efectiva: ' + m.mts + ' MT/s (millones de transferencias por segundo).' : 'El nombre ' + m.given + ' da el ancho de banda de un módulo: ' + m.mbps + ' MB/s. Como cada transferencia son 8 B ⇒ MT/s = ' + m.mbps + ' ÷ 8 = ' + m.mts + ' MT/s (≡ ' + m.ddr + ').',
      'DDR = doble tasa: transfiere 2 veces por ciclo de reloj (flanco de subida y de bajada) ⇒ f_bus = MT/s ÷ 2 = ' + m.mts + ' ÷ 2 = ' + fmt(s.busMHz) + ' MHz'];
    st.d = ['Cada transferencia dura 1 ÷ MT/s. Como las transferencias ya incluyen todos los canales:  t_mem = transferencias ÷ MT/s.',
      't_mem = ' + s.transfers + ' ÷ ' + m.mts + ' MT/s = ' + fmt(s.transfers / m.mts, 6) + ' µs = ' + fmt(s.memNs) + ' ns',
      'Comprobación con el bus: ' + fmt(s.busCycles, 2) + ' ciclos de bus × ' + fmt(s.busPeriodNs, 4) + ' ns (período del bus) = ' + fmt(s.busCycles * s.busPeriodNs) + ' ns.'];
    st.e = ['Regla: PCn-X  ↔  DDRn-(X ÷ 8)   y   DDRn-Y  ↔  PCn-(Y × 8)   (X en MB/s, Y en MT/s; 8 = bytes por transferencia).',
      m.prefix === 'DDR' ? m.given + ' ↔ PC' + m.gen + '-' + m.mts + ' × 8 = ' + s.alt : m.given + ' ↔ DDR' + m.gen + '-(' + m.mbps + ' ÷ 8) = ' + s.alt];
    st.f = ['t_total = t_captación + t_memoria  (se suman porque primero se capta/decodifica y después se transfieren los datos).',
      't_total = ' + fmt(s.fetchNs) + ' ns + ' + fmt(s.memNs) + ' ns = ' + fmt(s.totalNs) + ' ns'];
    return st;
  }

  /* answers per part: {answer, alt?, unit, kind} */
  function answers(p, s) {
    const A = {
      a: { kind: 'num', answer: s.fetchNs, unit: 'ns' },
      b: { kind: 'num', answer: s.transfers, unit: 'transferencias' },
      c: { kind: 'num', answer: s.busMHz, unit: 'MHz' },
      d: { kind: 'num', answer: s.memNs, unit: 'ns' },
      e: { kind: 'text', answer: s.alt, unit: '' },
      f: { kind: 'num', answer: s.totalNs, unit: 'ns' }
    };
    if (!s.integer) { A.b.alt = [s.exact]; A.d.alt = [s.memNsExact]; A.f.alt = [s.totalNsExact]; }
    return A;
  }

  function parseNumber(str) {
    const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(String(str));
    return m ? parseFloat(m[1].replace(',', '.')) : NaN;
  }
  function tolFor(a) { return Math.max(0.011, Math.abs(a) * 0.005); }
  function parseBase(str, base) {
    let t = String(str).trim().toLowerCase();
    if (base === 16) { t = t.replace(/^0x/, '').replace(/h$/, ''); return /^[0-9a-f]+$/.test(t) ? parseInt(t, 16) : NaN; }
    if (base === 2) { t = t.replace(/b$/, ''); return /^[01]+$/.test(t) ? parseInt(t, 2) : NaN; }
    return NaN;
  }
  function checkField(f, value) {
    if (f.kind === 'text') return normName(value) === normName(f.answer);
    const u = f.base ? parseBase(value, f.base) : parseNumber(value);
    if (Number.isNaN(u)) return false;
    const targets = [f.answer].concat(f.alt || []);
    if (f.exact || f.base) return targets.some(a => u === a);
    return targets.some(a => Math.abs(u - a) <= tolFor(a));
  }

  /* ---------- the six real exams ---------- */
  const EXAMS = [
    { id: 'A23', label: 'Batería A 2023', p: { cpuGHz: 1.5, cycles: 60, mem: 'DDR3-1600', channels: 3, bytes: 576 } },
    { id: 'B23', label: 'Batería B 2023', p: { cpuGHz: 3, cycles: 60, mem: 'PC3-12800', channels: 3, bytes: 576 } },
    { id: 'A24', label: 'Batería A 2024', p: { cpuGHz: 3, cycles: 60, mem: 'PC5-48000', channels: 3, bytes: 720 } },
    { id: 'B24', label: 'Batería B 2024', p: { cpuGHz: 1.5, cycles: 60, mem: 'DDR5-6000', channels: 2, bytes: 360 } },
    { id: 'A25', label: 'Batería A 2024-25', p: { cpuGHz: 3, cycles: 15, mem: 'PC5-44800', channels: 3, bytes: 672 } },
    { id: 'B25', label: 'Batería B 2024-25', p: { cpuGHz: 1.5, cycles: 15, mem: 'DDR5-5600', channels: 2, bytes: 448 } }
  ];

  /* ---------- random generation ---------- */
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  let uid = 1000;

  function genProblem(opts) {
    opts = opts || {};
    const pair = pick(PAIRS);
    const asPC = Math.random() < 0.5;
    const channels = pick([1, 2, 2, 3, 3, 4]);
    const per = 8 * channels;
    let transfers = ri(12, 40);
    let bytes = transfers * per;
    if (!opts.integerOnly && channels >= 2 && Math.random() < 0.12) bytes -= 8; // non-integer case (like Batería B 2024)
    return {
      cpuGHz: pick([1.5, 2, 2.4, 2.5, 3, 3.5, 4]), cycles: pick([15, 20, 30, 45, 60, 75, 90]),
      mem: asPC ? pcName(pair.gen, pair.mbps) : ddrName(pair.gen, pair.mts), channels, bytes
    };
  }

  function fieldsFor(p, s, keys) {
    const A = answers(p, s); const st = steps(p, s);
    return keys.map(k => Object.assign({ key: k, label: k + ')', steps: st[k] }, A[k]));
  }

  function exProblem(keys, title, cat) {
    const p = genProblem(); const s = solve(p);
    const full = keys.length === 6;
    return {
      id: ++uid, cat: cat, type: 'calc', title: title, statement: statement(p), p,
      prompt: full ? 'Resuelve todos los apartados:' : 'Calcula solo el apartado ' + keys[0] + ') (el enunciado completo es el de la prueba):',
      questions: keys.map(k => k + ') ' + PARTS[k]),
      fields: fieldsFor(p, s, keys), tip: s.integer ? null : 'Atención: bytes ÷ bytes-por-transferencia no da entero. Aquí se redondea hacia arriba (como en la Batería B 2024); también se acepta el valor sin redondear.'
    };
  }

  const CONV = [
    () => { const q = pick(PAIRS); return conv('Notación alternativa: ¿a qué DDR equivale ' + pcName(q.gen, q.mbps) + '?', ddrName(q.gen, q.mts), 'text', '', ['Regla: PCn-X ↔ DDRn-(X ÷ 8).', pcName(q.gen, q.mbps) + ' → ' + q.mbps + ' ÷ 8 = ' + q.mts + ' ⇒ ' + ddrName(q.gen, q.mts)]); },
    () => { const q = pick(PAIRS); return conv('Notación alternativa: ¿a qué PC equivale ' + ddrName(q.gen, q.mts) + '?', pcName(q.gen, q.mbps), 'text', '', ['Regla: DDRn-Y ↔ PCn-(Y × 8).', ddrName(q.gen, q.mts) + ' → ' + q.mts + ' × 8 = ' + q.mbps + ' ⇒ ' + pcName(q.gen, q.mbps)]); },
    () => { const q = pick(PAIRS); return conv('¿Cuál es la frecuencia del bus (en MHz) de una memoria ' + ddrName(q.gen, q.mts) + '?', q.mts / 2, 'num', 'MHz', ['DDR transfiere 2 veces por ciclo ⇒ f_bus = MT/s ÷ 2 = ' + q.mts + ' ÷ 2 = ' + q.mts / 2 + ' MHz.']); },
    () => { const q = pick(PAIRS); return conv('¿Cuál es la frecuencia del bus (en MHz) de una memoria ' + pcName(q.gen, q.mbps) + '?', q.mts / 2, 'num', 'MHz', ['Primero MT/s = MB/s ÷ 8 = ' + q.mbps + ' ÷ 8 = ' + q.mts + '.', 'Luego f_bus = MT/s ÷ 2 = ' + q.mts / 2 + ' MHz.']); },
    () => { const q = pick(PAIRS); return conv('¿Cuántas transferencias por segundo (en MT/s) hace una ' + pcName(q.gen, q.mbps) + '?', q.mts, 'num', 'MT/s', ['MT/s = MB/s ÷ 8 bytes por transferencia = ' + q.mbps + ' ÷ 8 = ' + q.mts + '.']); },
    () => { const q = pick(PAIRS); return conv('Una memoria ' + ddrName(q.gen, q.mts) + ' tiene un bus de 64 bits. ¿Cuál es su ancho de banda máximo (en MB/s)?', q.mbps, 'num', 'MB/s', ['MB/s = MT/s × 8 B = ' + q.mts + ' × 8 = ' + q.mbps + ' (por eso el nombre PC dice ' + q.mbps + ').']); },
    () => { const f = pick([1, 1.5, 2, 2.5, 3, 4, 5]); return conv('¿Cuál es el período (en ns) de un procesador a ' + f + ' GHz?', 1 / f, 'num', 'ns', ['T = 1 ÷ f. Con f en GHz, T sale en ns: 1 ÷ ' + f + ' = ' + fmt(1 / f) + ' ns.']); },
    () => { const f = pick([200, 400, 800, 1000, 1600, 2000]); return conv('¿Cuál es el período (en ns) de un reloj de ' + f + ' MHz?', 1000 / f, 'num', 'ns', ['T = 1 ÷ f. Con f en MHz: T(ns) = 1000 ÷ f(MHz) = 1000 ÷ ' + f + ' = ' + fmt(1000 / f) + ' ns.']); },
    () => { const c = pick([15, 20, 30, 45, 60, 90]); const f = pick([1.5, 2, 2.4, 3, 3.6, 4]); return conv('Una instrucción necesita ' + c + ' ciclos de un procesador a ' + f + ' GHz. ¿Cuántos ns son?', c / f, 'num', 'ns', ['t = ciclos ÷ f = ' + c + ' ÷ ' + f + ' = ' + fmt(c / f) + ' ns.']); },
    () => { const ch = pick([1, 2, 3, 4]); return conv('¿Cuántos bytes se transfieren de una vez con ' + ch + (ch === 1 ? ' módulo' : ' módulos') + ' en ' + (ch === 1 ? 'canal simple' : CH_NAME[ch]) + '? (cada módulo: 64 bits)', 8 * ch, 'num', 'bytes', ['64 bits = 8 B por módulo; con ' + ch + ' canal(es) en paralelo: 8 × ' + ch + ' = ' + 8 * ch + ' B por transferencia.']); },
    () => { const q = pick(PAIRS); const ch = pick([2, 3, 4]); return conv('Ancho de banda total (en GB/s) de ' + ch + ' memorias ' + ddrName(q.gen, q.mts) + ' en ' + CH_NAME[ch] + ':', q.mbps * ch / 1000, 'num', 'GB/s', ['Un módulo: ' + q.mts + ' MT/s × 8 B = ' + q.mbps + ' MB/s. Con ' + ch + ' canales: ' + q.mbps + ' × ' + ch + ' = ' + q.mbps * ch + ' MB/s = ' + fmt(q.mbps * ch / 1000) + ' GB/s.']); },
    () => { const q = pick(PAIRS); const ch = pick([1, 2, 3, 4]); const t = 2 * ri(6, 20); return conv('Una memoria ' + ddrName(q.gen, q.mts) + ' en ' + CH_NAME[ch] + ' mueve ' + t * 8 * ch + ' bytes. ¿Cuántos ciclos del bus (de memoria) dura la transferencia?', t / 2, 'num', 'ciclos', ['Transferencias = ' + t * 8 * ch + ' ÷ ' + 8 * ch + ' = ' + t + '.', 'DDR hace 2 transferencias por ciclo ⇒ ciclos de bus = ' + t + ' ÷ 2 = ' + t / 2 + '.']); },
    () => { const f = pick([1.5, 2, 2.5, 3, 4]); const t = pick([4, 5, 8, 10, 12, 20]); return conv('Una memoria tarda ' + t + ' ns en transferir los datos. ¿Cuántos ciclos de un procesador de ' + f + ' GHz son?', t * f, 'num', 'ciclos', ['ciclos = t × f = ' + t + ' ns × ' + f + ' GHz = ' + fmt(t * f) + '.']); },
    () => { const q = pick(PAIRS); return conv('¿Cuánto dura UNA transferencia (en ns) de una memoria ' + ddrName(q.gen, q.mts) + '?', 1000 / q.mts, 'num', 'ns', ['1 ÷ MT/s = 1 ÷ ' + q.mts + ' µs → ×1000 = ' + fmt(1000 / q.mts, 4) + ' ns.']); },
    () => { const q = pick(PAIRS); const ch = pick([2, 3, 4]); return conv('Ancho de banda (en MB/s) de ' + ch + ' memorias ' + pcName(q.gen, q.mbps) + ' en ' + CH_NAME[ch] + ':', q.mbps * ch, 'num', 'MB/s', ['Cada módulo aporta ' + q.mbps + ' MB/s; en paralelo se suman: ' + q.mbps + ' × ' + ch + ' = ' + q.mbps * ch + ' MB/s.']); },
    () => { const ch = pick([2, 3, 4]); const t = ri(10, 40); return conv('Se transfieren ' + t * 8 * ch + ' bytes con ' + ch + ' memorias en ' + CH_NAME[ch] + '. ¿Cuántas transferencias son necesarias?', t, 'num', 'transferencias', ['Bytes por transferencia = 8 × ' + ch + ' = ' + 8 * ch + '.', 'Transferencias = ' + t * 8 * ch + ' ÷ ' + 8 * ch + ' = ' + t + '.']); }
  ];
  function conv(prompt, answer, kind, unit, stepList) {
    return { id: ++uid, cat: 'ddrconv', type: 'calc', title: 'Conversión rápida', statement: null, prompt, questions: [], fields: [{ key: 'r', label: 'Respuesta', kind, answer, unit, steps: stepList }], tip: null };
  }


  /* ---------- extra generators: inverse problems, comparisons, theory ---------- */
  const nm = (pair, asPC) => asPC ? pcName(pair.gen, pair.mbps) : ddrName(pair.gen, pair.mts);
  function niceTimes(mts) { const out = []; for (let t = 2; t <= 90; t++) { if (Number.isInteger(t * mts / 1000) && t * mts / 1000 >= 6) out.push(t); } return out; }
  function F(key, label, answer, unit, steps, extra) { return Object.assign({ key, label, kind: 'num', answer, unit: unit || '', steps, exact: true }, extra || {}); }
  function exInv() {
    const kind = pick(['bytes', 'canales', 'freq', 'ciclos', 'mts']);
    const pair = pick(PAIRS), asPC = Math.random() < 0.5, c = pick([1, 2, 3, 4]), name = nm(pair, asPC);
    const ts = niceTimes(pair.mts); const t = pick(ts); const transfers = t * pair.mts / 1000;
    const mkx = (prompt, fields) => ({ id: ++uid, cat: 'ddrinv', type: 'calc', title: 'Problema inverso', statement: null, prompt, questions: [], fields, tip: null });
    const mem = parseMem(name); const mtsTxt = asPC ? 'MT/s = ' + mem.mbps + ' ÷ 8 = ' + mem.mts : 'MT/s = ' + mem.mts;
    if (kind === 'bytes') {
      const bytes = transfers * 8 * c;
      return mkx('Se transfieren datos con ' + c + (c === 1 ? ' memoria ' : ' memorias ') + name + ' en ' + CH_NAME[c] + '. La memoria demora ' + t + ' ns en el proceso. ¿Cuántos bytes se transfirieron?',
        [F('r', 'Bytes', bytes, 'bytes', [mtsTxt + '.', 'Transferencias = t × MT/s ÷ 1000 = ' + t + ' × ' + pair.mts + ' ÷ 1000 = ' + transfers + '.', 'Bytes = transferencias × 8 × canales = ' + transfers + ' × 8 × ' + c + ' = ' + bytes + '.'])]);
    }
    if (kind === 'canales') {
      const bytes = transfers * 8 * c;
      return mkx('Una memoria ' + name + ' transfiere ' + bytes + ' bytes y la memoria demora ' + t + ' ns. ¿Cuántos canales se están usando?',
        [F('r', 'Canales', c, '', [mtsTxt + '.', 'Transferencias = ' + t + ' × ' + pair.mts + ' ÷ 1000 = ' + transfers + '.', 'Bytes por transferencia = ' + bytes + ' ÷ ' + transfers + ' = ' + bytes / transfers + ' B = 8 × canales ⇒ canales = ' + c + '.'])]);
    }
    if (kind === 'freq') {
      for (let k = 0; k < 200; k++) {
        const f = pick([1.5, 2, 2.5, 3, 4, 5]), cycles = pick([15, 20, 30, 40, 45, 60, 75, 90]); const ns = cycles / f;
        if (Math.abs(ns * 1000 - Math.round(ns * 1000)) > 1e-9) continue;
        return mkx('Un procesador tarda ' + fmt(ns) + ' ns en ejecutar ' + cycles + ' ciclos de reloj. ¿Cuál es su frecuencia (en GHz)?', [F('r', 'f (GHz)', f, 'GHz', ['t = ciclos ÷ f  ⇒  f = ciclos ÷ t.', 'f = ' + cycles + ' ÷ ' + fmt(ns) + ' ns = ' + f + ' GHz.'], { exact: false })]);
      }
    }
    if (kind === 'ciclos') {
      const f = pick([1.5, 2, 2.5, 3, 4]), cycles = pick([10, 15, 20, 30, 40, 60]); const ns = cycles / f;
      if (Math.abs(ns * 1000 - Math.round(ns * 1000)) < 1e-9) return mkx('Un procesador de ' + f + ' GHz emplea ' + fmt(ns) + ' ns en captar y decodificar una instrucción. ¿Cuántos ciclos de reloj son?', [F('r', 'Ciclos', cycles, 'ciclos', ['t = ciclos ÷ f  ⇒  ciclos = t × f.', 'ciclos = ' + fmt(ns) + ' ns × ' + f + ' GHz = ' + cycles + '.'])]);
    }
    // mts (default / fallback)
    return mkx('Una memoria transfiere ' + transfers + ' datos (transferencias) en ' + t + ' ns. ¿Cuántas MT/s tiene y cuál es su notación DDR?',
      [F('r', 'MT/s', pair.mts, 'MT/s', ['t = transferencias ÷ MT/s  ⇒  MT/s = transferencias ÷ t.', 'MT/s = ' + transfers + ' ÷ ' + t + ' ns × 1000 = ' + pair.mts + '.']),
        { key: 'n', label: 'Notación DDR', kind: 'text', answer: ddrName(pair.gen, pair.mts), unit: '', steps: ['Con ' + pair.mts + ' MT/s la memoria es ' + ddrName(pair.gen, pair.mts) + ' (≡ ' + pcName(pair.gen, pair.mbps) + ').'] }]);
  }

  function exCmp() {
    for (let k = 0; k < 300; k++) {
      const A = { pair: pick(PAIRS), c: pick([1, 2, 3, 4]) }, B = { pair: pick(PAIRS), c: pick([1, 2, 3, 4]) };
      if (A.pair === B.pair && A.c === B.c) continue;
      const bytes = 8 * A.c * B.c * pick([2, 3, 4, 5, 6, 8]);
      const tA = bytes / (8 * A.c) / A.pair.mts * 1000, tB = bytes / (8 * B.c) / B.pair.mts * 1000;
      if (Math.abs(tA - tB) / Math.max(tA, tB) < 0.02) continue;
      const dA = A.c + '× ' + ddrName(A.pair.gen, A.pair.mts) + ' en ' + CH_NAME[A.c], dB = B.c + '× ' + ddrName(B.pair.gen, B.pair.mts) + ' en ' + CH_NAME[B.c];
      const better = tA < tB ? 0 : 1;
      return { id: ++uid, cat: 'ddrcmp', type: 'mcq', title: 'Comparar configuraciones', prompt: 'Hay que transferir ' + bytes + ' bytes. ¿Qué configuración de memoria lo hace en MENOS tiempo?\nA: ' + dA + '\nB: ' + dB,
        opts: ['La A', 'La B', 'Tardan lo mismo'], ans: better,
        why: 'A: ' + bytes + ' ÷ ' + 8 * A.c + ' = ' + bytes / (8 * A.c) + ' transferencias ÷ ' + A.pair.mts + ' MT/s = ' + fmt(tA) + ' ns.   B: ' + bytes + ' ÷ ' + 8 * B.c + ' = ' + bytes / (8 * B.c) + ' transferencias ÷ ' + B.pair.mts + ' MT/s = ' + fmt(tB) + ' ns.' };
    }
    return exCmp();
  }

  const TEO = [
    ['DDR significa…', ['Double Data Rate: dos transferencias por cada ciclo de reloj.', 'Digital Data Register.', 'Dual Disk Read.', 'Dynamic Dual RAM.'], 'Transfiere en el flanco de subida y en el de bajada del reloj.'],
    ['En DDR3-1600, el número 1600 indica…', ['Las mega-transferencias por segundo (MT/s).', 'La frecuencia del bus en MHz.', 'La capacidad en MB.', 'Los MB/s del módulo.'], 'Son MT/s; el bus real va a la mitad: 800 MHz.'],
    ['En PC3-12800, el número 12800 indica…', ['El ancho de banda de un módulo en MB/s.', 'La frecuencia en MHz.', 'Los MT/s.', 'La capacidad en MB.'], '12800 MB/s = 1600 MT/s × 8 bytes.'],
    ['La frecuencia del bus de una DDR4-3200 es…', ['1600 MHz.', '3200 MHz.', '6400 MHz.', '800 MHz.'], 'f_bus = MT/s ÷ 2 = 1600 MHz.'],
    ['¿Por qué se multiplica por 8 para pasar de MT/s a MB/s?', ['Porque cada transferencia mueve 64 bits = 8 bytes.', 'Porque DDR transfiere 8 veces por ciclo.', 'Porque hay 8 canales.', 'Porque 1 MB = 8 bits.'], 'El bus de datos de un módulo es de 64 bits (8 bytes).'],
    ['Con memorias en doble canal, ¿cuántos bytes se mueven en cada transferencia?', ['16.', '8.', '32.', '4.'], '8 B por módulo × 2 canales.'],
    ['En el apartado a) (captación, decodificación y resolución de direcciones) se utiliza…', ['La frecuencia del procesador.', 'La frecuencia de la memoria.', 'El número de canales.', 'El ancho de banda.'], 'Son ciclos de la CPU: t = ciclos ÷ f_CPU.'],
    ['Si se duplican los canales (mismos bytes y misma memoria), el tiempo de memoria…', ['Se reduce a la mitad.', 'Se duplica.', 'No cambia.', 'Se reduce a la cuarta parte.'], 'Hacen falta la mitad de transferencias.'],
    ['La notación alternativa de DDR5-4800 es…', ['PC5-38400.', 'PC5-4800.', 'PC4-38400.', 'PC5-19200.'], '4800 × 8 = 38400.'],
    ['Si bytes ÷ (8 × canales) no da un número entero, las transferencias se…', ['Redondean hacia arriba.', 'Redondean hacia abajo.', 'Dejan con decimales.', 'Multiplican por 2.'], 'La última transferencia es parcial pero ocupa un ciclo completo.'],
    ['¿Qué memoria tiene mayor velocidad efectiva?', ['DDR4-3200.', 'DDR3-1600.', 'DDR2-800.', 'DDR-400.'], 'Más MT/s = más transferencias por segundo.'],
    ['El período de un procesador de 2 GHz es…', ['0.5 ns.', '2 ns.', '5 ns.', '0.2 ns.'], 'T = 1 ÷ f = 1 ÷ 2 GHz = 0.5 ns.'],
    ['El tiempo total de ejecución de la instrucción (apartado f) se obtiene…', ['Sumando el tiempo de captación y el de memoria.', 'Multiplicándolos.', 'Restándolos.', 'Solo con el tiempo de memoria.'], 't_total = a) + d).'],
    ['Un «canal» de memoria es…', ['Un camino de datos de 64 bits entre el controlador y los módulos.', 'Un cable de alimentación.', 'Una memoria caché.', 'Un tipo de DDR.'], 'Varios canales trabajan en paralelo y suman su ancho.'],
    ['La frecuencia del bus de una DDR-400 (DDR1) es…', ['200 MHz.', '400 MHz.', '800 MHz.', '100 MHz.'], '400 MT/s ÷ 2 = 200 MHz.'],
    ['En una memoria DDR, ¿cómo se relacionan MT/s y MHz del bus?', ['MT/s = 2 × MHz.', 'MT/s = MHz.', 'MT/s = MHz ÷ 2.', 'MT/s = 8 × MHz.'], 'Dos transferencias por ciclo.'],
    ['En el apartado d) (tiempo de la memoria), ¿qué dato NO interviene?', ['La frecuencia del procesador.', 'Las transferencias.', 'Los MT/s de la memoria.', 'Los canales (vía las transferencias).'], 'd) solo usa transferencias y MT/s; la CPU interviene en a).'],
    ['PC4-25600 equivale a…', ['DDR4-3200.', 'DDR4-2560.', 'DDR3-1600.', 'DDR5-6400.'], '25600 ÷ 8 = 3200.']
  ];
  function exTeo() {
    const q = pick(TEO); const order = q[1].map((t, i) => ({ t, i })).sort(() => Math.random() - 0.5);
    return { id: ++uid, cat: 'ddrteo', type: 'mcq', title: 'Teoría de memoria', prompt: q[0], opts: order.map(o => o.t), ans: order.findIndex(o => o.i === 0), why: q[2] };
  }

  const MAKERS = {
    ddrconv: () => pick(CONV)(),
    ddr: () => exProblem([pick(['a', 'b', 'c', 'd', 'e', 'f'])], 'Una parte de la pregunta 2', 'ddr'),
    ddrfull: () => exProblem(['a', 'b', 'c', 'd', 'e', 'f'], 'Pregunta 2 completa', 'ddrfull'),
    ddrinv: exInv, ddrcmp: exCmp, ddrteo: exTeo
  };

  const DDR = { PAIRS, EXAMS, PARTS, parseMem, normName, solve, steps, answers, statement, fmt, parseNumber, checkField, parseBase, genProblem, MAKERS, TEO, CH_NAME, ddrName, pcName };
  if (typeof module !== 'undefined' && module.exports) module.exports = DDR;
  else {
    root.DDR = DDR;
    if (root.Ex && root.Ex.MAKERS) Object.assign(root.Ex.MAKERS, MAKERS);
  }
})(typeof window !== 'undefined' ? window : globalThis);
