/* UI building blocks: DOM helper, code highlighter, simulator, exercise renderer. */
(function (root) {
  'use strict';
  const { Emu, Programs, Content, Ex } = root;

  /* ---------- helpers ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return el;
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const Store = {
    get(k, d) { try { const v = localStorage.getItem('asm.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('asm.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const Stats = {
    data: Store.get('stats', {}),
    add(cat, ok) { const s = this.data[cat] || (this.data[cat] = { n: 0, ok: 0 }); s.n++; if (ok) s.ok++; Store.set('stats', this.data); document.dispatchEvent(new CustomEvent('stats')); },
    total() { let n = 0, ok = 0; for (const s of Object.values(this.data)) { n += s.n; ok += s.ok; } return { n, ok }; },
    reset() { this.data = {}; Store.set('stats', {}); document.dispatchEvent(new CustomEvent('stats')); }
  };

  /* ---------- syntax highlight ---------- */
  const MNEM = 'mov|add|sub|inc|dec|and|or|xor|not|neg|test|cmp|shl|shr|xchg|loop|jmp|jcxz|nop|hlt|j[a-z]{1,3}';
  const HL_RE = new RegExp([
    '(;.*$)', "('[^']*'|\"[^\"]*\")", '(^\\s*[@\\w.]+(?=:))', '(\\b(?:ax|bx|cx|dx|si|di|bp|sp|al|ah|bl|bh|cl|ch|dl|dh|cs|ds|es|ss)\\b)',
    '(\\b(?:0x[0-9a-f]+|[0-9][0-9a-f]*h|[01]+b|\\d+)\\b)', '(\\b(?:' + MNEM + ')\\b)', '(\\b(?:db|dw|dd|dup|times|org|format|binary|as|use16)\\b)', '(@[fb@]|\\$\\$?)'
  ].join('|'), 'gi');
  function hl(line) {
    let out = '', last = 0, m;
    HL_RE.lastIndex = 0;
    while ((m = HL_RE.exec(line))) {
      out += esc(line.slice(last, m.index));
      const cls = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'lab' : m[4] ? 'reg' : m[5] ? 'num' : m[6] ? 'ins' : m[7] ? 'dir' : 'lab';
      out += '<span class="t-' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
      if (m[0] === '') HL_RE.lastIndex++;
    }
    return out + esc(line.slice(last));
  }
  function codeBlock(source, o) {
    o = o || {};
    const lines = source.split('\n');
    const pre = h('pre', { class: 'code' });
    lines.forEach((l, i) => {
      const cls = ['cl'];
      if (o.mark && o.mark.has(i)) cls.push('ul');
      if (o.cur === i) cls.push('cur'); else if (o.done === i) cls.push('done');
      if (o.sel === i) cls.push('sel');
      if (o.onClick) cls.push('click');
      const inner = hl(l) || ' ';
      const tx = h('span', { class: 'tx', html: (o.mark && o.mark.has(i)) ? '<span class="ulw">' + inner + '</span>' : inner });
      const row = h('div', { class: cls.join(' '), 'data-line': i }, h('span', { class: 'ln' }, i + 1), tx);
      if (o.onClick) row.addEventListener('click', () => o.onClick(i));
      pre.append(row);
    });
    return pre;
  }

  /* ---------- shared tables ---------- */
  function ptrRegsUsed(run) {
    const used = [];
    for (const [nm, idx] of [['SI', 6], ['DI', 7], ['BX', 3]]) {
      if (run.steps.some(s => s.regs[idx] !== run.initial.regs[idx]) && (nm !== 'BX' || run.steps.some(s => s.item && s.item.ops.some(o => o.t === 'mem' && o.regs.includes('bx'))))) used.push([nm, idx]);
    }
    return used;
  }
  function posTxt(prog, v) { const n = Emu.memName(prog, v); return n ? n + ' (' + Emu.hx(v, 16) + ')' : Emu.hx(v, 16); }

  function iterTable(prog, run, onRow) {
    const its = Emu.iterations(prog, run);
    const ptrs = ptrRegsUsed(run);
    const head = h('tr', null, h('th', null, 'Vuelta'), h('th', null, 'AL leído'), h('th', null, 'Saltos condicionales'), h('th', null, '¿Guardó?'), ...ptrs.map(p => h('th', null, p[0] + ' al final')), h('th', null, 'CX'));
    const body = its.map((it, n) => {
      const rd = it.find(s => s.item && s.item.op === 'mov' && s.item.ops[0].t === 'r8' && s.item.ops[0].name === 'AL' && s.item.ops[1].t === 'mem');
      let alTxt = '—';
      if (rd) {
        const v = rd.regs[0] & 0xFF; const sa = rd.regs[6]; const ext = prog.extents.find(e => sa >= e.addr && sa < e.addr + e.len);
        alTxt = v + (ext && ext.isText && v >= 32 && v < 127 ? " '" + String.fromCharCode(v) + "'" : '') + ' (' + Emu.hx(v, 8) + ')';
      }
      const jumps = it.filter(s => Emu.COND[s.op]).map(s => s.op + ': ' + (s.taken ? 'salta' : 'no salta')).join(' · ') || '—';
      const writes = it.flatMap(s => s.writes.map(w => w.val + ' → ' + (Emu.memName(prog, w.addr) || Emu.hx(w.addr, 16))));
      const last = it[it.length - 1];
      return h('tr', { class: onRow ? 'click' : '', onclick: onRow ? () => onRow(it[it.length - 1].n) : null },
        h('td', null, n + 1), h('td', null, alTxt), h('td', null, jumps), h('td', null, writes.length ? 'Sí: ' + writes.join(', ') : 'No'),
        ...ptrs.map(p => h('td', null, posTxt(prog, last.regs[p[1]]))), h('td', null, last.regs[1]));
    });
    return h('div', { class: 'tscroll' }, h('table', null, h('thead', null, head), h('tbody', null, body)));
  }

  function sectorMap(prog) {
    const L = prog.layout; const sig = L.sigBytes; const data = L.dataBytes - sig;
    const seg = (cls, n, label) => n > 0 ? h('div', { class: cls, style: 'flex:' + n + ' 1 0', title: label + ': ' + n + ' bytes' }, n >= 14 ? label + ' ' + n : '') : null;
    const bar = h('div', { class: 'secmap' }, seg('seg-code', L.codeBytes, 'código'), seg('seg-data', data, 'datos'), seg('seg-pad', L.padBytes, '00 00 00 …'), seg('seg-sig', sig, '55 AA'));
    const tail = (a) => Emu.hx(prog.mem[a], 8).replace('h', '');
    return h('div', null, bar,
      h('div', { class: 'legend' }, h('span', null, h('i', { class: 'seg-code' }), 'código (' + L.codeBytes + ' B)'), h('span', null, h('i', { class: 'seg-data' }), 'datos (' + data + ' B)'), h('span', null, h('i', { class: 'seg-pad' }), 'relleno con ceros (' + L.padBytes + ' B)'), h('span', null, h('i', { class: 'seg-sig' }), 'firma (' + sig + ' B)')),
      h('p', { class: 'small muted' }, 'Tamaño total: ' + L.total + ' bytes' + (L.total === 512 ? ' (un sector exacto ✔)' : ' (¡debería ser 512!)') + '.  Últimos bytes del sector — dirección ' + Emu.hx(prog.end - 2, 16) + ': ' + tail(prog.end - 2) + ' ' + tail(prog.end - 1) + (sig ? '  ← la firma 55h AAh que busca el BIOS.' : '  ← sin firma 55h AAh el BIOS NO arranca este sector.') + ' (Los tamaños del código son aproximados a la codificación real del 8086.)'));
  }

  /* ---------- simulator ---------- */
  const PRESETS = () => {
    const list = [];
    for (const e of Programs.EXAMS) list.push({ group: '1ª prueba · Pregunta 3 (traceo)', label: 'Batería ' + e.bat + ' ' + e.year, source: e.source });
    for (const e of Programs.EXAMS) for (const v of e.variants) list.push({ group: '1ª prueba · variantes del apartado d)', label: 'Batería ' + e.bat + ' ' + e.year + ' — variante d) ' + v.label, source: Programs.applyVariant(e.source, v) });
    if (root.Programs2) {
      for (const e of root.Programs2.EXAMS2) {
        if (e.kind === 'complete') list.push({ group: '2ª prueba · Interrupciones y temporizador (prioridad)', label: 'Batería ' + e.bat + ' · Pregunta 3 resuelta — ' + (e.bat === 'A' ? 'columnas' : 'filas') + ' que cambian de color cada segundo', source: e.source, opts: { timer: e.timer, demo: true, maxSteps: 3200 } });
        else for (const sc of e.scenarios) list.push({ group: '2ª prueba · Video y teclado (incluido, no entra)', label: 'Batería ' + e.bat + ' · Pregunta 2 — ' + sc.label, source: e.source, opts: { events: sc.events, maxSteps: 3000 } });
      }
    }
    return list;
  };
  const EGA = ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA', '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'];
  function vgaRGB(i) {
    if (i < 16) { const c = EGA[i]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
    if (i < 32) { const g = [0, 5, 8, 11, 14, 17, 20, 24, 28, 32, 36, 40, 45, 50, 56, 63][i - 16] * 4; return [g, g, g]; }
    // 32..247: hue cycle (approximation of the default VGA palette)
    const n = i - 32, grp = Math.floor(n / 24), pos = n % 24, hue = (240 + pos * 15) % 360, sat = [1, 0.5, 0.25][grp % 3], val = [1, 0.5, 0.28][Math.floor(grp / 3) % 3];
    const c = val * sat, x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = val - c; let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; } else if (hue < 120) { r = x; g = c; } else if (hue < 180) { g = c; b = x; } else if (hue < 240) { g = x; b = c; } else if (hue < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function screenCanvas(sc) {
    const cv = h('canvas', { class: 'screen', width: sc.mode === 'text' ? 640 : 320, height: sc.mode === 'text' ? 400 : 200, role: 'img', 'aria-label': sc.mode === 'text' ? 'Pantalla en modo texto 80 por 25' : 'Pantalla en modo gráfico 320 por 200' });
    const ctx = cv.getContext('2d');
    if (sc.mode === 'text') {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 400); ctx.font = '15px ui-monospace, Menlo, Consolas, monospace'; ctx.textBaseline = 'alphabetic';
      for (let r = 0; r < 25; r++) for (let c = 0; c < 80; c++) {
        const i = r * 80 + c, ch = sc.chars[i], at = sc.attrs[i];
        if ((at >> 4) & 0xF) { ctx.fillStyle = EGA[(at >> 4) & 0xF]; ctx.fillRect(c * 8, r * 16, 8, 16); }
        if (ch !== 0x20 && ch !== 0) { ctx.fillStyle = EGA[at & 0xF]; ctx.fillText(String.fromCharCode(ch), c * 8, r * 16 + 13); }
      }
    } else {
      const img = ctx.createImageData(320, 200); const cache = {};
      for (let i = 0; i < 64000; i++) { const v = sc.gfx[i]; const c = cache[v] || (cache[v] = vgaRGB(v)); img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }
    return cv;
  }
  function ivtAt(run, k) {
    const mem = {}; for (let i = 0; i < k && i < run.steps.length; i++) for (const w of run.steps[i].writes) if (w.addr < 0x400) for (let b = 0; b < w.bits / 8; b++) mem[w.addr + b] = Math.floor(w.val / Math.pow(256, b)) & 0xFF;
    const out = []; for (let n = 0; n < 256; n++) { const off = (mem[n * 4] || 0) | ((mem[n * 4 + 1] || 0) << 8), seg = (mem[n * 4 + 2] || 0) | ((mem[n * 4 + 3] || 0) << 8); if ((n * 4 in mem) || (n * 4 + 2 in mem)) out.push({ n, off, seg, partial: !((n * 4 in mem) && (n * 4 + 2 in mem)) }); }
    return out;
  }

  const INFO_HALT = new Set(['wait-key', 'demo']);
  function Sim() {
    let src = '', title = '', prog = null, run = null, k = 0, editing = false, timer = null, tab = 'steps', draft = '', runOpts = null;
    const rootEl = h('div');
    const presets = PRESETS();

    function assemble() {
      stop();
      prog = Emu.assemble(src);
      run = prog.ok ? Emu.run(prog, Object.assign({ maxSteps: 5000 }, runOpts || {})) : null;
      k = 0;
    }
    function load(source, ttl, opts) { src = source; draft = source; title = ttl || ''; runOpts = opts || null; editing = false; assemble(); render(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function total() { return run ? run.steps.length : 0; }
    function go(n) { k = Math.max(0, Math.min(total(), n)); render(); }
    function nextLoopEnd() {
      let i = k; while (i < total()) { const s = run.steps[i]; i++; if (s.op === 'loop' || (s.taken && s.next <= s.ip)) break; } go(i);
    }
    function play() {
      if (timer) { stop(); render(); return; }
      if (k >= total()) k = 0;
      timer = setInterval(() => { if (k >= total()) { stop(); render(); return; } k++; render(); }, 520);
      render();
    }

    function stateAt(i) { return i === 0 ? run.initial : run.steps[i - 1]; }

    function regsPanel(st, prev) {
      const R = (name, idx, ptr) => {
        const v = st.regs[idx], pv = prev.regs[idx];
        const sub = [];
        if (!ptr) sub.push('AH=' + ((v >> 8) & 0xFF) + '  AL=' + (v & 0xFF));
        else { const n = Emu.memName(prog, v); sub.push(n ? '→ ' + n : '(' + v + ')'); }
        const el = h('div', { class: 'reg' + (v !== pv ? ' chg' : '') }, h('div', { class: 'nm' }, name), h('div', { class: 'hx' }, Emu.hx(v, 16)), h('div', { class: 'sub' }, sub[0].replace('AH', name[0] + 'H').replace('AL', name[0] + 'L')));
        return el;
      };
      const use32 = run.steps.some(s => s.regs[3] > 0xFFFF);
      const E = () => { const v = st.regs[3] >>> 0, pv = prev.regs[3] >>> 0; return h('div', { class: 'reg' + (v !== pv ? ' chg' : ''), style: 'grid-column: span 2' }, h('div', { class: 'nm' }, 'EBX'), h('div', { class: 'hx' }, Emu.hx(v, 32)), h('div', { class: 'sub' }, [3, 2, 1, 0].map(b => Emu.hx((v >>> (8 * b)) & 0xFF, 8)).join(' · ') + '  (4 bytes = 4 píxeles)')); };
      return h('div', { class: 'regs' }, R('AX', 0), use32 ? E() : R('BX', 3, 'p'), R('CX', 1), R('DX', 2), R('SI', 6, 'p'), R('DI', 7, 'p'));
    }
    function flagsPanel(st, prev) {
      return h('div', { class: 'flags' }, ...['ZF', 'CF', 'SF', 'OF', 'PF', 'IF'].map(f => h('span', { class: 'flag' + (st.flags[f] ? ' on' : '') + (st.flags[f] !== prev.flags[f] ? ' chg' : ''), title: { ZF: 'Zero: resultado = 0', CF: 'Carry: acarreo/préstamo (sin signo)', SF: 'Signo: bit más alto = 1', OF: 'Overflow (con signo)', PF: 'Paridad del byte bajo', IF: 'Interrupt Flag: 1 = el procesador atiende interrupciones (STI/CLI)' }[f] }, f + '=' + (st.flags[f] || 0))));
    }
    function memPanel(st, prev) {
      const ptrs = [['SI', 6], ['DI', 7], ['BX', 3]];
      return h('div', null, prog.extents.map(e => {
        const cells = [];
        const hasPtr = ptrs.some(([, r]) => st.regs[r] >= e.addr && st.regs[r] < e.addr + e.len);
        for (let a = e.addr; a < e.addr + e.len; a++) {
          const o = a - prog.start; const v = st.mem[o]; const pv = prev.mem[o];
          const tags = ptrs.filter(([n, r]) => st.regs[r] === a && (n !== 'BX' || run.steps.some(s => s.item && s.item.ops.some(op => op.t === 'mem' && op.regs.includes('bx'))))).map(([n]) => n);
          const showChar = e.isText && v >= 32 && v < 127;
          cells.push(h('div', { class: 'cell' + (v !== pv ? ' chg' : '') }, h('div', { class: 'i' }, '+' + (a - e.addr)), h('div', { class: 'v' }, showChar ? String.fromCharCode(v) : v), h('div', { class: 'x' }, showChar ? v + ' · ' + Emu.hx(v, 8) : Emu.hx(v, 8)), tags.length ? h('div', { class: 'ptr' }, '▲' + tags.join(',')) : null));
        }
        return h('div', { class: 'mem' }, h('div', { class: 'lab' }, e.label + '  @' + Emu.hx(e.addr, 16)), h('div', { class: 'cells' + (hasPtr ? ' hasptr' : '') }, cells));
      }));
    }

    function extraPanels(st) {
      const out = [];
      const ivt = ivtAt(run, k);
      if (ivt.length) {
        const nameAt = off => { const l = prog.labelInfo.find(x => x.addr === off && x.kind === 'code'); return l ? '  = ' + l.name : ''; };
        const rows = ivt.map(e => h('tr', null,
          h('td', null, 'INT ' + e.n + (e.n === 8 ? ' · IRQ0 temporizador' : e.n === 9 ? ' · IRQ1 teclado' : '')),
          h('td', null, '4 × ' + e.n + ' = ' + Emu.hx(e.n * 4, 16)),
          h('td', null, Emu.hx(e.seg, 16) + ':' + Emu.hx(e.off, 16) + (e.partial ? '  (falta guardar el segmento)' : nameAt(e.off)))));
        out.push(h('div', { class: 'mem' }, h('div', { class: 'lab' }, 'Tabla de vectores de interrupción (0000:0000) — entradas usadas'),
          h('table', null, h('thead', null, h('tr', null, ['Vector', 'Dirección', 'Rutina (CS:IP)'].map(t => h('th', null, t)))), h('tbody', null, rows))));
      }
      const sp = st.regs[4] & 0xFFFF;
      if (sp !== prog.start) out.push(h('div', { class: 'mem' }, h('div', { class: 'lab' }, 'Pila (SS:SP = 0000:' + Emu.hx(sp, 16) + ')'), h('div', { class: 'cells' }, ['IP', 'CS', 'FLAGS'].map((nm, i) => h('div', { class: 'cell' }, h('div', { class: 'i' }, i === 0 ? 'SP (tope)' : '+' + 2 * i), h('div', { class: 'v' }, Emu.hx(st.stack[i], 16)), h('div', { class: 'x' }, nm))))));
      if (Emu.usesVideo(run)) {
        const sc = Emu.screenAt(run, k);
        out.push(h('div', { class: 'mem' }, h('div', { class: 'lab' }, 'Pantalla — ' + (sc.mode === 'text' ? 'modo texto 80 × 25' : 'modo gráfico 13h, 320 × 200, 256 colores')), screenCanvas(sc)));
      }
      return out;
    }

    function render() {
      rootEl.innerHTML = '';
      const sel = h('select', { 'aria-label': 'Programa', onchange: ev => { const p = presets[+ev.target.value]; if (p) load(p.source, p.label, p.opts); } },
        h('option', { value: '' }, title && !presets.some(p => p.label === title) ? title : '— elige un programa —'),
        ...[...new Set(presets.map(p => p.group))].map(g => h('optgroup', { label: g }, ...presets.map((p, i) => ({ p, i })).filter(o => o.p.group === g).map(({ p, i }) => h('option', { value: i, selected: p.label === title }, p.label)))));
      const tb = h('div', { class: 'toolbar' }, sel,
        h('button', { class: 'btn', onclick: () => { editing = !editing; if (editing) draft = src; render(); } }, editing ? 'Cancelar edición' : '✎ Editar código'));
      rootEl.append(tb);

      if (editing) {
        const ta = h('textarea', { class: 'src', spellcheck: 'false', 'aria-label': 'Código fuente' }); ta.value = draft;
        ta.addEventListener('input', () => { draft = ta.value; });
        ta.addEventListener('keydown', ev => { if (ev.key === 'Tab') { ev.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); draft = ta.value; } });
        rootEl.append(ta, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn primary', onclick: () => { src = draft; title = 'Programa propio'; editing = false; assemble(); render(); } }, 'Ensamblar y cargar'), h('span', { class: 'muted small' }, 'Soporta mov, add, sub, inc, dec, and, or, xor, not, neg, test, cmp, shl, shr, xchg, loop, jmp y todos los saltos j…; db/dw/dup/times/org; @@ @f @b.')));
        return;
      }
      if (!prog) { rootEl.append(h('p', { class: 'muted' }, 'Elige un programa para empezar.')); return; }
      if (!prog.ok) {
        rootEl.append(h('div', { class: 'error' }, 'Error de ensamblado' + (prog.line != null ? ' (línea ' + (prog.line + 1) + ')' : '') + ': ' + prog.error), codeBlock(src, { cur: prog.line }));
        return;
      }
      const st = stateAt(k), prev = stateAt(Math.max(0, k - 1));
      const finished = k === total();
      const ip = k === 0 ? prog.start : st.next;
      const nextIt = finished && run.halted.reason !== 'limit' && run.halted.reason !== 'noins' ? null : prog.byAddr.get(ip);
      const lastLine = k > 0 ? run.steps[k - 1].line : null;

      const ctl = h('div', { class: 'toolbar' },
        h('button', { class: 'btn', onclick: () => go(0), disabled: k === 0 }, '⏮ Reiniciar'),
        h('button', { class: 'btn', onclick: () => go(k - 1), disabled: k === 0 }, '◀ Atrás'),
        h('button', { class: 'btn primary', onclick: () => go(k + 1), disabled: finished }, 'Paso ▶'),
        h('button', { class: 'btn', onclick: nextLoopEnd, disabled: finished }, 'Hasta fin de vuelta ⏩'),
        h('button', { class: 'btn', onclick: () => go(total()), disabled: finished }, 'Final ⏭'),
        h('button', { class: 'btn', onclick: play }, timer ? '⏸ Pausa' : '▶▶ Auto'),
        h('span', { class: 'muted small' }, 'Paso ' + k + ' / ' + total() + '  ·  atajos: ← →'));
      rootEl.append(ctl);

      let ex;
      if (k === 0) ex = h('div', { class: 'explain' }, h('div', { class: 'step' }, 'Estado inicial'), h('div', null, 'El BIOS acaba de copiar el sector a ' + Emu.hx(prog.start, 16) + ' y salta ahí. Los registros se muestran en 0 (en una máquina real tienen valores desconocidos, por eso el programa los inicializa).'), nextIt ? h('div', { class: 'next' }, 'Siguiente instrucción: ', h('code', null, nextIt.text)) : null);
      else {
        const s = run.steps[k - 1];
        ex = h('div', { class: 'explain' }, h('div', { class: 'step' }, 'Paso ' + s.n + ' · IP = ' + Emu.hx(s.ip, 16) + (s.line != null ? ' · línea ' + (s.line + 1) : ' · INTERRUPCIÓN DE HARDWARE')), h('div', { class: 'ins' }, s.text), h('div', null, s.explain),
          finished ? h('div', { class: 'next halt' }, run.halted.reason === 'jmp $' ? '✔ Fin de la simulación: el programa se detuvo en «jmp $».' : INFO_HALT.has(run.halted.reason) ? 'ℹ ' + run.halted.msg : '⚠ ' + run.halted.msg) : (nextIt ? h('div', { class: 'next' }, 'Siguiente: ', h('code', null, nextIt.text)) : null));
      }
      const left = h('div', null, codeBlock(src, { cur: nextIt ? nextIt.line : null, done: lastLine, onClick: null }));
      const right = h('div', null, ex, regsPanel(st, prev), flagsPanel(st, prev), memPanel(st, prev), ...extraPanels(st));
      rootEl.append(h('div', { class: 'sim' }, left, right));

      const tabs = h('div', { class: 'tabs', role: 'tablist' },
        ...[['steps', 'Traza por pasos'], ['iter', 'Traza por vueltas'], ['map', 'Mapa del sector']].map(([id, lb]) => h('button', { role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', onclick: () => { tab = id; render(); } }, lb)));
      rootEl.append(tabs);
      if (tab === 'steps') {
        const rows = run.steps.map(s => h('tr', { class: 'click' + (s.n === k ? ' hl' : ''), onclick: () => go(s.n), 'data-n': s.n }, h('td', null, s.n), h('td', null, h('code', null, s.text)), h('td', null, s.explain)));
        const wrap = h('div', { class: 'tscroll', style: 'max-height:420px;overflow-y:auto' }, h('table', null, h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Instrucción'), h('th', null, 'Qué ocurre'))), h('tbody', null, rows)));
        rootEl.append(wrap);
        const cur = wrap.querySelector('tr.hl'); if (cur) wrap.scrollTop = Math.max(0, cur.offsetTop - 120);
      } else if (tab === 'iter') {
        rootEl.append(h('p', { class: 'muted small' }, 'Una fila por vuelta del ciclo — es el formato típico de un traceo en la prueba. Pulsa una fila para saltar a ese punto.'), iterTable(prog, run, n => go(n)));
      } else rootEl.append(sectorMap(prog));
      if (!INFO_HALT.has(run.halted.reason) && run.halted.reason !== 'jmp $') rootEl.append(h('div', { class: 'error' }, run.halted.msg));
      if (runOpts && (runOpts.timer || runOpts.events)) rootEl.append(h('p', { class: 'muted small' }, 'Tiempo simulado: ' + (runOpts.timer ? 'una interrupción del temporizador (IRQ0) cada ' + runOpts.timer.period + ' instrucciones (en un PC real son 18.2 por segundo). ' : '') + (runOpts.events ? 'Eventos de teclado programados: ' + runOpts.events.map(e => 'scan code ' + Emu.hx(e.scan, 8) + ' tras ' + e.at + ' instrucciones').join('; ') + '.' : '')));
    }

    document.addEventListener('keydown', ev => {
      if (!rootEl.isConnected || editing || !run) return;
      if (/^(input|textarea|select)$/i.test(document.activeElement && document.activeElement.tagName)) return;
      if (ev.key === 'ArrowRight') { go(k + 1); ev.preventDefault(); } else if (ev.key === 'ArrowLeft') { go(k - 1); ev.preventDefault(); }
    });

    return { el: rootEl, load, render, stop, get loaded() { return !!prog; } };
  }

  /* ---------- exercise renderer ---------- */
  const LET = 'ABCD';
  function renderExercise(ex, host, hooks) {
    hooks = hooks || {};
    host.innerHTML = '';
    let answered = false;
    const record = ok => { if (!answered) { answered = true; if (hooks.onResult) hooks.onResult(ex.cat, ok); } };
    const card = h('div', { class: 'card' });
    card.append(h('div', { class: 'row' }, h('span', { class: 'tag' }, ex.title), ex.type === 'predict' && ex.original ? h('span', { class: 'tag warn' }, 'variante d)') : null));
    if (ex.statement) card.append(h('div', { class: 'callout' }, ex.statement));
    card.append(h('div', { class: 'prompt' }, ex.prompt));
    if (ex.questions && ex.questions.length) card.append(h('ul', { style: 'margin:6px 0 10px' }, ex.questions.map(q => h('li', null, q))));
    if (ex.code) card.append(codeBlock(ex.code, { mark: ex.mark != null ? new Set([ex.mark]) : null }));
    const out = h('div');
    const actions = h('div', { class: 'row', style: 'margin-top:10px' });

    function solutionBar(source, label) {
      if (!source || !hooks.openSim) return null;
      return h('button', { class: 'btn sm', onclick: () => hooks.openSim(source, label || 'Ejercicio', ex.runOpts) }, '🔍 Ver paso a paso en el simulador');
    }
    function feedback(ok, msg, extra) {
      out.innerHTML = '';
      out.append(h('div', { class: 'feedback ' + (ok ? 'ok' : 'no') }, h('b', null, ok ? '✔ Correcto. ' : '✘ No es correcto. '), msg || ''), extra || null);
    }

    if (ex.type === 'mcq') {
      const opts = h('div', { class: 'opts' });
      ex.opts.forEach((t, i) => {
        const b = h('button', { class: 'opt', onclick: () => {
          const ok = i === ex.ans;
          [...opts.children].forEach((c, j) => { c.disabled = true; if (j === ex.ans) c.classList.add('ok'); else if (j === i) c.classList.add('no'); });
          record(ok);
          feedback(ok, ok ? ex.why : 'La respuesta correcta es la ' + LET[ex.ans] + '. ' + ex.why, h('div', null, (root.Fx && ex.fxIds) ? ex.fxIds.map(id => root.Fx.byId(id)).filter(Boolean).map(it => h('div', null, h('div', { class: 'fx', html: it.math }), h('div', { class: 'small muted' }, it.donde))) : null, h('div', { class: 'row', style: 'margin-top:8px' }, solutionBar(ex.runSource, 'Ejercicio'))));
        } }, h('span', { class: 'l' }, LET[i] + ')'), h('span', null, t));
        opts.append(b);
      });
      card.append(opts);
    } else if (ex.type === 'numeric') {
      const inp = h('input', { type: 'text', placeholder: 'Tu respuesta', 'aria-label': 'Respuesta', autocomplete: 'off', spellcheck: 'false' });
      const check = () => {
        const v = Ex.parseIn(inp.value, ex.base); const want = Ex.parseIn(ex.answer, ex.base);
        if (Number.isNaN(v)) { feedback(false, 'No pude leer tu respuesta (' + (ex.base === 16 ? 'hex, p. ej. 3Ah' : ex.base === 2 ? 'binario, solo 0 y 1' : 'un número decimal') + ').'); return; }
        const ok = v === want; inp.classList.toggle('ok', ok); inp.classList.toggle('no', !ok); record(ok);
        feedback(ok, (ok ? '' : 'La respuesta era ' + ex.answer + (ex.base === 16 ? 'h' : ex.base === 2 ? 'b' : '') + '. ') + ex.why, h('div', { class: 'row', style: 'margin-top:8px' }, solutionBar(ex.code, 'Ejercicio')));
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
      card.append(h('div', { class: 'ans-row' }, inp, h('button', { class: 'btn primary', onclick: check }, 'Comprobar')));
    } else if (ex.type === 'predict') {
      const inputs = {};
      const fields = ex.regs ? ex.regs : ex.asks;
      fields.forEach(lab => {
        const inp = h('input', { type: 'text', placeholder: ex.regs ? 'valor decimal' : ex.text ? 'cadena, p. ej. ABCdef' : 'valores separados por comas: 3, 0, 15, …', 'aria-label': lab, autocomplete: 'off', spellcheck: 'false' });
        inputs[lab] = inp;
        card.append(h('div', { class: 'ans-row' }, h('label', null, lab + ' ='), inp));
      });
      const check = () => {
        let all = true; const lines = [];
        fields.forEach(lab => {
          let ok;
          if (ex.regs) { const v = Ex.parseIn(inputs[lab].value, 10); ok = v === ex.answer[lab]; lines.push(lab + ' = ' + ex.answer[lab]); }
          else {
            const u = Ex.parseList(inputs[lab].value, ex.text); ok = Ex.checkList(u, ex.answer[lab], ex.text).ok;
            lines.push(lab + ' = ' + (ex.text ? "'" + ex.answer[lab] + "'" : '[' + ex.answer[lab].join(', ') + ']'));
          }
          inputs[lab].classList.toggle('ok', ok); inputs[lab].classList.toggle('no', !ok); all = all && ok;
        });
        record(all);
        feedback(all, all ? '¡Bien trazado!' : 'Revisa la traza (el simulador te muestra cada paso).', h('div', null, h('div', { class: 'small muted' }, 'Respuesta correcta:'), lines.map(l => h('div', null, h('span', { class: 'pill-arr' }, l))), h('div', { class: 'row', style: 'margin-top:8px' }, solutionBar(ex.runSource, ex.original ? 'Variante d)' : 'Ejercicio'))));
      };
      Object.values(inputs).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') check(); }));
      actions.append(h('button', { class: 'btn primary', onclick: check }, 'Comprobar'));
      if (ex.hint) { const hb = h('div', { class: 'callout hint', hidden: true }, '💡 ' + ex.hint); actions.append(h('button', { class: 'btn', onclick: () => { hb.hidden = !hb.hidden; } }, 'Pista')); card.append(hb); }
      if (ex.original) card.append(h('details', null, h('summary', null, 'Estás resolviendo la variante d): ¿qué cambió respecto al original?'), h('div', { class: 'inner' }, h('p', { class: 'small muted' }, 'El código mostrado es el ORIGINAL; aplica el cambio del enunciado antes de trazar.'))));
    } else if (ex.type === 'calc') {
      const DDR = root.DDR; const inputs = {};
      ex.fields.forEach(f => {
        const inp = h('input', { type: 'text', placeholder: f.placeholder || (f.kind === 'text' ? 'p. ej. PC3-12800' : f.exact ? 'número entero' : 'número (acepta coma o punto)'), 'aria-label': f.label, autocomplete: 'off', spellcheck: 'false' });
        inputs[f.key] = inp;
        card.append(h('div', { class: 'ans-row' }, h('label', null, f.label), inp, f.unit ? h('span', { class: 'muted' }, f.unit) : null));
      });
      const check = () => {
        let all = true; const blocks = [];
        ex.fields.forEach(f => {
          const ok = DDR.checkField(f, inputs[f.key].value); inputs[f.key].classList.toggle('ok', ok); inputs[f.key].classList.toggle('no', !ok); all = all && ok;
          const fxl = !root.Fx ? [] : (ex.p && 'abcdef'.includes(f.key)) ? root.Fx.forPart(ex.p, DDR.solve(ex.p))[f.key].map(m => h('div', { class: 'fx', html: m })) : (f.fxIds || []).map(id => root.Fx.byId(id)).filter(Boolean).map(it => h('div', null, h('div', { class: 'fx', html: it.math }), h('div', { class: 'small muted' }, it.donde)));
          blocks.push(h('details', { open: ok ? null : true }, h('summary', null, (ok ? '✔ ' : '✘ ') + f.label + ' ' + (f.display != null ? f.display : f.kind === 'text' ? f.answer : DDR.fmt(f.answer) + ' ' + f.unit)), h('div', { class: 'inner' }, fxl, f.steps.map(t => h('div', { class: fxl.length ? 'small muted' : '', style: 'margin:4px 0' }, t)))));
        });
        record(all);
        feedback(all, all ? 'Todo bien.' : 'Revisa las que están en rojo; abajo tienes el desarrollo.', h('div', null, blocks, ex.tip ? h('div', { class: 'callout warn' }, ex.tip) : null));
      };
      Object.values(inputs).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') check(); }));
      actions.append(h('button', { class: 'btn primary', onclick: check }, 'Comprobar'));
      const hb = h('div', { class: 'callout hint', hidden: true, html: root.Fx ? root.Fx.compact().map(([k, m]) => '<div class="fxrow"><b>' + k + '</b><span class="fx">' + m + '</span></div>').join('') + '<div class="small">b) si no sale entero, se redondea hacia arriba · d) N ÷ MT/s sale en µs → ×1000 = ns</div>' : 'a) t = ciclos / f · b) N = ⌈D / (8c)⌉ · c) f_bus = MT/s / 2 · d) t = N / MT/s · e) PCn-X ⇔ DDRn-(X/8) · f) a) + d)' });
      actions.append(h('button', { class: 'btn', onclick: () => { hb.hidden = !hb.hidden; } }, 'Fórmulas')); card.append(hb);
    } else if (ex.type === 'fill') {
      const sels = ex.slots.map((s, k) => {
        const sel = h('select', { 'aria-label': 'Hueco ' + (k + 1) }, h('option', { value: '' }, '— elige —'), ...s.opts.map((o, j) => h('option', { value: j }, o)));
        card.append(h('div', { class: 'ans-row' }, h('label', null, '(' + (k + 1) + ')'), sel)); return sel;
      });
      const check = () => {
        if (sels.some(s => s.value === '')) { out.innerHTML = ''; out.append(h('div', { class: 'callout warn' }, 'Elige una opción en cada hueco.')); return; }
        const ch = sels.map(s => +s.value); const ok = ex.verify(ch);
        sels.forEach((s, k) => { const good = ch[k] === ex.slots[k].ans; s.classList.toggle('ok', good); s.classList.toggle('no', !good); });
        record(ok);
        const exact = ch.every((c, k) => c === ex.slots[k].ans);
        feedback(ok, ok ? (exact ? 'El programa produce el resultado esperado.' : 'Tu versión no es la original pero se comporta igual: el resultado coincide.') : 'Al ejecutar tu versión el resultado NO es el esperado.',
          h('div', null, ex.slots.map((s, k) => h('div', { style: 'margin:8px 0' }, h('b', null, '(' + (k + 1) + ') '), h('code', null, s.orig), h('div', { class: 'small' }, (s.why[0] ? s.why[0] + ' — ' : '') + s.why[1]))),
            h('details', null, h('summary', null, 'Ver el programa completo'), h('div', { class: 'inner' }, codeBlock(ex.full))), h('div', { class: 'row', style: 'margin-top:8px' }, solutionBar(ex.runSource, 'Ejercicio'))));
      };
      actions.append(h('button', { class: 'btn primary', onclick: check }, 'Comprobar'));
      if (ex.hint) { const hb = h('div', { class: 'callout hint', hidden: true }, '💡 ' + ex.hint); actions.append(h('button', { class: 'btn', onclick: () => { hb.hidden = !hb.hidden; } }, 'Pista')); card.append(hb); }
    } else if (ex.type === 'tracestep') {
      const ins = [];
      const tableFor = (inputs) => {
        const tbl = h('table'); tbl.append(h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Instrucción'), ex.cols.map(c => h('th', null, c.label)))));
        const body = h('tbody');
        ex.rows.forEach((r, ri) => {
          const tr = h('tr', null, h('td', null, ri + 1), h('td', null, h('code', null, r.ins)));
          const rowIns = {};
          ex.cols.forEach(c => {
            const cell = r.cells[c.key];
            if (inputs && cell.ask) { const inp = h('input', { type: 'text', class: 'trace-in', 'aria-label': c.label + ' tras ' + r.ins, autocomplete: 'off', spellcheck: 'false' }); rowIns[c.key] = inp; tr.append(h('td', null, inp)); }
            else tr.append(h('td', { class: cell.ask ? '' : 'muted', style: !inputs && cell.ask ? 'font-weight:700;color:var(--good)' : null }, cell.v));
          });
          if (inputs) ins.push(rowIns); body.append(tr);
        });
        tbl.append(body); return h('div', { class: 'tscroll' }, tbl);
      };
      card.append(tableFor(true));
      const check = () => {
        let all = true; let wrong = 0, total = 0;
        ex.rows.forEach((r, ri) => ex.cols.forEach(c => {
          const inp = ins[ri][c.key]; if (!inp) return; const want = r.cells[c.key].v; total++;
          const ok = (c.key === 'al' && ex.text) ? inp.value === want : Ex.parseIn(inp.value, 10) === Ex.parseIn(want, 10);
          inp.classList.toggle('ok', ok); inp.classList.toggle('no', !ok); if (!ok) { all = false; wrong++; inp.title = 'Correcto: ' + want; }
        }));
        record(all);
        feedback(all, all ? 'Traza perfecta (' + total + ' celdas).' : wrong + ' de ' + total + ' celdas están mal (en rojo; pasa el ratón para ver el valor correcto). Esta es la tabla correcta (en verde lo que te tocaba rellenar):', h('div', null, tableFor(false), h('div', { class: 'row', style: 'margin-top:8px' }, solutionBar(ex.runSource, 'Ejercicio'))));
      };
      actions.append(h('button', { class: 'btn primary', onclick: check }, 'Comprobar'));
      if (ex.hint) { const hb = h('div', { class: 'callout hint', hidden: true }, '💡 ' + ex.hint); actions.append(h('button', { class: 'btn', onclick: () => { hb.hidden = !hb.hidden; } }, 'Pista')); card.append(hb); }
    } else if (ex.type === 'trace') {
      const tbl = h('table'); const ins = [];
      tbl.append(h('thead', null, h('tr', null, h('th', null, 'Vuelta'), ex.cols.map(c => h('th', null, c.label)))));
      const body = h('tbody');
      ex.rows.forEach((r, ri) => {
        const tr = h('tr', null, h('td', null, ri + 1));
        const rowIns = {};
        ex.cols.forEach(c => {
          const inp = c.yn ? h('select', { 'aria-label': c.label }, h('option', { value: '' }, '—'), h('option', { value: 'Sí' }, 'Sí'), h('option', { value: 'No' }, 'No')) : h('input', { type: 'text', class: 'trace-in', 'aria-label': c.label, autocomplete: 'off', spellcheck: 'false' });
          rowIns[c.key] = inp; tr.append(h('td', null, inp));
        });
        ins.push(rowIns); body.append(tr);
      });
      tbl.append(body); card.append(h('div', { class: 'tscroll' }, tbl));
      const check = () => {
        let all = true;
        ex.rows.forEach((r, ri) => ex.cols.forEach(c => {
          const inp = ins[ri][c.key]; const want = r[c.key]; let ok;
          if (c.yn) ok = inp.value === want; else if (c.key === 'al' && ex.text) ok = inp.value === want; else { const v = Ex.parseIn(inp.value, 10); ok = v === Ex.parseIn(want, 10); }
          inp.classList.toggle('ok', ok); inp.classList.toggle('no', !ok); all = all && ok; if (!ok) inp.title = 'Correcto: ' + want;
        }));
        record(all);
        const sol = h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Vuelta'), ex.cols.map(c => h('th', null, c.label)))), h('tbody', null, ex.rows.map((r, ri) => h('tr', null, h('td', null, ri + 1), ex.cols.map(c => h('td', null, r[c.key])))))));
        feedback(all, all ? 'Traza perfecta.' : 'Las celdas en rojo no coinciden (pasa el ratón para ver el valor correcto). Esta es la tabla correcta:', h('div', null, sol, h('div', { class: 'row', style: 'margin-top:8px' }, solutionBar(ex.runSource, 'Ejercicio'))));
      };
      actions.append(h('button', { class: 'btn primary', onclick: check }, 'Comprobar'));
      if (ex.hint) { const hb = h('div', { class: 'callout hint', hidden: true }, '💡 ' + ex.hint); actions.append(h('button', { class: 'btn', onclick: () => { hb.hidden = !hb.hidden; } }, 'Pista')); card.append(hb); }
    }
    if (hooks.onNext) actions.append(h('button', { class: 'btn', onclick: () => hooks.onNext() }, hooks.nextLabel || 'Siguiente ejercicio →'));
    card.append(actions, out);
    host.append(card);
  }

  root.UI = { h, esc, Store, Stats, hl, codeBlock, iterTable, sectorMap, Sim, renderExercise, PRESETS, screenCanvas, vgaRGB };
})(window);
