'use strict';
const Emu = require('../emu.js');
const { EXAMS2 } = require('../programs2.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.stack.split('\n').slice(0, 5).join('\n       ')); process.exitCode = 1; } }
const ex = id => EXAMS2.find(e => e.id === id);
function runEx(id, scen) { const e = ex(id); const p = Emu.assemble(e.source); assert.ok(p.ok, id + ': ' + p.error + ' line ' + p.line); const opts = Object.assign({ maxSteps: 4000 }, scen ? { events: scen.events } : {}, e.timer ? { timer: e.timer, demo: true, maxSteps: 7000 } : {}); return { p, tr: Emu.run(p, opts) }; }
const cell = (sc, r, c) => ({ ch: String.fromCharCode(sc.chars[r * 80 + c]), at: sc.attrs[r * 80 + c] });

/* ---- expected shape of the "Z" figure, derived by hand from the code ---- */
function expectedCells() {
  const set = new Set();
  for (let c = 32; c < 64; c++) { set.add('4,' + c); set.add('20,' + c); }          // top and bottom bars
  for (let j = 1; j <= 15; j++) { set.add((4 + j) + ',' + (64 - j)); set.add((4 + j) + ',' + (48 - j)); } // two diagonals (rows 5..19)
  return set;
}
function drawn(sc) { const s = new Set(); for (let i = 0; i < 2000; i++) if (sc.chars[i] === 0x7A) s.add(Math.floor(i / 80) + ',' + (i % 80)); return s; }

for (const id of ['A2', 'B2']) {
  for (const scen of ex(id).scenarios) {
    t(id + ' · ' + scen.label + ': 94 letters «z» in the expected cells, attribute ' + scen.attr, () => {
      const { tr } = runEx(id, scen); const sc = Emu.screenAt(tr, tr.steps.length);
      assert.strictEqual(sc.mode, 'text');
      const got = drawn(sc), want = expectedCells();
      assert.strictEqual(got.size, 94); assert.deepStrictEqual([...got].sort(), [...want].sort());
      for (const k of got) { const [r, c] = k.split(',').map(Number); assert.strictEqual(cell(sc, r, c).at, scen.attr, 'attr at ' + k); }
      assert.strictEqual(cell(sc, 4, 32).ch, 'z'); assert.strictEqual(cell(sc, 4, 31).ch, ' ');
    });
  }
}
t('A2 starts drawing at row 4, column 32: di = 160*4+64 = 704 → B8000h + 704', () => {
  const { tr } = runEx('A2', ex('A2').scenarios[0]); const w = tr.steps.find(s => s.writes.some(x => x.addr >= 0xB8000)).writes[0];
  assert.strictEqual(w.addr, 0xB8000 + 704); assert.strictEqual(w.val, 0x017A); assert.strictEqual(w.bits, 16);
});
t('char goes in the EVEN byte, attribute in the ODD byte (little-endian dx = dh:dl)', () => {
  const { tr } = runEx('A2', ex('A2').scenarios[0]); const sc = Emu.screenAt(tr, tr.steps.length);
  assert.strictEqual(sc.chars[4 * 80 + 32], 0x7A); assert.strictEqual(sc.attrs[4 * 80 + 32], 1);
});
t('A2 polling halts waiting for a key after handling it (no more events)', () => { const { tr } = runEx('A2', ex('A2').scenarios[0]); assert.strictEqual(tr.halted.reason, 'wait-key'); });
t('A2 does not draw anything before the key arrives', () => {
  const { tr } = runEx('A2', ex('A2').scenarios[0]); const firstWrite = tr.steps.findIndex(s => s.writes.length);
  assert.ok(firstWrite > 12); const sc = Emu.screenAt(tr, firstWrite); assert.strictEqual(drawn(sc).size, 0);
});
t('B2 installs vector 9 (offset at 0024h, segment at 0026h)', () => {
  const { p, tr } = runEx('B2', ex('B2').scenarios[0]);
  const w = tr.steps.flatMap(s => s.writes).filter(x => x.addr < 0x400);
  assert.deepStrictEqual(w.map(x => [x.addr, x.val, x.bits]), [[0x24, p.labels.get('keyboard'), 16], [0x26, 0, 16]]);
});
t('B2: the interrupt pushes FLAGS, CS, IP and IRET restores them (SP back to 7C00h, IF back to 1)', () => {
  const { p, tr } = runEx('B2', ex('B2').scenarios[0]);
  const irq = tr.steps.findIndex(s => s.op === 'irq'); assert.ok(irq > 0);
  assert.strictEqual(tr.steps[irq].regs[4], p.start - 6, 'SP after the interrupt: 3 words pushed');
  assert.strictEqual(tr.steps[irq].flags.IF, 0, 'IF is cleared on entry');
  assert.strictEqual(tr.steps[irq].next, p.labels.get('keyboard'));
  const iret = tr.steps.findIndex(s => s.op === 'iret'); assert.ok(iret > irq);
  assert.strictEqual(tr.steps[iret].regs[4], p.start, 'SP restored'); assert.strictEqual(tr.steps[iret].flags.IF, 1, 'IF restored by IRET');
  assert.strictEqual(tr.steps[iret].next, tr.steps[irq].ip, 'returns to the interrupted instruction');
  assert.strictEqual(tr.eoi, 1);
});
t('B2: main program sits in «jmp $» until the key interrupt (idle skip), then halts on «jmp $»', () => { const { tr } = runEx('B2', ex('B2').scenarios[0]); assert.strictEqual(tr.halted.reason, 'jmp $'); assert.ok(tr.steps.length < 400); });

/* ---- question 3 ---- */
function gfxColor(sc, x, y) { return sc.gfx[y * 320 + x]; }
function drawsOf(tr) { return tr.steps.map((s, i) => ({ s, i })).filter(o => o.s.op === 'ror'); }
t('A3 assembles; the timer vector 8 is installed at 0020h', () => {
  const { p, tr } = runEx('A3'); const w = tr.steps.flatMap(s => s.writes).filter(x => x.addr < 0x400);
  assert.deepStrictEqual(w.map(x => [x.addr, x.val]), [[0x20, p.labels.get('timer')], [0x22, 0]]);
});
t('A3: three columns 4 px wide, 16 high, 8 px apart, starting at the centre (160,100); colour 4 then 2, 1, 80h…', () => {
  const { tr } = runEx('A3'); const rs = drawsOf(tr); assert.ok(rs.length >= 4, 'draws: ' + rs.length);
  const colors = [4, 2, 1, 0x80, 0x40, 0x20, 0x10, 8];
  rs.slice(0, 4).forEach((o, k) => {
    const sc = Emu.screenAt(tr, o.i + 1); assert.strictEqual(sc.mode, 'gfx'); const col = colors[k];
    for (const x0 of [160, 172, 184]) for (let y = 100; y < 116; y++) for (let dx = 0; dx < 4; dx++) assert.strictEqual(gfxColor(sc, x0 + dx, y), col, 'draw ' + k + ' px ' + (x0 + dx) + ',' + y);
    let lit = 0; for (let i = 0; i < 64000; i++) if (sc.gfx[i]) lit++; assert.strictEqual(lit, 3 * 4 * 16);
    assert.strictEqual(gfxColor(sc, 164, 100), 0, 'gap between columns'); assert.strictEqual(gfxColor(sc, 160, 116), 0); assert.strictEqual(gfxColor(sc, 160, 99), 0);
  });
});
t('A3: the colour changes about every 18 timer interrupts (≈ 1 s)', () => {
  const { tr } = runEx('A3'); const rs = drawsOf(tr); assert.ok(rs.length >= 3);
  for (let k = 1; k < rs.length; k++) { const dt = rs[k].s.tick - rs[k - 1].s.tick; assert.ok(dt >= 18 * 40 && dt <= 18 * 40 + 260, 'ticks between draws: ' + dt); }
});
t('A3: ROR rotates EBX 04040404h → 02020202h → 01010101h → 80808080h', () => {
  const { tr } = runEx('A3'); const vals = drawsOf(tr).slice(0, 4).map(o => tr.steps[o.i].regs[3] >>> 0);
  assert.deepStrictEqual(vals, [0x02020202, 0x01010101, 0x80808080, 0x40404040]);
});
t('A3: DL counts interrupts and the handler leaves the main registers/flags intact (IF=1 after IRET)', () => {
  const { p, tr } = runEx('A3'); const first = tr.steps.findIndex(s => s.op === 'iret');
  assert.strictEqual(tr.steps[first].regs[4], p.start); assert.strictEqual(tr.steps[first].flags.IF, 1);
  assert.strictEqual(tr.steps[first].regs[2] & 0xFF, 1, 'DL = 1 after the first tick');
});
t('B3: three bars 16 px wide and 2 high at y = 100-101, 110-111, 120-121 starting at x = 160', () => {
  const { tr } = runEx('B3'); const rs = drawsOf(tr); assert.ok(rs.length >= 2);
  const sc = Emu.screenAt(tr, rs[0].i + 1); let lit = 0; for (let i = 0; i < 64000; i++) if (sc.gfx[i]) lit++;
  assert.strictEqual(lit, 3 * 16 * 2);
  for (const y0 of [100, 110, 120]) for (let y = y0; y < y0 + 2; y++) for (let x = 160; x < 176; x++) assert.strictEqual(gfxColor(sc, x, y), 4, x + ',' + y);
  assert.strictEqual(gfxColor(sc, 176, 100), 0); assert.strictEqual(gfxColor(sc, 160, 102), 0); assert.strictEqual(gfxColor(sc, 160, 109), 0);
});
t('B3: 4 loop turns x 4 pixels = 16 pixels wide (cx = 4, add di,4)', () => {
  const { tr } = runEx('B3'); const first = tr.steps.findIndex(s => s.op === 'mov' && /\[es:di\], ebx/.test(s.text));
  const loops = tr.steps.slice(first).filter(s => s.op === 'loop').slice(0, 4); assert.strictEqual(loops.filter(s => s.taken).length, 3); assert.strictEqual(loops[3].taken, false);
});
t('instruction sizes with prefixes: mov ebx,imm32 = 6 B, mov [es:di],ebx = 4 B, ror ebx,1 = 3 B, in/out = 2 B', () => {
  const { p } = runEx('A3'); const size = txt => p.items.find(i => i.kind === 'ins' && i.text === txt).size;
  assert.strictEqual(size('mov ebx, 04040404h'), 6); assert.strictEqual(size('mov [es:di], ebx'), 4); assert.strictEqual(size('ror ebx, 1'), 3); assert.strictEqual(size('out 20h, al'), 2); assert.strictEqual(size('int 10h'), 2); assert.strictEqual(size('iret'), 1);
  assert.strictEqual(p.layout.total, 512); assert.strictEqual(p.layout.sigBytes, 2);
});
t('errors: unsupported video mode / BIOS service are reported, not thrown', () => {
  const r = Emu.runSource('org 7C00h\nmov ax, 5\nint 10h\njmp $'); assert.strictEqual(r.trace.halted.reason, 'error');
  const r2 = Emu.runSource('org 7C00h\nint 21h\njmp $'); assert.strictEqual(r2.trace.halted.reason, 'error');
  assert.ok(!Emu.assemble('org 7C00h\nin bl, 60h').ok);
});
t('IRQ ignored when no handler is installed (no crash) and when IF=0 the request waits', () => {
  const r = Emu.runSource('org 7C00h\nsti\nmov cx, 50\nx: loop x\njmp $', { timer: { period: 5 }, maxSteps: 200 }); assert.strictEqual(r.trace.halted.reason, 'jmp $');
  assert.ok(!r.trace.steps.some(s => s.op === 'irq'));
  // with IF=0 the timer request is held back and never delivered
  const r2 = Emu.runSource('org 7C00h\nmov word [0020h], 7C20h\nmov cx, 50\nx: loop x\njmp $', { timer: { period: 5 }, maxSteps: 300 }); assert.ok(!r2.trace.steps.some(s => s.op === 'irq'));
});
t('PIC: without the EOI (out 20h, al) the timer interrupt is never delivered again', () => {
  const e = ex('A3'); const noEoi = e.source.replace('out 20h, al', 'nop');
  const withEoi = Emu.runSource(e.source, { timer: e.timer, demo: true, maxSteps: 3000 }); const without = Emu.runSource(noEoi, { timer: e.timer, demo: true, maxSteps: 3000 });
  assert.ok(withEoi.trace.steps.filter(s => s.op === 'irq').length > 20);
  assert.strictEqual(without.trace.steps.filter(s => s.op === 'irq').length, 1, 'only the first IRQ is delivered');
  assert.ok(!without.trace.steps.some(s => s.vmode === 0x13), 'the counter never reaches 18 → nothing is ever drawn');
});
t('using ret instead of iret leaves CS and FLAGS on the stack (program breaks): unsupported ret is reported', () => { assert.ok(!Emu.assemble('org 7C00h\nret').ok); });
console.log('\n' + n + ' passed');
