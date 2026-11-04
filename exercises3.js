/* Exercises for the 2nd partial exam. Priority: code completion with the timer interrupt (checked by RUNNING the player's
 * version), interrupt theory, and numeric calculations (vectors, ticks, ROR, pixel addresses). Included but not on the exam:
 * text-mode video and keyboard.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Emu = isNode ? require('./emu.js') : root.Emu;
  const C2 = isNode ? require('./content2.js') : root.Content2;
  const Ex = isNode ? require('./exercises.js') : root.Ex;
  const { pick, shuffle, ri } = Ex;
  let uid = 9000;
  const uniq = a => [...new Set(a)];

  const hexOf = (v, w) => { let s = v.toString(16).toUpperCase(); if (w) s = s.padStart(w, '0'); if (/^[A-F]/.test(s)) s = '0' + s; return s + 'h'; };

  /* ---------- helpers for numeric (calc) exercises ---------- */
  const F = (key, label, answer, unit, steps, extra) => Object.assign({ key, label, kind: 'num', answer, unit: unit || '', steps, exact: true }, extra || {});
  const FH = (key, label, answer, steps, width) => F(key, label, answer, '', steps, { base: 16, display: hexOf(answer, width), placeholder: 'en hexadecimal, p. ej. 7DA0h' });
  const calc = (cat, title, prompt, fields, code) => ({ id: ++uid, cat, type: 'calc', title, statement: null, prompt, code: code || null, questions: [], fields, tip: null });

  function rot(x, n, left) { n %= 32; if (!n) return x >>> 0; return left ? (((x << n) | (x >>> (32 - n))) >>> 0) : (((x >>> n) | (x << (32 - n))) >>> 0); }

  /* ================= timer program completion ================= */
  function timerLines(p) {
    const cols = p.shape === 'cols';
    const body = cols
      ? ['mov [es:di], ebx', 'mov [es:di+12], ebx', 'mov [es:di+24], ebx', 'add di, 320']
      : ['mov [es:di], ebx', 'mov [es:di+320], ebx', 'mov [es:di+320*10], ebx', 'mov [es:di+320*11], ebx', 'mov [es:di+320*20], ebx', 'mov [es:di+320*21], ebx', 'add di, 4'];
    return ["format binary as 'img'", 'org 7C00h', 'mov ax, cs', 'mov ds, ax', 'xor di, di', 'xor dl, dl', 'xor ax, ax', 'mov es, ax', 'mov ax, timer', 'mov [es:4*8], ax', 'mov [es:4*8+2], cs', 'sti', 'mov ebx, 04040404h',
      'repite:', '@@:', 'cmp dl, ' + 18 * p.S, 'jne @b', 'mov ax, 13h', 'int 10h', 'mov ax, 0a000h', 'mov es, ax', 'mov di, 320*' + p.y0 + '+' + p.x0, 'mov cx, ' + (cols ? p.h : 4), '@@:', ...body, 'loop @b',
      'ror ebx, 1', 'xor dl, dl', 'jmp repite', 'timer:', 'cli', 'inc dl', 'mov al, 20h', 'out 20h, al', 'sti', 'iret', 'times 510-($-$$) db 0', 'dw 0AA55h'];
  }
  function timerGoal(p) {
    const when = p.S === 1 ? 'cada segundo' : 'cada ' + p.S + ' segundos';
    const where = p.x0 === 160 && p.y0 === 100 ? 'a partir del centro de la pantalla' : 'a partir de la fila ' + p.y0 + ', columna ' + p.x0;
    return (p.shape === 'cols' ? 'tres columnas de 4 píxeles de ancho y ' + p.h + ' de alto, separadas entre sí por 8 píxeles' : 'tres filas de 16 píxeles de ancho y 2 de alto, separadas entre sí por 8 píxeles') + ', ' + where + '. Cambian de color ' + when + ' usando la interrupción del temporizador (18 interrupciones ≈ 1 s).';
  }
  /* candidate replacements and explanations per kind of line */
  function timerKind(line, p) {
    let m;
    if (line === 'mov ax, timer') return { kind: 'vec-ax', group: 'int', cands: ['mov ax, timer', 'mov ax, repite', 'mov ax, 13h', 'mov ax, 0'], title: 'Dirección de la rutina', why: 'AX recibe la dirección (desplazamiento IP) de la etiqueta «timer»: es lo que se guarda en la tabla de vectores.' };
    if (line === 'mov [es:4*8], ax') return { kind: 'vec-off', group: 'int', cands: ['mov [es:4*8], ax', 'mov [es:4*9], ax', 'mov [es:8], ax', 'mov [es:4*8+2], ax'], title: 'Instalar el vector del temporizador', why: 'Guarda el desplazamiento de «timer» en la entrada del vector 8: dirección 4 × 8 = 20h (ES = 0 porque la tabla está en el segmento 0000h). El temporizador es IRQ 0 = INT 8; el vector 9 es el teclado.' };
    if ((m = /^cmp dl, (\d+)$/.exec(line))) { const n = +m[1]; return { kind: 'cmp-n', group: 'int', cands: uniq([n, 18 * (p.S === 1 ? 2 : 1), 9, 1, 100]).map(x => 'cmp dl, ' + x), title: 'Contar ticks hasta el tiempo pedido', why: 'El temporizador interrumpe ≈ 18.2 veces por segundo: ' + p.S + ' s ≈ ' + p.S + ' × 18 = ' + n + ' interrupciones. DL cuenta las interrupciones.' }; }
    if (line === 'inc dl') return { kind: 'inc-dl', group: 'int', cands: ['inc dl', 'dec dl', 'inc dh', 'inc bl'], title: 'Contar la interrupción', why: 'Cada interrupción del temporizador suma 1 al contador DL, que el programa principal compara con ' + 18 * p.S + '.' };
    if (line === 'out 20h, al') return { kind: 'eoi', group: 'int', cands: ['out 20h, al', 'out 21h, al', 'out 60h, al', 'in al, 20h'], title: 'Fin de interrupción (EOI)', why: 'AL = 20h es el comando EOI y el puerto 20h es el del PIC. Sin él, el PIC no vuelve a enviar interrupciones y el contador deja de aumentar.' };
    if (line === 'iret') return { kind: 'iret', group: 'int', cands: ['iret', 'cli', 'sti', 'jmp repite'], title: 'Retorno de interrupción', why: 'IRET saca de la pila IP, CS y FLAGS y devuelve el control al programa principal donde fue interrumpido.' };
    if (line === 'xor dl, dl') return { kind: 'xor-dl', group: 'int', cands: ['xor dl, dl', 'xor dh, dh', 'xor bl, bl', 'inc dl'], title: 'Reiniciar el contador', why: 'DL vuelve a 0 para contar otro intervalo; si no, DL pasaría de ' + 18 * p.S + ' y «cmp dl, ' + 18 * p.S + ' / jne» no se cumpliría nunca más.' };
    if (line === 'mov ax, 0a000h') return { kind: 'seg-vid', group: 'gfx', cands: ['mov ax, 0a000h', 'mov ax, 0b800h', 'mov ax, 0b000h', 'mov ax, 0c000h'], title: 'Segmento de la memoria de video', why: 'En el modo gráfico 13h la memoria de video empieza en A000h (A0000h físico). B800h es la del modo texto.' };
    if ((m = /^mov di, 320\*(\d+)\+(\d+)$/.exec(line))) { const y = m[1], x = m[2]; return { kind: 'di-start', group: 'gfx', cands: uniq([line, 'mov di, 320*' + x + '+' + y, 'mov di, 160*' + y + '+' + x, 'mov di, ' + y + '+' + x, 'mov di, 320*' + y]), title: 'Posición inicial en pantalla', why: 'Desplazamiento = fila × 320 + columna = 320 × ' + y + ' + ' + x + ' (320 píxeles por fila, 1 byte por píxel).' }; }
    if ((m = /^mov cx, (\d+)$/.exec(line))) { const n = +m[1]; return { kind: 'cx', group: 'gfx', cands: uniq([n, n + 1, n * 2, Math.max(1, Math.floor(n / 2)), 16]).map(x => 'mov cx, ' + x), title: 'Número de vueltas del ciclo', why: p.shape === 'cols' ? 'Una vuelta dibuja una fila de píxeles de las 3 columnas: son ' + p.h + ' filas de alto ⇒ ' + p.h + ' vueltas.' : 'Cada vuelta escribe 4 píxeles por fila (EBX = 4 bytes) y las filas miden 16 píxeles de ancho: 16 ÷ 4 = 4 vueltas.' }; }
    if ((m = /^add di, (\d+)$/.exec(line))) { const n = +m[1]; return { kind: 'add-di', group: 'gfx', cands: uniq([n, n === 320 ? 4 : 320, 160, 2, 1]).map(x => 'add di, ' + x), title: n === 320 ? 'Pasar a la fila siguiente' : 'Avanzar 4 píxeles', why: n === 320 ? 'Cada fila de pantalla tiene 320 bytes (1 byte por píxel): sumar 320 baja una fila.' : 'Cada vuelta dibujó 4 píxeles (un dword); el siguiente grupo empieza 4 bytes más a la derecha.' }; }
    if (line === 'ror ebx, 1') return { kind: 'ror', group: 'gfx', cands: ['ror ebx, 1', 'rol ebx, 1', 'ror bx, 1', 'shr ebx, 1'], title: 'Cambiar el color', why: 'Gira los 32 bits una posición a la derecha: 04040404h → 02020202h → 01010101h… cada byte es el color de un píxel, así que cambia el color de todo el dibujo.' };
    if (line === 'jmp repite') return { kind: 'jmp', group: 'gfx', cands: ['jmp repite', 'jmp timer', 'jmp $', 'loop repite'], title: 'Volver a esperar', why: 'Vuelve a «repite:» para esperar otro intervalo y dibujar con el color siguiente.' };
    return null;
  }

  function signature(src, p) {
    const r = Emu.runSource(src, { timer: { period: 40 }, demo: true, maxSteps: 2300 * p.S + 1300 });
    if (!r.prog.ok) return 'ASM:' + r.prog.error;
    const tr = r.trace; const vm = tr.steps.map((s, i) => ({ s, i })).filter(o => o.s.vmode === 0x13);
    if (vm.length < 3) return 'FEW:' + vm.length + ':' + tr.halted.reason;
    const out = [];
    for (let k = 0; k < 2; k++) {
      const sc = Emu.screenAt(tr, vm[k + 1].i); let cnt = 0, h = 0; const cols = new Set();
      for (let i = 0; i < 64000; i++) { const v = sc.gfx[i]; if (v) { cnt++; cols.add(v); h = (h * 31 + i * 7 + v) >>> 0; } }
      out.push(cnt + '/' + h + '/' + [...cols].join(','));
    }
    out.push(vm[1].s.tick - vm[0].s.tick);
    return out.join('|');
  }

  function exFillTimer() {
    for (let attempt = 0; attempt < 60; attempt++) {
      const p = { S: pick([1, 1, 2]), shape: pick(['cols', 'rows']), h: pick([8, 12, 16, 20]), ...pick([{ x0: 160, y0: 100 }, { x0: 160, y0: 100 }, { x0: 80, y0: 50 }]) };
      const lines = timerLines(p); const src = lines.join('\n'); const sig = signature(src, p);
      if (sig.startsWith('ASM') || sig.startsWith('FEW')) throw new Error('reference program does not work: ' + sig + '\n' + src);
      const byGroup = { int: [], gfx: [] };
      lines.forEach((l, i) => { const k = timerKind(l, p); if (k) byGroup[k.group].push(i); });
      const chosen = uniq([...shuffle(byGroup.int).slice(0, 2), ...shuffle(byGroup.gfx).slice(0, ri(1, 2))]).sort((a, b) => a - b);
      const slots = []; let ok = true;
      for (const i of chosen) {
        const k = timerKind(lines[i], p); const orig = lines[i]; const wrong = [];
        for (const c of k.cands) {
          if (c === orig || wrong.includes(c)) continue;
          const mod = lines.slice(); mod[i] = c;
          if (signature(mod.join('\n'), p) === sig) continue; // behaves the same: not a valid distractor
          wrong.push(c);
        }
        if (wrong.length < 2) { ok = false; break; }
        const opts = shuffle([orig, ...shuffle(wrong).slice(0, 3)]);
        slots.push({ line: i, orig, opts, ans: opts.indexOf(orig), why: [k.title, k.why] });
      }
      if (!ok || slots.length < 3) continue;
      const blanked = lines.slice(); slots.forEach((s, n) => { blanked[s.line] = '________   ; (' + (n + 1) + ')'; });
      const verify = choices => { const mod = lines.slice(); slots.forEach((s, n) => { mod[s.line] = s.opts[choices[n]]; }); try { return signature(mod.join('\n'), p) === sig; } catch (e) { return false; } };
      return { id: ++uid, cat: 'p2fill', type: 'fill', title: 'Completa el código (interrupción del temporizador)', prompt: 'El siguiente código debe mostrar ' + timerGoal(p) + ' Elige la instrucción correcta para cada espacio en blanco (se comprueba ejecutando tu versión):', code: blanked.join('\n'), full: src, slots, verify,
        hint: 'Piensa primero qué hace cada bloque: (1) instalar la rutina en el vector 8, (2) esperar ' + 18 * p.S + ' ticks, (3) dibujar en modo 13h, (4) cambiar el color y reiniciar el contador; la rutina cuenta, envía el EOI y vuelve con IRET.', runSource: src, runOpts: { timer: { period: 40 }, demo: true, maxSteps: 2300 * p.S + 1300 } };
    }
    throw new Error('exFillTimer: could not build an exercise');
  }

  /* ================= theory (multiple choice / true-false) ================= */
  function mcqFrom(bank, cat, title) {
    const q = pick(bank); const order = shuffle(q[1].map((t, i) => ({ t, i })));
    return { id: ++uid, cat, type: 'mcq', title, prompt: q[0], opts: order.map(o => o.t), ans: order.findIndex(o => o.i === 0), why: q[2] };
  }
  const exInt = () => mcqFrom(C2.INT_MCQ, 'p2int', 'Interrupciones y temporizador');
  function exVF2() { const [s, v, w] = pick(C2.VF2); return { id: ++uid, cat: 'p2vf', type: 'mcq', title: 'Verdadero o falso', prompt: s, opts: ['Verdadero', 'Falso'], ans: v ? 0 : 1, why: w }; }
  const exTxtMcq = () => mcqFrom(C2.TXT_MCQ, 'p2txt', 'Video en modo texto y teclado (incluido, no entra)');

  /* ================= numeric calculations ================= */
  const CALC = [
    () => { const n = pick([8, 9, 0x10, 0x1C, 0x21, 0x13, 0x0A, 0x70]); return calc('p2calc', 'Tabla de vectores', 'En modo real, ¿en qué dirección (0000:XXXX) está la entrada del vector INT ' + hexOf(n) + '?', [FH('r', 'Dirección', n * 4, ['La entrada de la interrupción n está en 4 × n: 4 × ' + n + ' = ' + n * 4 + ' = ' + hexOf(n * 4) + '.', 'Cada entrada ocupa 4 bytes: 2 de IP y 2 de CS.'])]); },
    () => { const k = ri(0, 7); return calc('p2calc', 'IRQ y vectores', 'El dispositivo conectado a IRQ ' + k + ' genera la interrupción INT número… (en decimal)', [F('r', 'INT', 8 + k, '', ['IRQ 0..7 se corresponden con INT 8..15: 8 + ' + k + ' = ' + (8 + k) + '.', '(IRQ 0 = temporizador → INT 8; IRQ 1 = teclado → INT 9.)'])]); },
    () => { const S = ri(1, 4); return calc('p2calc', 'Ticks del temporizador', 'El temporizador interrumpe ≈ 18.2 veces por segundo (usa 18). ¿Qué valor va en «cmp dl, ____» para esperar ' + S + (S === 1 ? ' segundo' : ' segundos') + '?', [F('r', 'cmp dl,', 18 * S, '', [S + ' s × 18 interrupciones/s = ' + 18 * S + '.'])]); },
    () => { const N = 18 * ri(1, 4); return calc('p2calc', 'Ticks del temporizador', 'Un programa hace «cmp dl, ' + N + ' / jne @b» contando interrupciones del temporizador. ¿Cuántos segundos espera (aprox.)?', [F('r', 'Segundos', N / 18, 's', [N + ' ÷ 18 = ' + N / 18 + ' s.'])]); },
    () => { const init = pick([0x04040404, 0x01010101, 0x08080808, 0x02020202, 0x80808080]); const k = ri(1, 8); const left = Math.random() < 0.25; let v = init; const stp = []; for (let i = 1; i <= k; i++) { v = rot(v, 1, left); stp.push(left ? 'rol' : 'ror', ' → ', hexOf(v, 8), '  '); } return calc('p2calc', 'Rotaciones de EBX', 'EBX = ' + hexOf(init, 8) + '. ¿Cuánto vale EBX (en hexadecimal) después de ejecutar «' + (left ? 'rol' : 'ror') + ' ebx, 1» ' + k + (k === 1 ? ' vez' : ' veces') + '?', [FH('r', 'EBX', v, [(left ? 'ROL' : 'ROR') + ' gira los 32 bits una posición cada vez y no pierde ninguno:', stp.join('')], 8)]); },
    () => { const x = ri(0, 319), y = ri(0, 199); return calc('p2calc', 'Modo gráfico 13h', 'En el modo 13h (320 × 200, 1 byte por píxel), ¿qué desplazamiento DI corresponde al píxel de la columna ' + x + ' y la fila ' + y + '? (decimal)', [F('r', 'DI', y * 320 + x, '', ['Desplazamiento = fila × 320 + columna = ' + y + ' × 320 + ' + x + ' = ' + (y * 320 + x) + '.'])]); },
    () => { const x = ri(0, 319), y = ri(0, 199), off = y * 320 + x; return calc('p2calc', 'Modo gráfico 13h', 'En el modo 13h, DI = ' + off + '. ¿A qué píxel corresponde?', [F('x', 'Columna (x)', x, '', ['x = DI mod 320 = ' + off + ' mod 320 = ' + x + '.']), F('y', 'Fila (y)', y, '', ['y = DI ÷ 320 (parte entera) = ' + y + '.'])]); },
    () => { const S = pick([4, 8, 12, 16]), H = pick([8, 12, 16, 20, 24]); return calc('p2calc', 'Geometría de las columnas', 'Se dibujan en modo 13h tres columnas de 4 píxeles de ancho y ' + H + ' de alto, separadas ' + S + ' píxeles, escribiendo 4 píxeles por vez con EBX. Completa:', [F('c2', 'La 2.ª columna se escribe en [es:di + ?]', 4 + S, '', ['Una columna ocupa 4 píxeles y le siguen ' + S + ' de separación: 4 + ' + S + ' = ' + (4 + S) + '.']), F('c3', 'La 3.ª columna se escribe en [es:di + ?]', 2 * (4 + S), '', ['Dos veces el paso entre columnas: 2 × ' + (4 + S) + ' = ' + 2 * (4 + S) + '.']), F('cx', 'mov cx, ?', H, '', ['Una vuelta dibuja una fila de píxeles de las tres columnas: ' + H + ' filas de alto ⇒ ' + H + ' vueltas.']), F('add', 'add di, ?', 320, '', ['Cada fila de pantalla son 320 bytes.'])]); },
    () => { const W = pick([8, 16, 24, 32]), Hh = pick([2, 3, 4]), S = pick([4, 8, 12]); return calc('p2calc', 'Geometría de las filas', 'Se dibujan en modo 13h tres barras horizontales de ' + W + ' píxeles de ancho y ' + Hh + ' de alto, separadas ' + S + ' píxeles, escribiendo 4 píxeles por vez con EBX (cada vuelta escribe los 4 píxeles de cada fila de las barras). Completa:', [F('cx', 'mov cx, ?', W / 4, '', ['Cada vuelta cubre 4 píxeles de ancho: ' + W + ' ÷ 4 = ' + W / 4 + ' vueltas.']), F('add', 'add di, ?', 4, '', ['Cada vuelta avanza 4 píxeles (4 bytes) a la derecha.']), F('b2', 'La 2.ª barra empieza en [es:di + 320*?]', Hh + S, '', ['Altura de la barra + separación: ' + Hh + ' + ' + S + ' = ' + (Hh + S) + ' filas más abajo.']), F('b3', 'La 3.ª barra empieza en [es:di + 320*?]', 2 * (Hh + S), '', ['2 × ' + (Hh + S) + ' = ' + 2 * (Hh + S) + '.'])]); },
    () => { const sp = pick([0x7C00, 0x7B00, 0x9000, 0x6F00]); return calc('p2calc', 'La pila en la interrupción', 'SP vale ' + hexOf(sp, 4) + ' justo antes de que llegue una interrupción. ¿Cuánto vale SP (hex) al entrar a la rutina, y cuánto después del IRET?', [FH('in', 'SP al entrar', sp - 6, ['Se apilan FLAGS, CS e IP: 3 palabras = 6 bytes. SP − 6 = ' + hexOf(sp - 6, 4) + '.'], 4), FH('out', 'SP tras IRET', sp, ['IRET saca las 3 palabras: SP vuelve a ' + hexOf(sp, 4) + '.'], 4)]); },
    () => { const seg = pick([0xA000, 0xB800]), di = ri(0, 0xFA00); const phys = seg * 16 + di; return calc('p2calc', 'Segmento:desplazamiento', 'ES = ' + hexOf(seg, 4) + ' y DI = ' + hexOf(di, 4) + '. ¿Cuál es la dirección física (hex) a la que apunta [es:di]?', [FH('r', 'Dirección física', phys, ['Dirección física = segmento × 16 + desplazamiento = ' + hexOf(seg, 4) + ' × 10h + ' + hexOf(di, 4) + ' = ' + hexOf(phys, 5) + '.'], 5)]); }
  ];
  const exCalc = () => pick(CALC)();

  /* text mode + keyboard (included, not on this exam) */
  const COLORS = ['negro', 'azul', 'verde', 'cian', 'rojo', 'magenta', 'marrón', 'gris claro', 'gris oscuro', 'azul claro', 'verde claro', 'cian claro', 'rojo claro', 'magenta claro', 'amarillo', 'blanco'];
  const TXT = [
    () => { const r = ri(0, 24), c = ri(0, 79); return calc('p2txt', 'Modo texto: dirección de una celda', 'En el modo texto 80 × 25 (2 bytes por celda), ¿qué desplazamiento DI corresponde al carácter de la fila ' + r + ', columna ' + c + '? (decimal)', [F('r', 'DI', r * 160 + c * 2, '', ['Una fila = 80 columnas × 2 bytes = 160 bytes. DI = fila × 160 + columna × 2 = ' + r + ' × 160 + ' + c + ' × 2 = ' + (r * 160 + c * 2) + '.'])]); },
    () => { const r = ri(0, 24), c = ri(0, 79), off = r * 160 + c * 2; return calc('p2txt', 'Modo texto: celda de un desplazamiento', 'En el modo texto 80 × 25, DI = ' + off + ' apunta al byte de carácter de una celda. ¿Fila y columna?', [F('r', 'Fila', r, '', ['fila = DI ÷ 160 (entero) = ' + r + '.']), F('c', 'Columna', c, '', ['columna = (DI mod 160) ÷ 2 = ' + c + '.'])]); },
    () => { const fg = ri(1, 15), bg = ri(0, 7); const at = (bg << 4) | fg; return calc('p2txt', 'Byte de atributo', 'Texto ' + COLORS[fg] + ' (' + fg.toString(2).padStart(4, '0') + 'b) sobre fondo ' + COLORS[bg] + ' (' + bg.toString(2).padStart(4, '0') + 'b). ¿Qué byte de atributo (hex) hay que poner en DH?', [FH('r', 'Atributo', at, ['Atributo = fondo (bits 4-6) y color del texto (bits 0-3): ' + bg.toString(2).padStart(4, '0') + ' ' + fg.toString(2).padStart(4, '0') + 'b = ' + hexOf(at, 2) + '.'], 2)]); },
    () => { const sc = pick([0x1E, 0x1F, 0x20, 0x10, 0x11, 0x12, 0x2C, 0x01, 0x1C]); return calc('p2txt', 'Scan codes', 'La tecla tiene scan code de pulsación ' + hexOf(sc, 2) + '. ¿Qué scan code (hex) envía el teclado al soltarla?', [FH('r', 'Código de liberación', sc + 0x80, ['Código de liberación = pulsación + 80h (bit 7 = 1): ' + hexOf(sc, 2) + ' + 80h = ' + hexOf(sc + 0x80, 2) + '. Por eso «cmp al, 127 / ja» distingue pulsar de soltar.'], 2)]); },
    () => { const dr = pick([[1, -1, 158], [1, 1, 162], [1, 0, 160], [0, 1, 2], [-1, 1, -158]]); return calc('p2txt', 'Moverse por la pantalla de texto', 'En modo texto, ¿qué número hay que sumar a DI para moverse ' + (dr[0] === 0 ? '' : Math.abs(dr[0]) + (dr[0] > 0 ? ' fila hacia abajo' : ' fila hacia arriba')) + (dr[0] !== 0 && dr[1] !== 0 ? ' y ' : '') + (dr[1] === 0 ? '' : Math.abs(dr[1]) + (dr[1] > 0 ? ' columna a la derecha' : ' columna a la izquierda')) + '?', [F('r', 'DI + ?', dr[2], '', ['Una fila son 160 bytes y una columna 2 bytes: ' + dr[0] + ' × 160 + ' + dr[1] + ' × 2 = ' + dr[2] + '.'])]); }
  ];
  const exTxtCalc = () => pick(TXT)();

  const MAKERS = {
    p2fill: exFillTimer, p2int: exInt, p2vf: exVF2, p2calc: exCalc,
    p2txt: () => (Math.random() < 0.5 ? exTxtCalc() : exTxtMcq())
  };
  Object.assign(Ex.MAKERS, MAKERS);
  const E3 = { exFillTimer, exInt, exVF2, exCalc, exTxtCalc, exTxtMcq, timerLines, signature, CALC, TXT, MAKERS, rot };
  if (isNode) module.exports = E3; else root.Ex3 = E3;
})(typeof window !== 'undefined' ? window : globalThis);
