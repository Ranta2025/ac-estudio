'use strict';
const DDR = require('../ddr.js');
const Fx = require('../formulas.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.message); process.exitCode = 1; } }

/* minimal well-formedness check for the MathML we emit */
function wellFormed(xml) {
  const stack = []; const re = /<(\/?)([a-z]+)([^>]*)>/g; let m;
  while ((m = re.exec(xml))) { if (m[1]) { assert.strictEqual(stack.pop(), m[2], 'mismatched </' + m[2] + '> in ' + xml.slice(0, 80)); } else stack.push(m[2]); }
  assert.strictEqual(stack.length, 0, 'unclosed tags: ' + stack.join(','));
}
const text = xml => xml.replace(/<[^>]+>/g, '').replace(/ /g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

t('every sheet formula is well-formed MathML with a legend', () => {
  let count = 0;
  for (const g of Fx.SHEET) for (const it of g.items) { wellFormed(it.math); assert.ok(it.math.startsWith('<math'), 'not a math root'); assert.ok(it.donde && it.donde.length > 10); count++; }
  assert.ok(count >= 12, 'expected the full set of formulas, got ' + count);
  for (const [sym, meaning, unit, where] of Fx.SYMBOLS) { wellFormed('<math>' + sym + '</math>'); assert.ok(meaning && unit && where); }
});
t('sheet uses the real notation (fractions, ceiling, subscripts, times)', () => {
  const all = Fx.SHEET.flatMap(g => g.items.map(i => i.math)).join('');
  for (const tag of ['<mfrac>', '<msub>', '⌈', '⌉', '×', '⇔', '<mtext>']) assert.ok(all.includes(tag), 'missing ' + tag);
  assert.ok(!/ ÷ /.test(all.replace(/<mtext>[^<]*<\/mtext>/g, '')), 'a division sign leaked into the typeset formulas');
});
t('substituted formulas end with the same numbers the engine computes (6 exams x 6 parts)', () => {
  for (const ex of DDR.EXAMS) {
    const s = DDR.solve(ex.p); const F = Fx.forPart(ex.p, s);
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) { assert.ok(F[k] && F[k].length >= 1, k + ' missing'); F[k].forEach(wellFormed); }
    const last = k => text(F[k][F[k].length - 1]);
    assert.ok(last('a').endsWith('=' + DDR.fmt(s.fetchNs) + ' ns'), ex.id + ' a: ' + last('a'));
    assert.ok(last('b').endsWith('=' + s.transfers), ex.id + ' b: ' + last('b'));
    assert.ok(text(F.c[F.c.length - 1]).endsWith('=' + DDR.fmt(s.busMHz) + ' MHz'), ex.id + ' c');
    assert.ok(text(F.d[0]).endsWith('=' + DDR.fmt(s.memNs) + ' ns'), ex.id + ' d: ' + text(F.d[0]));
    assert.ok(last('e').endsWith('=' + s.alt), ex.id + ' e: ' + last('e'));
    assert.ok(last('f').endsWith('=' + DDR.fmt(s.totalNs) + ' ns'), ex.id + ' f: ' + last('f'));
  }
});
t('random problems x1500: substituted numbers match the engine', () => {
  for (let i = 0; i < 1500; i++) {
    const p = DDR.genProblem(); const s = DDR.solve(p); const F = Fx.forPart(p, s);
    Object.values(F).flat().forEach(wellFormed);
    assert.ok(text(F.f[0]).endsWith('=' + DDR.fmt(s.totalNs) + ' ns'));
    assert.ok(text(F.b[1]).includes('' + p.bytes) && text(F.b[1]).endsWith('=' + s.transfers));
  }
});
t('compact sheet has a) to f)', () => { const c = Fx.compact(); assert.deepStrictEqual(c.map(x => x[0]), ['a)', 'b)', 'c)', 'd)', 'e)', 'f)']); c.forEach(x => wellFormed(x[1])); });
t('every drill / inverse / comparison exercise points to real formulas of the sheet', () => {
  const used = new Set();
  for (const k of ['ddrconv', 'ddrinv', 'ddrcmp']) for (let i = 0; i < 3000; i++) {
    const e = DDR.MAKERS[k](); const ids = e.type === 'mcq' ? e.fxIds : e.fields[0].fxIds;
    assert.ok(ids && ids.length >= 1, k + ' without formulas');
    ids.forEach(id => { const it = Fx.byId(id); assert.ok(it, 'unknown formula id ' + id); used.add(id); });
  }
  assert.ok(used.size >= 11, 'only ' + used.size + ' distinct formulas referenced: ' + [...used]);
});
t('every formula id in the sheet is unique', () => { const ids = Fx.SHEET.flatMap(g => g.items.map(i => i.id)); assert.strictEqual(new Set(ids).size, ids.length); });
console.log('\n' + n + ' passed');
