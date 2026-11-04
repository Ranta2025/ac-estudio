/* Programs of the "2da prueba parcial" (curso 2024-2025, Batería A and B), transcribed from the photos.
 * Q2 = trace + questions (video text mode + keyboard), Q3 = code completion (timer interrupt + graphics).
 * `underlined` = lines that were underlined on the paper (part d of question 2).
 * For Q3, `blanks` lists the missing pieces: { line: index in `solution`, answer, alt (equivalent answers) }.
 */
(function (root) {
  'use strict';

  const A_Q2 = [
    "format binary as 'img'", 'org 7C00h', 'mov ax, cs', 'mov ds, ax', 'repite:', '', '@@:', 'in al, 64h', 'test al, 1', 'jz @b', 'in al, 60h', 'cmp al, 127', 'ja salta', 'mov dh, 1', 'jmp visualiza',
    'salta:', 'mov dh, 2', 'visualiza:', 'mov ax, 3', 'int 10h', '', 'mov ax, 0b800h', 'mov es, ax', 'mov di, 160*4+64', "mov dl, 'z'", '', 'mov cx, 32', '@@:', 'mov [es:di], dx', 'mov [es:di+160*16], dx', 'add di, 2', 'loop @b', '',
    'mov cx, 15', '@@:', 'add di, 158', 'mov [es:di], dx', 'mov [es:di-32], dx', 'loop @b', '', 'jmp repite', '', 'times 510-($-$$) db 0', 'dw 0AA55h'
  ].join('\n');

  const B_Q2 = [
    "format binary as 'img'", 'org 7C00h', 'xor ax, ax', 'mov es, ax', 'mov ax, keyboard', 'mov [es:4*9], ax', 'mov [es:4*9+2], cs', 'mov ax, 3h', 'int 10h', 'sti', 'jmp $',
    'keyboard:', 'in al, 60h', 'cmp al, 127', 'ja salta', 'mov dh, 4', 'jmp visualiza', 'salta:', 'mov dh, 1', 'visualiza:', 'mov ax, 3', 'int 10h', 'mov di, 160*20+64', 'mov ax, 0b800h', 'mov es, ax', "mov dl, 'z'", 'mov cx, 32', '@@:',
    'mov [es:di], dx', 'mov [es:di-160*16], dx', 'add di, 2', 'loop @b', 'mov cx, 15', 'sub di, 190', '@@:', 'mov [es:di], dx', 'mov [es:di-32], dx', 'sub di, 158', 'loop @b', 'mov al, 20h', 'out 20h, al', 'iret', '', 'times 510-($-$$) db 0', 'dw 0AA55h'
  ].join('\n');

  /* ---- question 3: complete solutions (the blanks are filled in) ---- */
  const A_Q3 = [
    "format binary as 'img'", 'org 7C00h', 'mov ax, cs', 'mov ds, ax', 'xor di, di', 'xor dl, dl', 'xor ax, ax', 'mov es, ax', 'mov ax, timer', 'mov [es:4*8], ax', 'mov [es:4*8+2], cs', 'sti', 'mov ebx, 04040404h',
    'repite:', '@@:', 'cmp dl, 18', 'jne @b',
    'mov ax, 13h', 'int 10h', 'mov ax, 0a000h', 'mov es, ax', '', 'mov di, 320*100+160', 'mov cx, 16', '@@:', 'mov [es:di], ebx', 'mov [es:di+12], ebx', 'mov [es:di+24], ebx', 'add di, 320', 'loop @b',
    'ror ebx, 1', 'xor dl, dl', 'jmp repite', '', 'timer:', 'cli', 'inc dl', 'mov al, 20h', 'out 20h, al', 'sti', 'iret', '', 'times 510-($-$$) db 0', 'dw 0AA55h'
  ].join('\n');

  const B_Q3 = [
    "format binary as 'img'", 'org 7C00h', 'mov ax, cs', 'mov ds, ax', 'xor di, di', 'xor dl, dl', 'xor ax, ax', 'mov es, ax', 'mov ax, timer', 'mov [es:4*8], ax', 'mov [es:4*8+2], cs', 'sti', 'mov ebx, 04040404h',
    'repite:', '@@:', 'cmp dl, 18', 'jne @b',
    'mov ax, 13h', 'int 10h', 'mov ax, 0a000h', 'mov es, ax', 'mov di, 320*100+160', 'mov cx, 4', '@@:', 'mov [es:di], ebx', 'mov [es:di+320], ebx', 'mov [es:di+320*10], ebx', 'mov [es:di+320*11], ebx', 'mov [es:di+320*20], ebx', 'mov [es:di+320*21], ebx', 'add di, 4', 'loop @b',
    'ror ebx, 1', 'xor dl, dl', 'jmp repite', '', 'timer:', 'cli', 'inc dl', 'mov al, 20h', 'out 20h, al', 'sti', 'iret', '', 'times 510-($-$$) db 0', 'dw 0AA55h'
  ].join('\n');

  /* blanks: matched by line text in the solution (first occurrence after `after`) */
  const A_BLANKS = [
    { text: 'mov ax, timer', prompt: 'mov ax, ____', answer: 'timer', why: 'AX recibe la dirección de la rutina de servicio (la etiqueta «timer»): es el desplazamiento (IP) que se guardará en la tabla de vectores.' },
    { text: 'mov [es:4*8], ax', prompt: '(línea que falta o se sobreentiende) mov [es:4*8], ax', answer: 'mov [es:4*8], ax', why: 'Guarda el desplazamiento de «timer» en la entrada 8 de la tabla de vectores (4 × 8 = 20h). La siguiente línea guarda el segmento (CS) en 4*8+2.', extra: true },
    { text: 'cmp dl, 18', prompt: 'cmp dl, ____', answer: '18', why: 'El temporizador interrumpe unas 18.2 veces por segundo: 18 interrupciones ≈ 1 segundo. DL cuenta las interrupciones.' },
    { text: 'int 10h', prompt: '____  (después de mov ax, 13h)', answer: 'int 10h', why: 'AH=00h, AL=13h: la BIOS fija el modo gráfico 320 × 200 con 256 colores.' },
    { text: 'mov ax, 0a000h', prompt: 'mov ax, ____', answer: '0a000h', why: 'A000h es el segmento de la memoria de video en modo gráfico (A0000h físico).' },
    { text: 'mov di, 320*100+160', prompt: 'mov di, ____', answer: '320*100+160', why: 'El centro de la pantalla de 320 × 200 es la columna 160, fila 100: desplazamiento = fila × 320 + columna.' },
    { text: 'mov cx, 16', prompt: 'mov cx, ____', answer: '16', why: 'Las columnas miden 16 píxeles de alto: una vuelta del ciclo dibuja una fila de píxeles, así que 16 vueltas.' },
    { text: 'add di, 320', prompt: 'add di, ____', answer: '320', why: 'Cada fila tiene 320 píxeles (1 byte por píxel): sumar 320 baja una fila.' },
    { text: 'xor dl, dl', prompt: 'xor ____', answer: 'dl, dl', why: 'Pone el contador de interrupciones DL a 0 para volver a contar otro segundo.' },
    { text: 'inc dl', prompt: '(rutina timer) ____', answer: 'inc dl', why: 'Cada interrupción del temporizador suma 1 al contador DL.' },
    { text: 'out 20h, al', prompt: 'mov al, 20h / ____', answer: 'out 20h, al', why: 'EOI: se envía 20h al puerto 20h del PIC para avisar que la interrupción ya fue atendida.' },
    { text: 'iret', prompt: 'sti / ____', answer: 'iret', why: 'Retorno de interrupción: restaura IP, CS y FLAGS y vuelve al programa principal.' }
  ];
  const B_BLANKS = [
    { text: 'org 7C00h', prompt: '____', answer: 'org 7C00h', why: 'Dirección de carga del sector de arranque.' },
    { text: 'mov [es:4*8], ax', prompt: '____  (después de mov ax, timer)', answer: 'mov [es:4*8], ax', why: 'Guarda el desplazamiento de la rutina «timer» en el vector 8 (4 × 8). El siguiente renglón guarda el segmento.' },
    { text: 'cmp dl, 18', prompt: 'cmp dl, ____', answer: '18', why: '18 interrupciones del temporizador ≈ 1 segundo (18.2 Hz).' },
    { text: 'mov ax, 0a000h', prompt: 'mov ax, ____', answer: '0a000h', why: 'Segmento de la memoria de video del modo gráfico 13h.' },
    { text: 'mov cx, 4', prompt: 'mov cx, ____', answer: '4', why: 'Cada vuelta escribe 4 píxeles por fila (un doble palabra = 4 bytes) y las filas miden 16 píxeles: 16 ÷ 4 = 4 vueltas.' },
    { text: 'jmp repite', prompt: 'jmp ____', answer: 'repite', why: 'Vuelve a esperar otro segundo.' },
    { text: 'inc dl', prompt: '(rutina timer) ____', answer: 'inc dl', why: 'Cuenta las interrupciones del temporizador.' },
    { text: 'out 20h, al', prompt: 'mov al, 20h / ____', answer: 'out 20h, al', why: 'EOI al controlador de interrupciones (PIC).' },
    { text: 'iret', prompt: 'sti / ____', answer: 'iret', why: 'Retorno de la interrupción.' }
  ];

  const EXAMS2 = [
    {
      id: 'A2', bat: 'A', q: 2, source: A_Q2, kind: 'trace',
      underlined: ['mov dh, 2', 'test al, 1', 'in al, 60h', 'cmp al, 127', 'add di, 158'],
      data: [['0001b', 'azul'], ['0010b', 'verde'], ['0100b', 'rojo'], ['0000b', 'negro'], ['1111b', 'blanco']],
      scenarios: [
        { label: 'Se PRESIONA una tecla (scan code 1Eh = A)', events: [{ at: 12, kind: 'key', scan: 0x1E }], attr: 1 },
        { label: 'Se SUELTA una tecla (scan code 9Eh)', events: [{ at: 12, kind: 'key', scan: 0x9E }], attr: 2 }
      ]
    },
    {
      id: 'B2', bat: 'B', q: 2, source: B_Q2, kind: 'trace',
      underlined: ['mov [es:4*9], ax', 'mov [es:4*9+2], cs', 'in al, 60h', 'cmp al, 127', 'out 20h, al'],
      data: [['0001b', 'azul'], ['0010b', 'verde'], ['0100b', 'rojo'], ['0000b', 'negro'], ['1111b', 'blanco']],
      scenarios: [
        { label: 'Se PRESIONA una tecla (scan code 1Eh = A)', events: [{ at: 40, kind: 'key', scan: 0x1E }], attr: 4 },
        { label: 'Se SUELTA una tecla (scan code 9Eh)', events: [{ at: 40, kind: 'key', scan: 0x9E }], attr: 1 }
      ]
    },
    { id: 'A3', bat: 'A', q: 3, source: A_Q3, kind: 'complete', blanks: A_BLANKS, goal: 'tres columnas de 4 píxeles de ancho y 16 de alto, separadas 8 píxeles, a partir del centro, que cambian de color cada segundo', timer: { period: 40 } },
    { id: 'B3', bat: 'B', q: 3, source: B_Q3, kind: 'complete', blanks: B_BLANKS, goal: 'tres filas de 16 píxeles de ancho y 2 de alto, separadas 8 píxeles, a partir del centro, que cambian de color cada segundo', timer: { period: 40 } }
  ];

  const P2 = { EXAMS2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = P2; else root.Programs2 = P2;
})(typeof window !== 'undefined' ? window : globalThis);
