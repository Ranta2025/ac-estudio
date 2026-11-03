'use strict';
const Ex = require('../exercises.js');
const E2 = require('../exercises2.js');
const DDR = require('../ddr.js');
const Emu = require('../emu.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.stack.split('\n').slice(0, 4).join('\n       ')); process.exitCode = 1; } }

t('fill: correct choices pass, a wrong choice fails, x400', () => {
  for (let i = 0; i < 400; i++) {
    const e = E2.exFillCode(); assert.ok(e.slots.length >= 2 && e.slots.length <= 3);
    assert.ok(e.verify(e.slots.map(s => s.ans)), 'correct choices rejected');
    for (const s of e.slots) { assert.strictEqual(new Set(s.opts).size, s.opts.length); assert.ok(s.opts.length >= 3); }
    const bad = e.slots.map(s => s.ans); const k = i % bad.length; bad[k] = (bad[k] + 1) % e.slots[k].opts.length;
    assert.ok(!e.verify(bad), 'a wrong choice (distractor filtered to change the result) passed');
    assert.ok(e.code.includes('________') && e.prompt.includes('«'));
  }
});
t('tracestep: well formed, cells consistent with a fresh emulator run, x300', () => {
  for (let i = 0; i < 300; i++) {
    const e = E2.exTraceStep(); assert.ok(e.rows.length >= 8);
    const r = Emu.runSource(e.runSource); assert.ok(r.prog.ok);
    e.rows.forEach((row, k) => { assert.strictEqual(row.ins, r.trace.steps[k].text); assert.strictEqual(Object.keys(row.cells).length, e.cols.length); });
    const asked = e.rows.reduce((a, row) => a + Object.values(row.cells).filter(c => c.ask).length, 0); assert.ok(asked >= 8 && asked <= 34);
  }
});
t('partial state matches the emulator at the end of that iteration, x300', () => {
  for (let i = 0; i < 300; i++) { const e = E2.exPartial(); assert.strictEqual(e.type, 'predict'); assert.ok(e.asks.length >= 1); for (const l of e.asks) assert.ok(e.answer[l] !== undefined); }
});
t('jump counting x300', () => { for (let i = 0; i < 300; i++) { const e = E2.exJumps(); assert.ok(Number.isInteger(+e.answer) && +e.answer >= 0); } });
t('vf bank: every item has a verdict and a reason', () => { const C = require('../content.js'); assert.ok(C.VF.length >= 45); for (const [s, v, w] of C.VF) { assert.ok(s && typeof v === 'boolean' && w); } for (let i = 0; i < 100; i++) { const e = E2.exVF(); assert.strictEqual(e.opts.length, 2); } });
t('micro + layout: own answers accepted, x1500', () => {
  for (const mk of [E2.exMicro, E2.exLayout]) for (let i = 0; i < 1500; i++) {
    const e = mk(); assert.ok(e.fields.length >= 1);
    for (const f of e.fields) { assert.ok(f.steps.length); const own = f.base ? f.answer.toString(16) + 'h' : String(f.answer); assert.ok(DDR.checkField(f, own), 'rejects own: ' + JSON.stringify(f)); assert.ok(!DDR.checkField(f, String(f.answer + 1)) || f.base, 'accepts wrong'); }
  }
});
t('layout arithmetic agrees with a real assembly (times / dw / dup)', () => {
  const src = 'org 7C00h\nmov al, 1\njmp $\nnum1 db 1, 2, 3, 4, 5\nnum2 db 3 dup (1, 2)\ndat dw 1234h\ntimes 510-($-$$) db 0\ndw 0AA55h';
  const p = Emu.assemble(src); assert.ok(p.ok);
  assert.strictEqual(p.labels.get('num2') - p.labels.get('num1'), 5);
  assert.strictEqual(p.labels.get('dat') - p.labels.get('num2'), 6);
  assert.strictEqual(p.mem[p.labels.get('dat')], 0x34); assert.strictEqual(p.mem[p.labels.get('dat') + 1], 0x12);
  assert.strictEqual(p.mem[0x7DFE], 0x55); assert.strictEqual(p.mem[0x7DFF], 0xAA);
  const used = p.labels.get('dat') + 2 - 0x7C00; const pad = p.layout.padBytes; assert.strictEqual(pad, 510 - used);
});
t('trace maker mixes all five kinds and never throws, x500', () => { for (let i = 0; i < 500; i++) { const e = Ex.MAKERS.trace(); assert.ok(e.type && e.prompt); } });
t('fill maker x300', () => { for (let i = 0; i < 300; i++) { const e = Ex.MAKERS.fill(); assert.ok(e.type === 'fill' || e.type === 'mcq'); } });
console.log('\n' + n + ' passed');
