'use strict';
const Ex = require('../exercises.js');
const E3 = require('../exercises3.js');
const DDR = require('../ddr.js');
const Emu = require('../emu.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.stack.split('\n').slice(0, 5).join('\n       ')); process.exitCode = 1; } }

t('timer completion: correct choices pass, a wrong choice fails (x30)', () => {
  for (let i = 0; i < 30; i++) {
    const e = E3.exFillTimer(); assert.ok(e.slots.length >= 3 && e.slots.length <= 4);
    assert.ok(e.verify(e.slots.map(s => s.ans)), 'correct choices rejected');
    e.slots.forEach(s => { assert.strictEqual(new Set(s.opts).size, s.opts.length); assert.ok(s.opts.length >= 3); assert.ok(s.why[0] && s.why[1]); });
    const k = i % e.slots.length; const bad = e.slots.map(s => s.ans); bad[k] = (bad[k] + 1) % e.slots[k].opts.length;
    assert.ok(!e.verify(bad), 'a wrong option passed in slot ' + k + ': ' + e.slots[k].opts[bad[k]]);
    assert.ok(e.code.includes('________') && e.prompt.includes('interrupción del temporizador'));
    assert.ok(e.slots.some(s => /dl|20h|iret|4\*8|timer/.test(s.orig)), 'at least one interrupt-related blank');
  }
});
t('timer completion: every generated reference program really works (reaches ≥ 3 redraws)', () => {
  for (let i = 0; i < 12; i++) { const e = E3.exFillTimer(); const p = Emu.runSource(e.full, e.runOpts); assert.ok(p.prog.ok); assert.ok(p.trace.steps.filter(s => s.vmode === 0x13).length >= 3); }
});
t('calc generators x2000: own answer accepted, a different answer rejected, steps present', () => {
  for (const mk of [E3.exCalc, E3.exTxtCalc]) for (let i = 0; i < 2000; i++) {
    const e = mk(); assert.ok(e.fields.length >= 1);
    for (const f of e.fields) {
      assert.ok(f.steps.length && f.steps.every(Boolean)); assert.ok(Number.isFinite(f.answer));
      const own = f.base ? f.answer.toString(16) + 'h' : String(f.answer); assert.ok(DDR.checkField(f, own), 'rejects own: ' + JSON.stringify(f));
      const wrong = f.base ? (f.answer + 1).toString(16) + 'h' : String(f.answer + 1); assert.ok(!DDR.checkField(f, wrong), 'accepts wrong');
    }
  }
});
t('ROR/ROL exercise agrees with the emulator', () => {
  for (const [init, k, left] of [[0x04040404, 3, false], [0x01010101, 1, false], [0x80808080, 2, true], [0x04040404, 8, false]]) {
    const src = ['org 7C00h', 'mov ebx, ' + init.toString(16) + 'h'].concat(Array(k).fill(left ? 'rol ebx, 1' : 'ror ebx, 1'), ['jmp $']).join('\n');
    const r = Emu.runSource(src); assert.strictEqual(r.trace.final.regs[3] >>> 0, E3.rot(init, k, left) >>> 0);
  }
});
t('pixel / segment arithmetic agrees with the emulator', () => {
  const r = Emu.runSource('org 7C00h\nmov ax, 13h\nint 10h\nmov ax, 0a000h\nmov es, ax\nmov di, 320*77+123\nmov byte [es:di], 9\njmp $');
  const w = r.trace.steps.flatMap(s => s.writes).pop(); assert.strictEqual(w.addr, 0xA0000 + 77 * 320 + 123); const sc = Emu.screenAt(r.trace, r.trace.steps.length); assert.strictEqual(sc.gfx[77 * 320 + 123], 9);
});
t('banks: interrupt MCQ, true/false and text-mode MCQ are well formed', () => {
  const C2 = require('../content2.js'); assert.ok(C2.INT_MCQ.length >= 25 && C2.VF2.length >= 25 && C2.TXT_MCQ.length >= 10);
  for (const q of [...C2.INT_MCQ, ...C2.TXT_MCQ]) { assert.strictEqual(q[1].length, 4); assert.strictEqual(new Set(q[1]).size, 4, q[0]); assert.ok(q[2]); }
  for (const k of ['p2int', 'p2vf', 'p2txt']) for (let i = 0; i < 300; i++) { const e = Ex.MAKERS[k](); if (e.type === 'mcq') { assert.ok(e.ans >= 0 && e.ans < e.opts.length); assert.strictEqual(new Set(e.opts).size, e.opts.length); } }
});
console.log('\n' + n + ' passed');
