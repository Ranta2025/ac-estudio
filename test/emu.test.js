'use strict';
const Emu = require('../emu.js');
const { EXAMS, applyVariant } = require('../programs.js');
const assert = require('assert');

function result(src, label) {
  const { prog, trace } = Emu.runSource(src);
  assert.ok(prog.ok, 'assemble failed: ' + prog.error + ' line ' + prog.line);
  assert.strictEqual(trace.halted.reason, 'jmp $', 'did not halt on jmp $: ' + JSON.stringify(trace.halted));
  return Emu.readLabel(prog, trace.final.mem, label).values;
}
const str = a => String.fromCharCode(...a);
const ex = id => EXAMS.find(e => e.id === id);
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ', name); } catch (e) { console.log('FAIL ', name, '\n      ', e.message); process.exitCode = 1; } }

// hand-computed expectations (see exam PDFs)
t('A23 c) num2', () => assert.deepStrictEqual(result(ex('A23').source, 'num2'), [15, 0, 0]));
t('A23 d) jnz', () => assert.deepStrictEqual(result(applyVariant(ex('A23').source, ex('A23').variants[0]), 'num2'), [52, 8, 0]));
t('B23 c) cadena2', () => assert.strictEqual(str(result(ex('B23').source, 'cadena2')), 'EXAMEN'));
t('B23 d) a-z', () => assert.strictEqual(str(result(applyVariant(ex('B23').source, ex('B23').variants[0]), 'cadena2')), 'examen'));
t('A24 c) num2', () => assert.deepStrictEqual(result(ex('A24').source, 'num2'), [0, 7, 0, 3, 0, 6, 0, 8, 0, 1]));
t('A24 d) jbe', () => assert.deepStrictEqual(result(applyVariant(ex('A24').source, ex('A24').variants[0]), 'num2'), [0, 0, 0, 55, 0, 22, 0, 34, 0, 20]));
t('B24 c) cadena2', () => assert.strictEqual(str(result(ex('B24').source, 'cadena2')), 'arutcetiuqra'));
t('B24 d) 0-9', () => assert.strictEqual(str(result(applyVariant(ex('B24').source, ex('B24').variants[0]), 'cadena2')), '109876543210'));
t('A25 c) num2', () => assert.deepStrictEqual(result(ex('A25').source, 'num2'), [3, 3, 9, 3, 15, 3, 7, 3, 35, 3]));
t('A25 c) num3', () => assert.deepStrictEqual(result(ex('A25').source, 'num3'), [10, 2, 8, 2, 12, 2, 6, 2, 52, 2]));
t('A25 d) num2', () => assert.deepStrictEqual(result(applyVariant(ex('A25').source, ex('A25').variants[0]), 'num2'), [10, 3, 8, 3, 12, 3, 6, 3, 52, 3]));
t('A25 d) num3', () => assert.deepStrictEqual(result(applyVariant(ex('A25').source, ex('A25').variants[0]), 'num3'), [3, 2, 9, 2, 15, 2, 7, 2, 35, 2]));
t('B25 c) num2', () => assert.deepStrictEqual(result(ex('B25').source, 'num2'), [3, 1, 8, 1, 9, 1, 7, 1, 6, 1]));
t('B25 c) num3', () => assert.deepStrictEqual(result(ex('B25').source, 'num3'), [10, 4, 12, 4, 15, 4, 52, 4, 35, 4]));
t('B25 d) jbe num2', () => assert.deepStrictEqual(result(applyVariant(ex('B25').source, ex('B25').variants[0]), 'num2'), [10, 1, 12, 1, 15, 1, 52, 1, 35, 1]));

