'use strict';
const Ex = require('../exercises.js');
const Emu = require('../emu.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.stack.split('\n').slice(0, 4).join('\n       ')); process.exitCode = 1; } }

for (const cat of Object.keys(Ex.MAKERS)) {
  t('generator "' + cat + '" x300 never throws and is well-formed', () => {
    for (let i = 0; i < 300; i++) {
      const e = Ex.make(cat);
      assert.ok(e.prompt && e.type && e.cat, 'missing fields');
      if (e.type === 'mcq') { assert.ok(e.ans >= 0 && e.ans < e.opts.length, 'bad ans'); assert.strictEqual(new Set(e.opts).size, e.opts.length, 'duplicate options: ' + JSON.stringify(e.opts)); }
      if (e.type === 'predict') {
        const r = Emu.runSource(e.runSource); assert.ok(r.prog.ok);
        for (const lab of e.asks) { const v = Emu.readLabel(r.prog, r.trace.final.mem, lab).values; assert.deepStrictEqual(e.text ? String.fromCharCode(...v) : v, e.answer[lab]); }
        if (e.regs) { assert.strictEqual(e.answer.BL, r.trace.final.regs[3] & 0xFF); assert.strictEqual(e.answer.DL, r.trace.final.regs[2] & 0xFF); }
      }
      if (e.type === 'numeric') { const v = Ex.parseIn(e.answer, e.base); assert.ok(!Number.isNaN(v), 'answer not parseable: ' + e.answer); }
      if (e.type === 'trace') { assert.ok(e.rows.length >= 3); for (const c of e.cols) for (const r of e.rows) assert.ok(r[c.key] !== undefined, 'missing ' + c.key); }
    }
  });
}
t('jump-fill has exactly one right option', () => { for (let i = 0; i < 100; i++) { const e = Ex.make('jump'); assert.strictEqual(e.opts.filter((_, k) => k === e.ans).length, 1); assert.ok(e.code.includes('???')); } });
t('simulacro x100', () => { for (let i = 0; i < 100; i++) { const s = Ex.makeSimulacro(); assert.ok(s.marked.length >= 3); assert.strictEqual(s.parts.length, s.marked.length); s.parts.forEach(p => assert.ok(p.ans >= 0)); } });
t('parseIn', () => { assert.strictEqual(Ex.parseIn('3Ah', 16), 58); assert.strictEqual(Ex.parseIn('0x3a', 16), 58); assert.strictEqual(Ex.parseIn('3a', 16), 58); assert.strictEqual(Ex.parseIn('00111010b', 2), 58); assert.strictEqual(Ex.parseIn('58', 10), 58); assert.ok(Number.isNaN(Ex.parseIn('5x', 10))); });
t('parseList/checkList', () => { assert.deepStrictEqual(Ex.parseList('3, 0Fh 1010b 7', false), [3, 15, 10, 7]); assert.ok(Ex.checkList([3, 15], [3, 15], false).ok); assert.ok(!Ex.checkList([3], [3, 15], false).ok); assert.ok(Ex.checkList('abc', 'abc', true).ok); });
console.log('\n' + n + ' passed');
