'use strict';
const DDR = require('../ddr.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.message); process.exitCode = 1; } }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' != ' + b);

// Hand-computed expectations for the six real exams (a, b, c, d, f, e)
const EXPECT = {
  A23: { a: 40, b: 24, c: 800, d: 15, f: 55, e: 'PC3-12800' },
  B23: { a: 20, b: 24, c: 800, d: 15, f: 35, e: 'DDR3-1600' },
  A24: { a: 20, b: 30, c: 3000, d: 5, f: 25, e: 'DDR5-6000' },
  B24: { a: 40, b: 23, c: 3000, d: 23 / 6, f: 40 + 23 / 6, e: 'PC5-48000' },
  A25: { a: 5, b: 28, c: 2800, d: 5, f: 10, e: 'DDR5-5600' },
  B25: { a: 10, b: 28, c: 2800, d: 5, f: 15, e: 'PC5-44800' }
};
for (const ex of DDR.EXAMS) {
  t(ex.id + ' matches hand-computed answers', () => {
    const s = DDR.solve(ex.p); const E = EXPECT[ex.id];
    close(s.fetchNs, E.a); assert.strictEqual(s.transfers, E.b); close(s.busMHz, E.c); close(s.memNs, E.d); close(s.totalNs, E.f); assert.strictEqual(s.alt, E.e);
  });
}
t('memory time agrees with the bandwidth method (bytes / (MB/s x channels))', () => {
  for (const ex of DDR.EXAMS) { const s = DDR.solve(ex.p); if (!s.integer) continue; const viaBW = ex.p.bytes / (s.mem.mbps * ex.p.channels) * 1000; close(s.memNs, viaBW); }
});
t('B24 is the only non-integer case (22.5 transfers)', () => {
  assert.deepStrictEqual(DDR.EXAMS.filter(e => !DDR.solve(e.p).integer).map(e => e.id), ['B24']);
  close(DDR.solve(DDR.EXAMS[3].p).exact, 22.5);
});
t('notation: PC <-> DDR both directions for every known pair', () => {
  for (const q of DDR.PAIRS) { assert.strictEqual(DDR.parseMem(DDR.pcName(q.gen, q.mbps)).ddr, DDR.ddrName(q.gen, q.mts)); assert.strictEqual(DDR.parseMem(DDR.ddrName(q.gen, q.mts)).pc, DDR.pcName(q.gen, q.mbps)); }
});
t('parseMem accepts spaces/lowercase', () => { assert.strictEqual(DDR.parseMem('ddr4 3200').mts, 3200); assert.strictEqual(DDR.parseMem('pc4-25600').mts, 3200); assert.strictEqual(DDR.parseMem('DDR-400').busMHz, 200); assert.strictEqual(DDR.parseMem('hola'), null); });
t('checkField: numeric tolerance, comma decimals, units, text', () => {
  const f = { kind: 'num', answer: 3.8333333, alt: [3.75] };
  assert.ok(DDR.checkField(f, '3.83')); assert.ok(DDR.checkField(f, '3,83 ns')); assert.ok(DDR.checkField(f, '3.75')); assert.ok(!DDR.checkField(f, '3.5')); assert.ok(!DDR.checkField(f, 'abc'));
  assert.ok(DDR.checkField({ kind: 'text', answer: 'PC3-12800' }, 'pc3 12800')); assert.ok(!DDR.checkField({ kind: 'text', answer: 'PC3-12800' }, 'DDR3-1600'));
  assert.ok(DDR.checkField({ kind: 'num', answer: 24 }, '24')); assert.ok(!DDR.checkField({ kind: 'num', answer: 24 }, '25'));
});
t('generators x2000: well-formed, answers self-consistent, steps present', () => {
  for (const k of Object.keys(DDR.MAKERS)) for (let i = 0; i < 2000; i++) {
    const e = DDR.MAKERS[k](); assert.ok(e.prompt);
    if (e.type === 'mcq') { assert.ok(e.ans >= 0 && e.ans < e.opts.length && e.why); assert.strictEqual(new Set(e.opts).size, e.opts.length, 'duplicate options'); continue; }
    assert.ok(e.fields.length >= 1);
    for (const f of e.fields) { assert.ok(f.steps && f.steps.length, 'no steps'); assert.ok(DDR.checkField(f, f.kind === 'text' ? f.answer : String(f.answer)), 'own answer rejected: ' + JSON.stringify(f)); assert.ok(Number.isFinite(f.answer) || f.kind === 'text'); }
    if (e.p) { const s = DDR.solve(e.p); assert.ok(s.transfers >= 1 && s.totalNs > 0); }
  }
});
t('inverse problems: answers recomputed independently', () => {
  for (let i = 0; i < 1500; i++) {
    const e = DDR.MAKERS.ddrinv(); const f = e.fields[0];
    const m = /(\d+) ns/.exec(e.prompt); const mem = /(DDR\d?-\d+|PC\d?-\d+)/.exec(e.prompt);
    if (f.key === 'r' && f.label === 'Bytes') { const c = DDR.CH_NAME && Object.entries(DDR.CH_NAME).find(([, v]) => e.prompt.includes(v))[0]; const mm = DDR.parseMem(mem[1]); assert.strictEqual(f.answer, (+m[1]) * mm.mts / 1000 * 8 * (+c)); }
    if (f.label === 'Canales') { const mm = DDR.parseMem(mem[1]); const bytes = +/transfiere (\d+) bytes/.exec(e.prompt)[1]; assert.strictEqual(f.answer, bytes / (8 * (+m[1]) * mm.mts / 1000)); }
  }
});
t('comparison: the marked-best configuration really is faster', () => {
  for (let i = 0; i < 1500; i++) {
    const e = DDR.MAKERS.ddrcmp(); const mm = /A: (\d)× (DDR\d?-\d+) .*\nB: (\d)× (DDR\d?-\d+)/.exec(e.prompt); const bytes = +/transferir (\d+) bytes/.exec(e.prompt)[1];
    const tA = bytes / (8 * +mm[1]) / DDR.parseMem(mm[2]).mts, tB = bytes / (8 * +mm[3]) / DDR.parseMem(mm[4]).mts;
    assert.strictEqual(e.ans, tA < tB ? 0 : 1); assert.notStrictEqual(tA, tB);
  }
});
t('statement mirrors the exam wording', () => {
  const s = DDR.statement(DDR.EXAMS[0].p);
  assert.ok(s.includes('1.5 GHz') && s.includes('60 ciclos') && s.includes('3 memorias DDR3-1600') && s.includes('triple canal') && s.includes('576 bytes'));
});
console.log('\n' + n + ' passed');
