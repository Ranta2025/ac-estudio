/* Question banks for the 2nd partial exam: interrupts + timer (priority), graphics, and text-mode video + keyboard (included, not on this exam). */
(function (root) {
  'use strict';

  /* [question, [correct, wrong1, wrong2, wrong3], explanation] — the first option is always the correct one (shuffled at runtime) */
  const INT_MCQ = [
    ['¿Qué es una interrupción?', ['Una señal que hace que el procesador suspenda lo que hace, ejecute una rutina de servicio y después continúe donde estaba.', 'Un error que detiene el programa para siempre.', 'Una instrucción que repite un ciclo.', 'Un tipo de memoria.'], 'El hardware (o una instrucción INT) «interrumpe» el programa; al terminar la rutina, IRET lo devuelve exactamente al punto donde estaba.'],
    ['¿Qué contiene la tabla de vectores de interrupción?', ['Las direcciones (CS:IP) de las rutinas de servicio de cada interrupción.', 'Los códigos ASCII de las teclas.', 'Los colores de la paleta de video.', 'El código del sector de arranque.'], 'Hay 256 entradas; la entrada n guarda dónde está la rutina que atiende la interrupción n.'],
    ['En modo real, ¿dónde está la tabla de vectores de interrupción?', ['En 0000:0000 – 0000:03FF (los primeros 1024 bytes de la memoria).', 'En B800:0000.', 'En A000:0000.', 'En 0000:7C00.'], '256 vectores × 4 bytes = 1024 bytes = 400h.'],
    ['¿Cuántos bytes ocupa cada entrada de la tabla de vectores?', ['4 bytes: 2 para el desplazamiento (IP) y 2 para el segmento (CS).', '2 bytes.', '1 byte.', '8 bytes.'], 'Entrada = IP (palabra) + CS (palabra).'],
    ['¿En qué dirección está la entrada del vector n?', ['4 × n', '2 × n', 'n', 'n + 4'], 'Cada entrada ocupa 4 bytes: n × 4. Por eso INT 8 está en 4 × 8 = 20h.'],
    ['¿A qué número de interrupción corresponde el temporizador del sistema (IRQ 0)?', ['INT 8', 'INT 9', 'INT 10h', 'INT 0'], 'IRQ 0..7 se corresponden con INT 8..0Fh. El temporizador es IRQ 0 ⇒ INT 8; el teclado es IRQ 1 ⇒ INT 9.'],
    ['¿A qué número de interrupción corresponde el teclado (IRQ 1)?', ['INT 9', 'INT 8', 'INT 10h', 'INT 1'], 'IRQ 1 ⇒ INT 9 ⇒ entrada en 4 × 9 = 24h.'],
    ['¿Qué guarda la instrucción «mov [es:4*8+2], cs»?', ['El segmento (CS) de la rutina en la entrada del vector 8.', 'El desplazamiento de la rutina.', 'El número de interrupción.', 'El valor del contador de ticks.'], 'La primera palabra de la entrada (4*8) es el desplazamiento IP; la segunda (4*8+2) es el segmento CS.'],
    ['¿Para qué se hace «xor ax, ax» y «mov es, ax» antes de instalar un vector?', ['Para que ES = 0000h, el segmento donde está la tabla de vectores.', 'Para borrar la pantalla.', 'Para reiniciar el contador de ticks.', 'Para activar las interrupciones.'], 'La tabla está en 0000:0000; con ES = 0 la dirección [es:4*8] es 0000:0020.'],
    ['Al atender una interrupción, ¿qué guarda automáticamente el procesador en la pila?', ['FLAGS, CS e IP.', 'Solo IP.', 'AX, BX, CX y DX.', 'Nada.'], 'Se apilan 3 palabras (6 bytes): primero FLAGS, luego CS y por último IP (queda en el tope).'],
    ['¿En qué se diferencia IRET de RET?', ['IRET saca de la pila IP, CS y FLAGS; RET solo saca IP.', 'IRET es más rápido.', 'RET se usa en interrupciones.', 'No hay diferencia.'], 'Con RET en una rutina de interrupción quedarían CS y FLAGS en la pila y el programa se rompería.'],
    ['¿Para qué sirven «mov al, 20h» y «out 20h, al» al final de la rutina?', ['Para enviar el EOI (fin de interrupción) al controlador de interrupciones (PIC).', 'Para escribir un carácter en pantalla.', 'Para cambiar el color.', 'Para reiniciar el procesador.'], 'El comando 20h al puerto 20h le dice al PIC 8259 que ya se atendió la IRQ.'],
    ['¿Qué ocurre si la rutina del temporizador olvida enviar el EOI?', ['El PIC no vuelve a enviar interrupciones: el contador de ticks deja de aumentar.', 'Nada, funciona igual.', 'El programa se reinicia.', 'La pantalla se borra.'], 'El PIC espera el EOI antes de aceptar otra interrupción del mismo nivel o inferior.'],
    ['¿Qué hace la instrucción STI?', ['Pone IF = 1: el procesador atiende las interrupciones.', 'Pone IF = 0.', 'Salta a la rutina.', 'Retorna de la interrupción.'], 'STI = SeT Interrupt flag.'],
    ['¿Qué hace la instrucción CLI?', ['Pone IF = 0: el procesador ignora las interrupciones enmascarables.', 'Pone IF = 1.', 'Borra la pantalla.', 'Limpia los registros.'], 'CLI = CLear Interrupt flag.'],
    ['El temporizador del sistema genera aproximadamente…', ['18.2 interrupciones por segundo.', '1 interrupción por segundo.', '100 interrupciones por segundo.', '1000 interrupciones por segundo.'], 'El PIT (8253/8254) divide 1.193182 MHz entre 65536 ≈ 18.2 Hz.'],
    ['¿Qué valor se compara con DL para esperar aproximadamente 1 segundo?', ['18', '1', '60', '182'], '18 ticks ≈ 0.99 s.'],
    ['¿Y para esperar aproximadamente 2 segundos?', ['36', '2', '18', '72'], '2 × 18 = 36 ticks.'],
    ['¿Qué hace «inc dl» dentro de la rutina del temporizador?', ['Cuenta cuántas interrupciones han ocurrido.', 'Cambia el color.', 'Avanza el puntero de pantalla.', 'Envía el EOI.'], 'DL es el contador de ticks que el programa principal consulta.'],
    ['¿Por qué el programa principal hace «xor dl, dl» después de dibujar?', ['Para reiniciar la cuenta y esperar otro segundo.', 'Para borrar la pantalla.', 'Para apagar el temporizador.', 'Para cambiar de modo de video.'], 'Si DL no volviera a 0 pasaría de 18 y «cmp dl, 18 / jne» nunca se cumpliría otra vez.'],
    ['En «cmp dl, 18 / jne @b», ¿qué hace el programa principal mientras DL ≠ 18?', ['Repite la comparación (espera activa) mientras la rutina del temporizador incrementa DL.', 'Dibuja en pantalla.', 'Detiene el procesador.', 'Cambia el color.'], 'El bucle solo «espera»; el trabajo de contar lo hace la interrupción.'],
    ['¿Por qué «int 10h» es una interrupción de software?', ['Porque la provoca una instrucción del programa (INT) y no un dispositivo.', 'Porque la provoca el teclado.', 'Porque la provoca el reloj.', 'Porque no usa la tabla de vectores.'], 'INT n salta al vector n igual que una interrupción de hardware, y la rutina del BIOS termina con IRET.'],
    ['Al entrar a una rutina de interrupción de hardware, ¿qué valor tiene IF?', ['0: el procesador lo pone a 0 automáticamente.', '1', 'Indefinido.', 'Depende del programa.'], 'Así la rutina no es interrumpida a su vez; IRET restaura los FLAGS (y con ellos el IF anterior).'],
    ['Si SP vale 7C00h justo antes de una interrupción, ¿cuánto vale al entrar a la rutina?', ['7BFAh (SP − 6).', '7BFEh.', '7C06h.', '7C00h.'], 'Se apilan 3 palabras de 2 bytes: SP baja 6 bytes.'],
    ['¿Qué ventaja tienen las interrupciones frente a revisar (sondear) continuamente un dispositivo?', ['El procesador puede hacer otra cosa y solo atiende el dispositivo cuando este avisa.', 'Son más lentas.', 'No necesitan rutina.', 'Ninguna.'], 'Sondeo = preguntar una y otra vez; interrupción = que te avisen.'],
    ['¿Qué carga «mov ax, timer» en AX?', ['La dirección (desplazamiento) de la etiqueta timer.', 'El contenido de la memoria en timer.', 'El número 8.', 'El valor de DL.'], 'Una etiqueta es una dirección; sin corchetes se carga el número, no el contenido.'],
    ['¿Qué controlador recibe las peticiones de interrupción (IRQ) de los dispositivos y se las pasa al procesador?', ['El PIC (controlador programable de interrupciones, 8259).', 'La memoria caché.', 'La tarjeta de video.', 'El disco duro.'], 'El PIC ordena por prioridad las IRQ y envía el número de INT al procesador.']
  ];

  /* [statement, true?, reason] */
  const VF2 = [
    ['La tabla de vectores de interrupción ocupa 1024 bytes.', true, '256 entradas × 4 bytes.'],
    ['La entrada del vector 9 está en la dirección 0000:0024h.', true, '4 × 9 = 36 = 24h.'],
    ['IRQ 0 (temporizador) corresponde a INT 9.', false, 'IRQ 0 ⇒ INT 8. INT 9 es el teclado (IRQ 1).'],
    ['«mov [es:4*8], ax» guarda el desplazamiento de la rutina en el vector 8.', true, 'Con ES = 0, escribe en 0000:0020.'],
    ['Para instalar un vector hay que guardar solo el desplazamiento (IP); el segmento no hace falta.', false, 'Cada entrada tiene IP y CS: se guardan las dos palabras.'],
    ['El procesador guarda en la pila FLAGS, CS e IP al atender una interrupción.', true, 'Y IRET los recupera.'],
    ['Una rutina de interrupción debe terminar con RET.', false, 'Debe terminar con IRET (RET solo restaura IP).'],
    ['IRET restaura también los FLAGS.', true, 'Saca IP, CS y FLAGS de la pila.'],
    ['«out 20h, al» con AL = 20h envía el EOI al PIC.', true, 'Fin de interrupción: el PIC puede enviar otra.'],
    ['Si no se envía el EOI, el PIC sigue enviando interrupciones normalmente.', false, 'El PIC se queda esperando el EOI.'],
    ['STI desactiva las interrupciones.', false, 'STI las activa (IF = 1); CLI las desactiva.'],
    ['Al entrar a una interrupción de hardware, el procesador pone IF = 0.', true, 'Para que la rutina no sea interrumpida.'],
    ['El temporizador genera aproximadamente 18 interrupciones por segundo.', true, '18.2 Hz.'],
    ['Para esperar 2 segundos se compara el contador con 18.', false, 'Con 36 (2 × 18).'],
    ['«int 10h» es una interrupción de hardware.', false, 'Es una interrupción de software: la provoca la instrucción INT.'],
    ['Con «jmp $» e interrupciones activas, el programa principal puede seguir reaccionando a las interrupciones.', true, 'La rutina se ejecuta cuando llega la interrupción y IRET vuelve a «jmp $».'],
    ['La rutina del temporizador puede modificar cualquier registro sin consecuencias.', false, 'Debe respetar los registros que usa el programa principal (o guardarlos con PUSH/POP).'],
    ['«xor dl, dl» pone DL a 0.', true, 'XOR de un valor consigo mismo da 0.'],
    ['Después de interrupción, SP vale 6 bytes menos que antes.', true, '3 palabras apiladas (FLAGS, CS, IP).'],
    ['El PIC es el controlador que gestiona las peticiones IRQ de los dispositivos.', true, 'Programmable Interrupt Controller (8259).'],
    ['«mov ebx, 04040404h» carga un valor de 16 bits.', false, 'EBX es un registro de 32 bits.'],
    ['«ror ebx, 1» gira los bits a la derecha: el bit 0 pasa a ser el bit 31.', true, 'La rotación no pierde bits.'],
    ['Después de «ror ebx, 1» con EBX = 04040404h, EBX vale 02020202h.', true, 'Cada byte pasa de 04h a 02h.'],
    ['En el modo gráfico 13h la memoria de video empieza en el segmento A000h.', true, 'A000h × 16 = A0000h.'],
    ['En el modo 13h cada píxel ocupa 2 bytes.', false, '1 byte por píxel (256 colores).'],
    ['En el modo 13h el desplazamiento del píxel (x, y) es y × 320 + x.', true, '320 píxeles por fila.'],
    ['«mov [es:di], ebx» dibuja 4 píxeles contiguos.', true, 'EBX tiene 4 bytes = 4 píxeles (1 byte cada uno).'],
    ['El centro de la pantalla en modo 13h es el píxel (160, 100).', true, '320 ÷ 2 = 160 y 200 ÷ 2 = 100.'],
    ['«add di, 320» baja una fila en modo 13h.', true, 'Una fila = 320 bytes.']
  ];

  /* text mode + keyboard (included, NOT on this exam) */
  const TXT_MCQ = [
    ['En el modo texto 80 × 25, ¿cuántos bytes ocupa una fila de la pantalla?', ['160 bytes (80 columnas × 2 bytes).', '80 bytes.', '25 bytes.', '320 bytes.'], 'Cada celda de pantalla usa 2 bytes: el carácter y su atributo.'],
    ['¿Por qué se avanza de 2 en 2 («add di, 2») para pasar al carácter siguiente en modo texto?', ['Porque cada carácter ocupa 2 bytes: el código ASCII y el atributo (color).', 'Porque la pantalla tiene 2 filas.', 'Porque DI es de 16 bits.', 'Porque hay 2 modos de video.'], 'Un carácter en pantalla = 1 byte de carácter + 1 byte de atributo.'],
    ['¿En qué segmento está la memoria de video del modo texto?', ['B800h (dirección física B8000h).', 'A000h.', '0000h.', '7C00h.'], 'En modo gráfico 13h es A000h.'],
    ['En «mov [es:di], dx» con DL = \'z\' y DH = 2, ¿qué byte se escribe primero (dirección menor)?', ['DL: el carácter \'z\'.', 'DH: el atributo.', 'Los dos a la vez.', 'Ninguno.'], 'x86 es little-endian: el byte bajo (DL) va en la dirección menor y el alto (DH, el atributo) en la siguiente.'],
    ['En el byte de atributo, ¿qué indican los 4 bits bajos?', ['El color del texto (primer plano).', 'El color de fondo.', 'La fila.', 'El parpadeo.'], 'Bits 0-3: color del carácter; bits 4-6: fondo; bit 7: parpadeo/intensidad.'],
    ['El atributo 02h significa…', ['Texto verde sobre fondo negro.', 'Texto negro sobre fondo verde.', 'Texto rojo.', 'Texto blanco.'], '0010b = verde (bits bajos) y fondo 0000b = negro.'],
    ['¿Qué puerto contiene el scan code de la última tecla?', ['60h', '64h', '20h', '10h'], 'El puerto 60h es el de datos del teclado; el 64h es el de estado.'],
    ['¿Qué indica el bit 0 del puerto 64h?', ['Que hay un byte esperando en el puerto 60h.', 'Que se pulsó Enter.', 'Que el teclado está apagado.', 'Que hay una interrupción.'], 'Se sondea con «in al, 64h / test al, 1 / jz».'],
    ['Un scan code mayor que 127 indica que la tecla fue…', ['Soltada.', 'Pulsada.', 'Mantenida.', 'Inválida.'], 'Código de liberación = código de pulsación + 80h (bit 7 = 1).'],
    ['¿Qué hace «mov ax, 3» seguido de «int 10h»?', ['Fija el modo de video texto 80 × 25 y borra la pantalla.', 'Fija el modo gráfico.', 'Lee el teclado.', 'Envía el EOI.'], 'AH = 0 (fijar modo), AL = 3 (modo texto).'],
    ['Para pasar a la fila siguiente y una columna a la izquierda en modo texto se suma…', ['158 (160 − 2).', '162.', '2.', '160.'], '+160 baja una fila y −2 retrocede una columna.'],
    ['«mov di, 160*4+64» apunta a…', ['La fila 4, columna 32 (contando desde 0).', 'La fila 64.', 'La fila 4, columna 64.', 'La columna 4.'], '64 bytes ÷ 2 bytes por carácter = columna 32.']
  ];

  const C2 = { INT_MCQ, VF2, TXT_MCQ };
  if (typeof module !== 'undefined' && module.exports) module.exports = C2; else root.Content2 = C2;
})(typeof window !== 'undefined' ? window : globalThis);