// layout / boot sector
t('boot signature 55 AA at the end, 512 bytes', () => {
  const { prog } = Emu.runSource(ex('A23').source);
  assert.strictEqual(prog.layout.total, 512);
  assert.strictEqual(prog.mem[0x7DFE], 0x55); assert.strictEqual(prog.mem[0x7DFF], 0xAA);
  assert.strictEqual(prog.layout.sigBytes, 2);
});
// instruction sizes known from real encodings: A23 code = 2+2+3+3+3+2+2+2+2+1+3+2+2 = 27? check
t('A23 code size matches real 8086 encoding (30 bytes)', () => {
  // mov ax,cs(2) mov ds,ax(2) mov si,imm(3) mov di,imm(3) mov cx,imm(3) mov al,[si](2) and al,1(2) jz(2) mov al,[si](2) mov [di],al(2) inc di(1) sub si,3(3) loop(2) jmp $(2)
  const { prog } = Emu.runSource(ex('A23').source);
  assert.strictEqual(prog.layout.codeBytes, 2 + 2 + 3 + 3 + 3 + 2 + 2 + 2 + 2 + 2 + 1 + 3 + 2 + 2);
});
// errors are reported, not thrown
t('error: unknown instruction', () => { const p = Emu.assemble('org 7C00h\nfoo ax, 1'); assert.ok(!p.ok); assert.strictEqual(p.line, 1); });
t('error: mem-to-mem', () => { const p = Emu.assemble('org 7C00h\nmov [si], [di]'); assert.ok(!p.ok); });
t('error: undefined label', () => { const p = Emu.assemble('org 7C00h\nmov si, nada'); assert.ok(!p.ok); });
t('error: byte size missing', () => { const p = Emu.assemble('org 7C00h\nmov [si], 5'); assert.ok(!p.ok); });
t('byte prefix ok', () => { const r = Emu.runSource('org 7C00h\nmov si, d\nmov byte [si], 7\njmp $\nd db 0'); assert.deepStrictEqual(Emu.readLabel(r.prog, r.trace.final.mem, 'd').values, [7]); });
// flags
t('cmp unsigned: 20 vs 15 -> CF=0 ZF=0', () => { const r = Emu.runSource('org 7C00h\nmov al, 20\ncmp al, 15\njmp $'); const f = r.trace.final.flags; assert.strictEqual(f.CF, 0); assert.strictEqual(f.ZF, 0); });
t('cmp unsigned: 3 vs 9 -> CF=1', () => { const r = Emu.runSource('org 7C00h\nmov al, 3\ncmp al, 9\njmp $'); assert.strictEqual(r.trace.final.flags.CF, 1); });
t('test al,1 does not modify AL', () => { const r = Emu.runSource('org 7C00h\nmov al, 53\ntest al, 1\njmp $'); assert.strictEqual(r.trace.final.regs[0] & 0xFF, 53); assert.strictEqual(r.trace.final.flags.ZF, 0); });
t('and al,1 destroys AL', () => { const r = Emu.runSource('org 7C00h\nmov al, 53\nand al, 1\njmp $'); assert.strictEqual(r.trace.final.regs[0] & 0xFF, 1); });
t('loop with cx=3 runs 3 times', () => { const r = Emu.runSource('org 7C00h\nmov cx,3\nxor bl,bl\nx: inc bl\nloop x\njmp $'); assert.strictEqual(r.trace.final.regs[3] & 0xFF, 3); });
t('AH/AL halves', () => { const r = Emu.runSource('org 7C00h\nmov ax, 0x1234\nmov al, 0FFh\njmp $'); assert.strictEqual(r.trace.final.regs[0], 0x12FF); });
t('anonymous @b', () => { const r = Emu.runSource('org 7C00h\nmov cx,2\nmov bl,0\n@@: inc bl\nloop @b\njmp $'); assert.strictEqual(r.trace.final.regs[3] & 0xFF, 2); });
t('iterations() splits into loop turns', () => { const r = Emu.runSource(ex('A24').source); assert.strictEqual(Emu.iterations(r.prog, r.trace).filter(x => x.some(s => s.op === 'loop')).length, 10); });

console.log('\n' + n + ' passed' + (process.exitCode ? ' (with failures)' : ''));
