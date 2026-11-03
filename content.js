/* Teaching content (Spanish): line explainer, instruction cards, anatomy, concept questions. */
(function (root) {
  'use strict';

  /* ---------- line explainer (used for "b) explica las instrucciones subrayadas") ---------- */
  const ROLE = { si: 'SI (puntero de LECTURA / origen)', di: 'DI (puntero de ESCRITURA / destino)', bx: 'BX (segundo puntero de escritura)' };

  function prevFlagLine(lines, idx) {
    for (let i = idx - 1; i >= 0; i--) {
      const t = lines[i].trim().toLowerCase();
      if (/^(cmp|test|and|or|xor)\b/.test(t)) return t;
      if (/^(ciclo:|@@:|loop|jmp)/.test(t)) return null;
    }
    return null;
  }

  const JMP_TXT = {
    jz: ['ZF=1: el resultado fue 0', 'son iguales / el resultado fue 0'], je: ['ZF=1', 'son iguales'],
    jnz: ['ZF=0: el resultado NO fue 0', 'son distintos / el resultado no fue 0'], jne: ['ZF=0', 'son distintos'],
    ja: ['CF=0 y ZF=0', 'el primero es MAYOR (sin signo)'], jae: ['CF=0', 'el primero es MAYOR O IGUAL'],
    jb: ['CF=1', 'el primero es MENOR'], jbe: ['CF=1 o ZF=1', 'el primero es MENOR O IGUAL']
  };

  function explainLine(lines, idx) {
    const raw = lines[idx].trim();
    const t = raw.replace(/\s+/g, ' ');
    let m;
    if ((m = /^format binary as 'img'$/i.exec(t))) return ["Directiva de FASM", "Le dice al ensamblador que genere un archivo BINARIO PLANO (una imagen de disco, 'img'), sin cabeceras. Es lo que necesita el BIOS: los bytes crudos del sector de arranque."];
    if (/^org 7C00h$/i.test(t)) return ['Directiva ORG', 'Indica la dirección donde el programa será CARGADO en memoria. El BIOS copia el sector de arranque a la dirección 0000:7C00h y salta allí, así que todas las etiquetas (num1, num2, ciclo…) se calculan sumando 7C00h. No genera ningún byte: solo informa al ensamblador.'];
    if (/^mov ax, ?cs$/i.test(t)) return ['Preparar DS (paso 1)', 'Copia el registro de segmento CS (donde está el código) en AX. Se hace en dos pasos porque 8086 no permite copiar un número ni CS directamente a DS.'];
    if (/^mov ds, ?ax$/i.test(t)) return ['Preparar DS (paso 2)', 'DS ← AX. Ahora DS = CS: el segmento de datos coincide con el del código, y como los datos (num1, num2, cadena…) están dentro del mismo sector, [si], [di] y [bx] acceden a ellos correctamente.'];
    if ((m = /^mov (si|di|bx), ?([A-Za-z_]\w*)(?:\+(\d+))?$/i.exec(t))) {
      const reg = m[1].toLowerCase(); const lab = m[2]; const off = m[3];
      return ['Inicializar un puntero', 'Carga en ' + reg.toUpperCase() + ' la DIRECCIÓN de «' + lab + (off ? '+' + off : '') + '»' + (off ? ' (el elemento número ' + (+off + 1) + ' del arreglo, porque se empieza a contar desde 0)' : ' (su primer elemento)') + '. ' + ROLE[reg] + '. Ojo: en FASM «mov ' + reg + ', ' + lab + '» carga la dirección, NO el contenido.'];
    }
    if ((m = /^mov cx, ?(\d+)$/i.exec(t))) return ['Inicializar el contador del ciclo', 'CX ← ' + m[1] + '. LOOP resta 1 a CX en cada vuelta y repite mientras CX ≠ 0, por lo tanto el ciclo se ejecuta exactamente ' + m[1] + ' veces. ' + (+m[1] > 0 ? 'Normalmente es la cantidad de elementos a procesar.' : '')];
    if (/^ciclo:$/i.test(t)) return ['Etiqueta del ciclo', 'Marca el comienzo del cuerpo del ciclo. No es una instrucción (no ocupa bytes): es solo un nombre para la dirección. LOOP vuelve aquí en cada repetición.'];
    if (/^sgte:$/i.test(t)) return ['Etiqueta «sgte»', 'Punto de unión: tanto la rama «guardar en num2» como la rama «guardar en num3» terminan aquí para avanzar al siguiente elemento.'];
    if (/^@@:$/i.test(t)) return ['Etiqueta anónima @@', 'Destino de los saltos «@f» (forward = hacia adelante). Cuando un elemento NO cumple la condición, salta hasta aquí y se salta el bloque que lo guarda.'];
    if (/^mov al, ?\[si\]$/i.test(t)) return ['Leer el elemento actual', 'Lee 1 byte de la memoria en la dirección que contiene SI y lo copia en AL. Es «el elemento que toca procesar en esta vuelta». Los corchetes [ ] significan «el contenido de esa dirección».'];
    if ((m = /^and al, ?1$/i.exec(t))) return ['Aislar el bit 0 (¿par o impar?)', 'AL ← AL AND 1. Deja solo el bit menos significativo: da 0 si el número es PAR y 1 si es IMPAR. Pone ZF=1 cuando el resultado es 0. Atención: AND SÍ modifica AL (destruye el número original), por eso después hace falta volver a cargarlo con otro «mov al,[si]».'];
    if (/^test al, ?1$/i.test(t)) return ['Probar el bit 0 (¿par o impar?)', 'Hace AL AND 1 pero NO guarda el resultado: AL conserva su valor y solo se actualizan las banderas. ZF=1 si el número es PAR, ZF=0 si es IMPAR. Por eso con TEST no hace falta recargar AL.'];
    if ((m = /^cmp al, ?(.+)$/i.exec(t))) return ['Comparar AL con ' + m[1], 'Calcula AL − ' + m[1] + ' sin guardar el resultado; solo actualiza las banderas (ZF=1 si son iguales, CF=1 si AL < ' + m[1] + ' sin signo). El salto condicional que viene después usa esas banderas. AL no cambia.'];
    if ((m = /^(jz|je|jnz|jne|ja|jae|jb|jbe|jnb|jnae|jna|jnbe) (@f|@b|\w+)$/i.exec(t))) {
      let op = m[1].toLowerCase(); const alias = { jnb: 'jae', jnae: 'jb', jna: 'jbe', jnbe: 'ja' }; op = alias[op] || op;
      const prev = prevFlagLine(lines, idx); const tg = m[2].toLowerCase() === '@f' ? 'hacia adelante, hasta el siguiente @@' : (m[2] === '@b' ? 'hacia atrás, hasta el @@ anterior' : 'a la etiqueta «' + m[2] + '»');
      let extra = '';
      if (prev && /^(and|test)/.test(prev) && (op === 'jz' || op === 'jnz')) extra = op === 'jz' ? ' Después de «' + prev + '», ZF=1 significa que el número es PAR; por eso este salto se toma con los PARES y no se guardan.' : ' Después de «' + prev + '», ZF=0 significa que el número es IMPAR; por eso este salto se toma con los IMPARES.';
      else if (prev && /^cmp/.test(prev)) extra = ' Usa el resultado de «' + prev + '»: salta cuando ' + JMP_TXT[op][1] + '.';
      return ['Salto condicional ' + op.toUpperCase(), 'Salta ' + tg + ' si ' + JMP_TXT[op][0] + '. Si no se cumple, continúa con la siguiente línea.' + extra + ' Es el «if» del programa.'];
    }
    if (/^mov \[(di|bx)\], ?al$/i.test(t)) return ['Guardar el elemento', 'Escribe AL en la memoria, en la posición a la que apunta ' + /\[(\w+)\]/.exec(t)[1].toUpperCase() + '. Solo se llega aquí con los elementos que pasaron el filtro.'];
    if ((m = /^(inc|dec) (si|di|bx)$/i.exec(t))) return [(m[1] === 'inc' ? 'Avanzar' : 'Retroceder') + ' el puntero ' + m[2].toUpperCase(), m[2].toUpperCase() + ' ← ' + m[2].toUpperCase() + (m[1] === 'inc' ? ' + 1' : ' − 1') + ': el puntero pasa a la posición ' + (m[1] === 'inc' ? 'siguiente' : 'anterior') + ' (1 byte). ' + ROLE[m[2].toLowerCase()] + '.'];
    if ((m = /^(add|sub) (si|di|bx), ?(\d+)$/i.exec(t))) return [(m[1] === 'add' ? 'Avanzar' : 'Retroceder') + ' ' + m[3] + ' posiciones', m[2].toUpperCase() + ' ← ' + m[2].toUpperCase() + (m[1] === 'add' ? ' + ' : ' − ') + m[3] + '. Como cada elemento ocupa 1 byte, el puntero se mueve ' + m[3] + ' elementos ' + (m[1] === 'add' ? 'hacia adelante' : 'hacia atrás') + ' (se saltan los intermedios). ' + ROLE[m[2].toLowerCase()] + '.'];
    if ((m = /^loop (\w+)$/i.exec(t))) return ['Repetir el ciclo', 'Hace dos cosas: (1) CX ← CX − 1; (2) si CX ≠ 0 salta a «' + m[1] + '», si CX = 0 sale del ciclo y continúa. No modifica las banderas.'];
    if (/^jmp \$$/i.test(t)) return ['Detener el programa', '«$» es la dirección de esta misma instrucción, así que «jmp $» salta a sí misma indefinidamente: un bucle infinito. Un sector de arranque no tiene sistema operativo al que volver, así que se «cuelga» aquí a propósito para que la CPU no ejecute los datos que vienen después.'];
    if ((m = /^jmp (\w+)$/i.exec(t))) return ['Salto incondicional', 'Salta siempre a «' + m[1] + '». Se usa para saltarse el bloque alternativo (el «else»), para que no se ejecute también la rama contraria.'];
    if ((m = /^(\w+) db (\d+) dup ?\((.*)\)$/i.exec(t))) return ['Reservar el arreglo destino', 'Define «' + m[1] + '»: reserva ' + m[2] + ' bytes y a cada uno le pone el valor inicial ' + m[3] + ' (DUP = repetir). Es el arreglo donde el programa va a escribir; los valores iniciales que no se sobrescriban quedan tal cual en el resultado.'];
    if ((m = /^(\w+) db '(.*)'$/i.exec(t))) return ['Definir una cadena', 'Define «' + m[1] + '» como ' + m[2].length + ' bytes: los códigos ASCII de los caracteres «' + m[2] + '». DB = Define Byte.'];
    if ((m = /^(\w+) db (.*)$/i.exec(t))) return ['Definir datos (bytes)', 'Define el arreglo «' + m[1] + '» con los bytes indicados, uno detrás de otro en memoria (DB = Define Byte). Es el origen de datos que el programa recorre con SI.'];
    if (/^times 510-\(\$-\$\$\) db 0$/i.test(t)) return ['Rellenar con ceros hasta 510 bytes', '«$» es la dirección actual y «$$» la dirección de inicio, por lo que «$-$$» = bytes que ocupa el programa hasta aquí. Se escriben 510 − ese número bytes con valor 0, de modo que lo que viene después (la firma de 2 bytes) quede exactamente en los bytes 511 y 512 del sector, que mide 512 bytes.'];
    if (/^dw 0AA55h$/i.test(t)) return ['Firma de arranque (boot signature)', 'Define una palabra (2 bytes) con 0AA55h. Como el 8086 guarda en little-endian, en el sector quedan los bytes 55h y AAh en las posiciones 511 y 512. El BIOS solo considera ARRANCABLE un sector si termina con esta firma; sin ella lo ignora.'];
    return ['', 'Sin explicación automática para esta línea.'];
  }

  /* ---------- instruction cards ---------- */
  const CARDS = [
    {
      g: 'Datos', n: 'mov', syn: 'mov destino, origen', what: 'Copia el valor de «origen» en «destino». El origen no cambia.', flags: 'No modifica las banderas.',
      rules: ['Los dos operandos deben tener el MISMO tamaño (AL con BL, AX con BX; no AL con BX).', 'No se puede copiar de memoria a memoria (mov [di],[si] es inválido): se pasa por un registro (mov al,[si] / mov [di],al).', 'A un registro de segmento no se le puede dar un número: por eso se usa mov ax,cs / mov ds,ax.', 'mov si, num1 → SI = DIRECCIÓN de num1.   mov al, [si] → AL = CONTENIDO de esa dirección.'],
      ex: [{ code: 'mov al, 52\nmov bl, al\njmp $', note: 'AL = 52, luego BL = 52.' }], exam: 'Aparece en todas las pruebas: mov si, num1 / mov cx, 10 / mov al,[si] / mov [di],al.'
    },
    {
      g: 'Aritmética', n: 'add / sub', syn: 'add destino, origen     sub destino, origen', what: 'destino ← destino ± origen. Se usa para mover punteros: add di,2 avanza 2 posiciones; sub si,3 retrocede 3.', flags: 'Modifica ZF, CF, SF, OF, PF.',
      rules: ['CF=1 en add si hay «acarreo» (el resultado no cabe); CF=1 en sub si hubo «préstamo» (origen > destino, sin signo).'],
      ex: [{ code: 'mov si, 10\nadd si, 2\nsub si, 5\njmp $', note: 'SI = 12, luego 7.' }], exam: 'add di,2 / add bx,2 (avanzar de 2 en 2) y sub si,3 / sub di,2 (retroceder).'
    },
    {
      g: 'Aritmética', n: 'inc / dec', syn: 'inc destino     dec destino', what: 'Suma o resta 1. Es la forma corta de avanzar o retroceder un puntero un elemento.', flags: 'Modifica ZF, SF, OF, PF pero NO modifica CF.',
      rules: ['inc si = «pasa al siguiente byte».  dec di = «ve al byte anterior».'],
      ex: [{ code: 'mov bl, 9\ninc bl\ndec bl\ndec bl\njmp $', note: 'BL = 10, luego 9, luego 8.' }], exam: 'inc si / inc di / dec di en los programas de cadenas.'
    },
    {
      g: 'Lógicas', n: 'and', syn: 'and destino, origen', what: 'AND bit a bit; guarda el resultado en destino. «and al,1» deja solo el bit 0: da 0 (par) o 1 (impar).', flags: 'ZF=1 si el resultado es 0. CF=0 y OF=0.',
      rules: ['DESTRUYE el valor anterior del destino. Por eso en la prueba hay que recargar AL con otro «mov al,[si]» después.', 'Tabla: 0 AND x = 0 · 1 AND x = x.'],
      ex: [{ code: 'mov al, 53\nand al, 1\njmp $', note: '53 = 00110101b → AND 00000001b = 1 (impar). AL queda en 1.' }], exam: 'A 2023: and al,1 + jz @f.'
    },
    {
      g: 'Lógicas', n: 'test', syn: 'test destino, origen', what: 'Igual que AND pero NO guarda el resultado: solo actualiza las banderas. El destino queda intacto.', flags: 'ZF=1 si (destino AND origen) = 0.',
      rules: ['«test al,1» + jz → salta si el número es PAR. + jnz → salta si es IMPAR.', 'Ventaja sobre and: no hace falta recargar AL.'],
      ex: [{ code: 'mov al, 53\ntest al, 1\njmp $', note: 'AL sigue siendo 53; ZF=0 porque es impar.' }], exam: 'A y B 2024-2025: test al,1.'
    },
    {
      g: 'Lógicas', n: 'or / xor / not', syn: 'or d, o     xor d, o     not d', what: 'OR bit a bit (1 si alguno es 1), XOR (1 si son distintos) y NOT (invierte todos los bits).', flags: 'or/xor: ZF según resultado, CF=0. not no cambia banderas.',
      rules: ['xor al,al pone AL a 0 (truco clásico).', 'or al,20h convierte una mayúscula en minúscula (activa el bit 5).'],
      ex: [{ code: 'mov al, \'A\'\nor al, 20h\njmp $', note: "'A' (41h) OR 20h = 61h = 'a'." }], exam: 'No ha caído aún, pero es la base de los programas de letras.'
    },
    {
      g: 'Comparación', n: 'cmp', syn: 'cmp destino, origen', what: 'Compara restando destino − origen SIN guardar el resultado. Solo actualiza banderas; los registros no cambian. Después se usa un salto condicional.', flags: 'ZF=1 si son iguales. CF=1 si destino < origen (sin signo). SF/OF para comparaciones con signo.',
      rules: ['El orden importa: «cmp al,15» compara AL contra 15, y «ja» significa AL > 15.', 'Sin signo (valores 0–255): ja, jae, jb, jbe. Con signo: jg, jge, jl, jle.'],
      ex: [{ code: 'mov al, 20\ncmp al, 15\njmp $', note: 'ZF=0, CF=0 ⇒ 20 > 15.' }], exam: 'cmp al,15 · cmp al,9 · cmp al,\'A\' · cmp al,\'Z\' · cmp al,\'a\'.'
    },
    {
      g: 'Saltos', n: 'jmp', syn: 'jmp etiqueta', what: 'Salto incondicional: siempre va a la etiqueta.', flags: 'No modifica banderas.',
      rules: ['«jmp $» salta a sí misma = bucle infinito = «detener el programa».', 'Se usa para saltar el bloque «else» (jmp sgte).'],
      ex: [{ code: 'mov al, 1\njmp fin\nmov al, 2\nfin:\njmp $', note: 'AL queda en 1: «mov al,2» nunca se ejecuta.' }], exam: 'jmp $ al final de TODAS las pruebas; jmp sgte en las de dos arreglos.'
    },
    {
      g: 'Saltos', n: 'jz / jnz', syn: 'jz etiqueta     jnz etiqueta', what: 'jz (= je): salta si ZF=1 (resultado cero / iguales). jnz (= jne): salta si ZF=0.', flags: 'Solo lee ZF.',
      rules: ['Tras «and/test al,1»: jz ⇒ PAR; jnz ⇒ IMPAR.', 'Tras «cmp»: jz ⇒ iguales; jnz ⇒ distintos.'],
      ex: [{ code: 'mov al, 8\ntest al, 1\njz par\nmov bl, 1\njmp $\npar:\nmov bl, 2\njmp $', note: '8 es par ⇒ salta a par ⇒ BL = 2.' }], exam: 'La variante d) de A23, A25 y B25: cambiar jz por jnz.'
    },
    {
      g: 'Saltos', n: 'ja / jae / jb / jbe', syn: 'ja  jae  jb  jbe  etiqueta', what: 'Saltos tras CMP para números SIN SIGNO: ja (mayor), jae (mayor o igual), jb (menor), jbe (menor o igual).', flags: 'Leen CF y ZF.',
      rules: ['Sinónimos: jae = jnb = jnc · jb = jnae = jc · ja = jnbe · jbe = jna.', 'Los contrarios: ja ↔ jbe, jae ↔ jb. (Invertir la condición = pasar al contrario.)', 'Truco mental: lee «cmp A, B» y «jX» como «A  X  B».'],
      ex: [{ code: 'mov al, 3\ncmp al, 9\njb menor\nmov bl, 1\njmp $\nmenor:\nmov bl, 2\njmp $', note: '3 < 9 ⇒ salta ⇒ BL = 2.' }], exam: 'jae / jb / ja en A24, B23, B24, B25.'
    },
    {
      g: 'Saltos', n: 'loop', syn: 'loop etiqueta', what: 'CX ← CX − 1; si CX ≠ 0 salta a la etiqueta. Es el «for» del ensamblador: repite el cuerpo CX veces.', flags: 'No modifica banderas.',
      rules: ['Hay que cargar CX antes de entrar al ciclo (mov cx, N).', 'Si CX=0 al entrar, hace 65 536 vueltas (CX pasa de 0 a FFFFh).', 'Al terminar, CX = 0.'],
      ex: [{ code: 'mov cx, 4\nmov bl, 0\nciclo:\ninc bl\nloop ciclo\njmp $', note: 'BL = 4 y CX = 0.' }], exam: 'En todas las pruebas: mov cx, N … loop ciclo.'
    }
  ];

  const DIRECTIVES = [
    ['format binary as \'img\'', 'Genera un binario plano (imagen de disco) sin cabeceras.'],
    ['org 7C00h', 'Dirección de carga: el BIOS carga el sector en 0000:7C00h. No genera bytes; solo calcula direcciones.'],
    ['etiqueta:', 'Un nombre para una dirección (ciclo:, sgte:). No ocupa bytes.'],
    ['@@:  @f  @b', 'Etiqueta anónima. «@f» = el próximo @@ hacia adelante (forward); «@b» = el @@ anterior (backward).'],
    ['nombre db 1, 2, 3', 'Define bytes en memoria (DB). «nombre» es la dirección del primero.'],
    ['nombre db \'texto\'', 'Define una cadena: un byte por carácter (códigos ASCII).'],
    ['nombre db N dup (v)', 'Reserva N bytes, todos con el valor v (DUP = duplicar). num2 db 10 dup (3) = 3,3,3,3,3,3,3,3,3,3.'],
    ['dw valor', 'Define una palabra (2 bytes) en formato little-endian (el byte bajo primero): dw 0AA55h guarda 55h, AAh.'],
    ['$   y   $$', '«$» = dirección actual; «$$» = dirección de inicio del programa. «$-$$» = bytes usados hasta aquí.'],
    ['times N db 0', 'Repite N veces la definición. times 510-($-$$) db 0 rellena con ceros hasta llegar a 510 bytes.'],
    ['jmp $', 'Salta a sí misma: bucle infinito que «detiene» el programa.']
  ];

  /* ---------- annotated anatomy (A24 program) ---------- */
  const ANATOMY = [
    { lines: ["format binary as 'img'", 'org 7C00h'], step: '0', title: 'Cabecera: cómo se ensambla y dónde se carga',
      what: 'format binary as \'img\' → archivo binario plano. org 7C00h → el programa vivirá en la dirección 7C00h de memoria.',
      why: 'Al encender el PC, el BIOS lee los primeros 512 bytes del disco (el SECTOR DE ARRANQUE), los copia a 0000:7C00h y salta allí. Por eso todas las direcciones se calculan desde 7C00h.',
      exam: 'Pregunta a): «¿Para qué se utiliza org 7C00h?»  (A 2024, A 2024-25)' },
    { lines: ['mov ax, cs', 'mov ds, ax'], step: '1', title: 'Preparar el segmento de datos',
      what: 'DS ← CS (pasando por AX).',
      why: 'Cuando se usa [si] o [di], el procesador calcula DS:SI. Si DS no apunta al segmento donde están los datos, leería basura. Los datos están en el mismo sector que el código, así que DS debe valer lo mismo que CS.',
      exam: 'Casi nunca lo preguntan, pero siempre está: son las dos primeras instrucciones.' },
    { lines: ['mov si, num1', 'mov di, num2+9', 'mov cx, 10'], step: '2', title: 'Inicializar punteros y contador',
      what: 'SI ← dirección de num1 (origen). DI ← dirección de num2+9 (el último byte de num2). CX ← 10 (diez vueltas).',
      why: 'SI y DI son «flechas» que señalan posiciones del arreglo. CX es el contador que usa LOOP. num2+9 = «nueve bytes después del comienzo de num2» = el décimo elemento.',
      exam: 'Pregunta b): suelen subrayar mov si,num1+8 / mov di,cadena2+11 / mov cx,10 y piden explicar qué carga cada una y por qué.' },
    { lines: ['ciclo:'], step: '3', title: 'Comienzo del ciclo',
      what: 'Etiqueta. No es una instrucción.',
      why: 'Marca adónde debe volver LOOP en cada repetición.',
      exam: 'Pregunta b): «ciclo:» ha estado subrayada en 2023 y 2024.' },
    { lines: ['mov al, [si]', 'cmp al, 15', 'jae @f'], step: '4', title: 'Leer y decidir (el «if»)',
      what: 'Lee el elemento actual en AL, lo compara con 15 y, si es mayor o igual, salta a @@ (se salta el guardado).',
      why: 'Los programas de la prueba son siempre un FILTRO: recorren un arreglo y solo copian al destino los elementos que cumplen una condición. La condición se arma con cmp/test + salto condicional.',
      exam: 'Pregunta d): «¿Qué se almacenaría si en lugar de jae @f fuera jbe @f?» ⇒ se invierte el criterio de filtrado.' },
    { lines: ['mov al, [si]', 'mov [di], al', 'sub di, 2'], step: '5', title: 'Guardar y avanzar el destino',
      what: 'Escribe AL en la posición que señala DI y mueve DI 2 posiciones hacia atrás.',
      why: 'Solo se ejecuta con los elementos que NO saltaron. Que DI avance de 2 en 2 (y hacia atrás) deja huecos con el valor inicial del arreglo destino.',
      exam: 'Pregunta c): «¿Qué se almacena en num2?» ⇒ hay que fijarse en los huecos y en la posición inicial de DI.' },
    { lines: ['@@:', 'inc si', 'loop ciclo'], step: '6', title: 'Avanzar el origen y repetir',
      what: '@@ es el destino del salto (los que no se guardan caen aquí). inc si pasa al siguiente elemento. loop resta 1 a CX y repite si CX ≠ 0.',
      why: 'SI avanza SIEMPRE (haya o no guardado); DI solo avanza cuando se guarda. Esa diferencia es la clave del traceo.',
      exam: 'Pregunta b): inc si · loop ciclo · sub si,3 (subrayadas varias veces).' },
    { lines: ['jmp $'], step: '7', title: 'Fin del programa',
      what: 'Bucle infinito que se salta a sí mismo.',
      why: 'Un sector de arranque no tiene SO al que volver. Si no se detiene, la CPU seguiría ejecutando los datos (num1, num2…) como si fueran instrucciones.',
      exam: 'Pregunta b): jmp $ subrayada en 2023 y 2024.' },
    { lines: ['num1 db 1, 15, 8, 20, 6, 34, 3, 7, 22, 55', 'num2 db 10 dup (0)'], step: '8', title: 'Datos',
      what: 'num1: 10 bytes de entrada. num2: 10 bytes reservados, todos en 0.',
      why: 'Están DESPUÉS del código y del jmp $, pero dentro del mismo sector. Los valores iniciales del destino importan: los huecos conservan ese valor.',
      exam: 'Pregunta b): «num2 db 10 dup (0)» subrayada. Respuesta: reserva 10 bytes inicializados a 0 para el resultado.' },
    { lines: ['times 510-($-$$) db 0', 'dw 0AA55h'], step: '9', title: 'Relleno y firma de arranque',
      what: 'Rellena con ceros hasta 510 bytes y cierra con 55h AAh.',
      why: 'El sector mide 512 bytes. El BIOS solo arranca el sector si los 2 últimos bytes son 55h, AAh.',
      exam: 'Pregunta a): SIEMPRE preguntan una de estas tres: org 7C00h · times 510-($-$$) db 0 · dw 0AA55h.' }
  ];

  /* ---------- concept questions (multiple choice) ---------- */
  const MCQ = [
    { tag: 'a', q: '¿Para qué se utiliza la instrucción «org 7C00h»?', o: ['Para indicar la dirección de memoria donde el BIOS carga el sector de arranque, y así calcular las direcciones de las etiquetas.', 'Para reservar 7C00h bytes de memoria para el programa.', 'Para saltar a la dirección 7C00h al terminar el programa.', 'Para fijar el valor del registro CX en 7C00h.'], a: 0, w: 'ORG no genera código ni reserva memoria: solo informa al ensamblador de la dirección de origen. El BIOS carga el sector en 0000:7C00h.' },
    { tag: 'a', q: '¿Para qué sirve «times 510-($-$$) db 0»?', o: ['Para rellenar con ceros hasta completar 510 bytes y que la firma quede en los bytes 511–512 del sector.', 'Para repetir 510 veces el ciclo principal.', 'Para borrar la memoria que usa el programa.', 'Para reservar 510 bytes de datos inicializados con la firma.'], a: 0, w: '$ es la dirección actual y $$ la de inicio; $-$$ = bytes usados. 510 − usados = ceros necesarios para llegar justo antes de la firma.' },
    { tag: 'a', q: '¿Para qué se utiliza «dw 0AA55h» al final del programa?', o: ['Es la firma de arranque: el BIOS solo considera arrancable un sector que termine en 55h AAh.', 'Para almacenar el resultado final del programa.', 'Para detener el programa.', 'Para indicar el tamaño del programa en bytes.'], a: 0, w: 'En little-endian 0AA55h queda como 55h (byte 511) y AAh (byte 512). Sin la firma, el BIOS no ejecuta el sector.' },
    { tag: 'a', q: '¿Qué indica «format binary as \'img\'»?', o: ['Que se genere un archivo binario plano (imagen de disco) sin cabeceras de ejecutable.', 'Que el programa use números binarios en lugar de decimales.', 'Que se cargue una imagen gráfica al arrancar.', 'Que el programa se ejecute en modo protegido.'], a: 0, w: 'El BIOS necesita bytes crudos; un ejecutable con cabeceras (como un .exe) no sirve para el arranque.' },
    { tag: 'a', q: '¿Cuál es el valor de «$-$$» cuando el ensamblador está justo antes de la línea «times 510-($-$$) db 0»?', o: ['Los bytes que ocupan el código y los datos hasta ese punto.', 'Siempre 510.', 'La dirección 7C00h.', 'El valor de CX.'], a: 0, w: '$ = posición actual; $$ = posición de inicio del programa. Su diferencia es el tamaño acumulado.' },
    { tag: 'a', q: '¿Por qué los programas terminan con «jmp $»?', o: ['Porque «$» es la propia instrucción: es un bucle infinito que detiene el programa antes de que la CPU ejecute los datos.', 'Porque salta al inicio del programa para repetirlo.', 'Porque devuelve el control al sistema operativo.', 'Porque limpia las banderas.'], a: 0, w: 'No hay sistema operativo al que volver. Sin esa parada, la CPU seguiría ejecutando num1, num2… como si fueran instrucciones.' },
    { tag: 'b', q: '¿Qué hacen «mov ax, cs» y «mov ds, ax»?', o: ['Hacen que DS apunte al mismo segmento que el código, para acceder bien a los datos con [si], [di], [bx].', 'Copian el contenido de la memoria en AX.', 'Inicializan el contador del ciclo.', 'Guardan el resultado en el segmento CS.'], a: 0, w: 'No se puede hacer mov ds,cs directamente ni mov ds,número: hay que pasar por un registro general (AX).' },
    { tag: 'b', q: 'En FASM, «mov si, num1» carga en SI…', o: ['la DIRECCIÓN donde empieza num1.', 'el primer valor del arreglo num1.', 'la cantidad de elementos de num1.', 'la suma de los elementos de num1.'], a: 0, w: 'Para leer el contenido se usan corchetes: mov al, [si] (o mov al,[num1]).' },
    { tag: 'b', q: '«mov si, num1+8» deja a SI apuntando…', o: ['al noveno elemento de num1 (el de índice 8, contando desde 0).', 'al octavo elemento de num1.', 'a la dirección 8.', 'al elemento cuyo valor es 8.'], a: 0, w: 'num1+0 es el primero, num1+1 el segundo… num1+8 es el noveno. En un arreglo de 9 elementos es el último.' },
    { tag: 'b', q: '¿Qué función tiene «mov cx, 10» en estos programas?', o: ['Fija en 10 las vueltas que hará LOOP (CX es el contador del ciclo).', 'Guarda el número 10 en la memoria.', 'Compara AL con 10.', 'Suma 10 al puntero SI.'], a: 0, w: 'LOOP decrementa CX y salta mientras CX ≠ 0. Con CX=10 el cuerpo se ejecuta 10 veces.' },
    { tag: 'b', q: '¿Qué hace «mov al, [si]»?', o: ['Copia en AL el byte de memoria cuya dirección está en SI.', 'Copia SI en AL.', 'Copia AL en la memoria apuntada por SI.', 'Suma SI y AL.'], a: 0, w: 'Los corchetes significan «contenido de la dirección». La dirección está en SI.' },
    { tag: 'b', q: '¿Qué hace «mov [di], al»?', o: ['Escribe AL en la posición de memoria a la que apunta DI.', 'Lee de la memoria y lo guarda en AL.', 'Copia DI en AL.', 'Incrementa DI.'], a: 0, w: 'Es la escritura del resultado. Solo se ejecuta para los elementos que pasan el filtro.' },
    { tag: 'b', q: 'Después de «and al, 1» se vuelve a escribir «mov al, [si]». ¿Por qué?', o: ['Porque AND modifica AL (lo deja en 0 ó 1) y hay que recuperar el número original para guardarlo.', 'Porque mov al,[si] es obligatorio antes de cualquier salto.', 'Porque AND borra el valor de SI.', 'Es una instrucción redundante sin efecto.'], a: 0, w: 'AND guarda el resultado en el destino y destruye el original. TEST, en cambio, no modifica AL y no hace falta recargarlo.' },
    { tag: 'b', q: '¿Cuál es la diferencia entre «and al, 1» y «test al, 1»?', o: ['Las dos ponen las banderas igual, pero AND guarda el resultado en AL y TEST no.', 'TEST suma y AND resta.', 'AND compara y TEST copia.', 'No hay diferencia en nada.'], a: 0, w: 'TEST = AND «de solo lectura»: solo cambian las banderas.' },
    { tag: 'b', q: 'Tras «and al,1» (o «test al,1»), ¿qué significa que se cumpla «jz»?', o: ['Que el número es PAR (su bit 0 es 0).', 'Que el número es IMPAR.', 'Que el número es cero.', 'Que el número es mayor que 1.'], a: 0, w: 'ZF=1 ⇒ el resultado del AND fue 0 ⇒ el bit 0 era 0 ⇒ par. (Un número es cero solo si TODOS sus bits son 0, no solo el bit 0.)' },
    { tag: 'b', q: '¿Qué hace «cmp al, 15»?', o: ['Calcula AL − 15 sin guardar el resultado y actualiza las banderas (ZF, CF…).', 'Guarda 15 en AL.', 'Resta 15 a AL.', 'Salta si AL vale 15.'], a: 0, w: 'CMP nunca modifica sus operandos. El salto condicional siguiente decide con las banderas.' },
    { tag: 'b', q: 'Después de «cmp al, 15», ¿cuándo salta «jae @f»?', o: ['Cuando AL ≥ 15 (sin signo).', 'Cuando AL < 15.', 'Cuando AL = 15 exactamente.', 'Siempre.'], a: 0, w: 'jae = salta si mayor o igual (CF=0). Su contrario es jb (menor).' },
    { tag: 'b', q: 'El contrario de «ja» es…', o: ['jbe (menor o igual).', 'jb (menor).', 'jae (mayor o igual).', 'jz (igual a cero).'], a: 0, w: 'NO(a > b) = (a ≤ b). Por eso, invertir ja da jbe; invertir jae da jb; invertir jz da jnz.' },
    { tag: 'b', q: 'En «cmp al, \'A\'  /  jb @f  /  cmp al, \'Z\'  /  ja @f  /  mov [di], al», ¿qué caracteres se guardan?', o: ['Los que están entre \'A\' y \'Z\' (letras mayúsculas).', 'Solo la \'A\' y la \'Z\'.', 'Los menores que \'A\' o mayores que \'Z\'.', 'Todos los caracteres.'], a: 0, w: 'jb salta (descarta) lo menor que \'A\'; ja salta (descarta) lo mayor que \'Z\'. Lo que sobrevive está en el rango [\'A\'..\'Z\'].' },
    { tag: 'b', q: '¿Qué hace «@@:» y qué significa «jz @f»?', o: ['@@ es una etiqueta anónima y @f salta al siguiente @@ hacia adelante (forward).', '@@ define una variable y @f un número real.', '@f significa «falso» (el salto nunca se toma).', '@@ marca el fin del programa.'], a: 0, w: '@f = forward (adelante), @b = backward (atrás). Evitan inventar nombres de etiquetas.' },
    { tag: 'b', q: '¿Qué hace «inc si» dentro del ciclo?', o: ['Pasa al siguiente elemento del arreglo de origen (SI ← SI + 1).', 'Incrementa el contador CX.', 'Incrementa el valor del elemento actual.', 'Repite el ciclo.'], a: 0, w: 'inc si cambia la dirección a la que apunta SI, no el dato. El contador lo decrementa LOOP.' },
    { tag: 'b', q: '¿Qué hace «sub si, 3» en el ciclo de la prueba de 2023?', o: ['Mueve SI tres posiciones hacia atrás: se procesan los elementos de 3 en 3, desde el final.', 'Resta 3 al valor del elemento.', 'Resta 3 a CX.', 'Termina el ciclo cuando SI llega a 3.'], a: 0, w: 'Como cada elemento ocupa 1 byte, SI−3 retrocede 3 elementos.' },
    { tag: 'b', q: '¿Qué efecto tiene «add bx, 2» tras «mov [bx], al»?', o: ['BX pasa a apuntar 2 posiciones más adelante: el siguiente valor se guarda dejando un hueco.', 'Suma 2 al valor guardado.', 'Suma 2 a AL.', 'Duplica el arreglo.'], a: 0, w: 'Por eso los arreglos destino de A25/B25 quedan con valores intercalados con su valor inicial.' },
    { tag: 'b', q: '¿Cuál de estas es la diferencia entre «jmp sgte» y «loop ciclo»?', o: ['jmp salta siempre; loop decrementa CX y salta solo si CX ≠ 0.', 'Son idénticas.', 'loop salta siempre; jmp solo si CX ≠ 0.', 'jmp modifica las banderas y loop no.'], a: 0, w: 'jmp es incondicional. loop es el «for»: resta 1 a CX y repite mientras queden vueltas.' },
    { tag: 'b', q: '¿Qué se reserva con «num2 db 10 dup (3)»?', o: ['10 bytes, todos con el valor inicial 3.', 'Un solo byte con el valor 10.', '3 bytes con el valor 10.', '13 bytes con valor 0.'], a: 0, w: 'Formato: nombre db N dup (valor). Los huecos que el programa no sobrescriba mantienen ese 3.' },
    { tag: 'b', q: '¿Qué almacena «cadena db \'ExAmEn\'»?', o: ['6 bytes con los códigos ASCII de E, x, A, m, E, n.', 'Una dirección de memoria.', 'El número 6.', 'Solo la letra E.'], a: 0, w: 'Cada carácter ocupa 1 byte. Los códigos: E=45h, x=78h, A=41h, m=6Dh, E=45h, n=6Eh.' },
    { tag: 'c', q: 'Un programa filtra con «cmp al,9 / ja @f / mov [di],al». ¿Qué elementos copia?', o: ['Los que son menores o iguales a 9.', 'Los que son mayores que 9.', 'Solo los iguales a 9.', 'Ninguno.', ], a: 0, w: 'ja salta (descarta) cuando AL > 9. Se copian los que NO saltan: AL ≤ 9.' },
    { tag: 'c', q: 'En el programa de «cadena → cadena2» con «inc di», ¿qué pasa con las posiciones de cadena2 cuyos caracteres NO se copiaron?', o: ['Conservan su valor inicial.', 'Quedan en 0.', 'Se llenan con espacios.', 'Se borran.'], a: 0, w: 'El programa solo escribe cuando el carácter pasa el filtro. La memoria no se limpia sola.' },
    { tag: 'c', q: 'En un programa donde DI solo avanza al guardar, pero SI siempre avanza, ¿cómo quedan los elementos guardados?', o: ['Consecutivos en el destino (sin huecos).', 'En las mismas posiciones que en el origen.', 'En orden inverso.', 'Duplicados.'], a: 0, w: 'Si en cambio DI avanza siempre (como inc di en B 2023), cada elemento conserva su POSICIÓN y quedan huecos.' },
    { tag: 'c', q: '¿Cuántas veces se ejecuta el cuerpo de un ciclo con «mov cx, 6 … loop ciclo»?', o: ['6 veces.', '5 veces.', '7 veces.', 'Infinitas.'], a: 0, w: 'CX se decrementa al final de cada vuelta: 6→5→…→0. Salta mientras CX≠0, así que da 6 vueltas completas.' },
    { tag: 'c', q: '¿Cuánto vale CX al terminar un LOOP?', o: ['0', '1', 'El valor con el que empezó.', 'FFFFh'], a: 0, w: 'LOOP sale del ciclo justamente cuando CX llega a 0.' },
    { tag: 'd', q: 'Si en lugar de «jz @f» se escribe «jnz @f» tras un «test al,1», el programa guardaría…', o: ['los números PARES en lugar de los impares (se invierte el filtro).', 'los mismos números.', 'todos los números.', 'ninguno.'], a: 0, w: 'Invertir el salto invierte el criterio: lo que antes se descartaba ahora se guarda y viceversa.' },
    { tag: 'd', q: 'Si en el filtro de letras se cambia \'A\'/\'Z\' por \'a\'/\'z\', se copian…', o: ['las letras minúsculas.', 'las letras mayúsculas.', 'los dígitos.', 'todas las letras.'], a: 0, w: 'Rango [\'a\'..\'z\'] = 61h..7Ah. Los códigos de mayúsculas (41h..5Ah) quedan fuera.' },
    { tag: 'c', q: 'Códigos ASCII que conviene saber: ¿cuál es correcto?', o: ["'0'=30h  'A'=41h  'a'=61h", "'0'=00h  'A'=0Ah  'a'=1Ah", "'0'=39h  'A'=5Ah  'a'=7Ah", "'0'=41h  'A'=61h  'a'=30h"], a: 0, w: "Dígitos 30h–39h, mayúsculas 41h–5Ah, minúsculas 61h–7Ah. Una minúscula es la mayúscula + 20h." }
  ];


  /* ---------- more concept questions ---------- */
  MCQ.push(
    { tag: 'a', q: 'Si el programa usa «org 7C00h» y el sector mide 512 bytes, ¿en qué direcciones quedan los bytes de la firma 55h y AAh?', o: ['7DFEh y 7DFFh.', '7C00h y 7C01h.', '7DFFh y 7E00h.', '7E00h y 7E01h.'], a: 0, w: '7C00h + 510 (1FEh) = 7DFEh para el byte 55h, y 7DFFh para AAh (últimos 2 bytes del sector).' },
    { tag: 'a', q: '¿Cuántos bytes mide el sector de arranque que lee el BIOS?', o: ['512 bytes.', '510 bytes.', '1024 bytes.', '256 bytes.'], a: 0, w: '510 bytes de código/datos/relleno + 2 bytes de firma = 512.' },
    { tag: 'a', q: '¿Qué guarda en memoria «dw 1234h» (en este orden de bytes)?', o: ['34h y después 12h (little-endian).', '12h y después 34h.', 'Solo 12h.', 'Solo 34h.'], a: 0, w: 'El 8086 guarda primero el byte bajo. Por eso dw 0AA55h deja 55h, AAh.' },
    { tag: 'a', q: '¿Qué pasaría si se olvida el «jmp $» al final del código?', o: ['La CPU seguiría ejecutando los datos y el relleno como si fueran instrucciones.', 'Nada: el programa termina solo.', 'El BIOS vuelve a cargar el sector.', 'El ensamblador da un error.'], a: 0, w: 'No hay sistema operativo que recupere el control: la CPU avanza por la memoria ejecutando bytes sin sentido.' },
    { tag: 'a', q: 'En «times 510-($-$$) db 0», si el código y los datos ocupan 87 bytes, ¿cuántos ceros se escriben?', o: ['423.', '510.', '87.', '425.'], a: 0, w: '510 − 87 = 423. La firma de 2 bytes va después y completa los 512.' },
    { tag: 'b', q: '¿Qué hace «mov di, num2+9»?', o: ['Apunta DI al décimo byte de num2 (su último elemento si tiene 10).', 'Suma 9 al contenido de num2.', 'Copia 9 en DI.', 'Apunta DI al noveno byte de num2.'], a: 0, w: 'num2+0 es el primero; num2+9 es el décimo.' },
    { tag: 'b', q: 'Tras «test al, 1», ¿qué salto se toma con los números IMPARES?', o: ['jnz.', 'jz.', 'ja.', 'jb.'], a: 0, w: 'Impar ⇒ bit 0 = 1 ⇒ AND = 1 ⇒ ZF=0 ⇒ jnz salta.' },
    { tag: 'b', q: '¿Qué instrucción convierte la minúscula \'a\' (61h) en la mayúscula \'A\' (41h)?', o: ['sub al, 20h', 'add al, 20h', 'and al, 1', 'inc al'], a: 0, w: 'Las minúsculas están 20h por encima de las mayúsculas, así que se resta 20h.' },
    { tag: 'b', q: 'AL contiene el carácter \'7\' (37h). ¿Qué deja «and al, 0Fh»?', o: ['7 (el valor numérico del dígito).', '37h.', '0Fh.', '0.'], a: 0, w: '37h AND 0Fh = 07h: se quedan los 4 bits bajos. Truco para pasar de dígito ASCII a número.' },
    { tag: 'b', q: '¿Para qué sirve la etiqueta anónima «@@:»?', o: ['Para tener un destino de salto sin inventar un nombre (se usa con @f y @b).', 'Para reservar memoria.', 'Para terminar el programa.', 'Para llamar a una función.'], a: 0, w: '@f salta al próximo @@ y @b al anterior.' },
    { tag: 'b', q: 'Si CX vale 0 al llegar por primera vez a «loop ciclo», ¿cuántas veces se repite el ciclo?', o: ['65 536 veces (CX pasa de 0 a FFFFh).', 'Ninguna.', 'Una vez.', 'Infinitas.'], a: 0, w: 'LOOP decrementa primero: 0 − 1 = FFFFh ≠ 0 ⇒ salta. Hay que cargar CX antes de entrar al ciclo.' },
    { tag: 'b', q: 'AL = 200 y se ejecuta «add al, 100». ¿Qué queda en AL y en CF?', o: ['AL = 44 y CF = 1.', 'AL = 300 y CF = 0.', 'AL = 44 y CF = 0.', 'AL = 255 y CF = 1.'], a: 0, w: '300 no cabe en 8 bits: 300 − 256 = 44 y se activa el acarreo (CF=1).' },
    { tag: 'b', q: 'AL = 5 y se ejecuta «cmp al, 5». ¿Qué banderas quedan?', o: ['ZF=1 y CF=0.', 'ZF=0 y CF=1.', 'ZF=0 y CF=0.', 'ZF=1 y CF=1.'], a: 0, w: '5 − 5 = 0 ⇒ ZF=1; no hay préstamo ⇒ CF=0.' },
    { tag: 'b', q: 'AL = 3 y se ejecuta «cmp al, 9». ¿Qué banderas quedan?', o: ['ZF=0 y CF=1.', 'ZF=1 y CF=0.', 'ZF=0 y CF=0.', 'ZF=1 y CF=1.'], a: 0, w: '3 − 9 necesita un préstamo ⇒ CF=1 (3 < 9 sin signo); no es cero ⇒ ZF=0. Por eso «jb» salta.' },
    { tag: 'b', q: '¿Cuál es el contrario de «jbe»?', o: ['ja', 'jb', 'jae', 'jnz'], a: 0, w: 'NO(≤) = (>). Contrarios: ja↔jbe, jae↔jb, jz↔jnz.' },
    { tag: 'c', q: 'Un ciclo tiene «mov cx, 10» y el arreglo de entrada tiene 10 elementos. ¿Qué pasa si se cambia a «mov cx, 8»?', o: ['Solo se procesan los 8 primeros elementos.', 'Se procesan los 8 últimos.', 'Se procesan los 10 igual.', 'El programa no termina.'], a: 0, w: 'CX controla las vueltas; SI avanza desde el principio, así que quedan sin leer los últimos.' },
    { tag: 'c', q: 'En un programa con «add di, 2» tras cada «mov [di], al», ¿qué hay entre dos elementos guardados?', o: ['El valor inicial del arreglo destino (hueco).', 'Ceros siempre.', 'El elemento anterior repetido.', 'Basura aleatoria.'], a: 0, w: 'Los bytes que no se escriben conservan lo que se declaró con db/dup.' },
    { tag: 'c', q: '¿Cuántos elementos se guardan como máximo en un arreglo de 10 bytes si DI avanza de 2 en 2?', o: ['5.', '10.', '2.', '20.'], a: 0, w: 'Posiciones 0, 2, 4, 6, 8: cinco. Más allá se escribiría fuera del arreglo.' },
    { tag: 'c', q: 'En «cadena db \'ExAmEn\'» con el filtro \'A\'..\'Z\', ¿cuántos caracteres pasan?', o: ['3 (E, A, E).', '6.', '2.', '4.'], a: 0, w: 'Las mayúsculas son E, A y E; x, m, n son minúsculas.' },
    { tag: 'd', q: 'En un filtro con «cmp al, 15 / jae @f», si se cambia por «jb @f», los elementos que se guardan pasan a ser…', o: ['los mayores o iguales que 15.', 'los menores que 15.', 'solo los iguales a 15.', 'ninguno.'], a: 0, w: 'jae descartaba ≥ 15 (guardaba < 15). jb descarta < 15 y guarda ≥ 15.' },
    { tag: 'd', q: 'Si en un programa de dos arreglos se invierte el salto condicional, ¿qué ocurre?', o: ['Los destinos se intercambian: lo que iba a num2 va a num3 y viceversa.', 'Todo va a num2.', 'No cambia nada.', 'El programa no termina.'], a: 0, w: 'Ambas ramas existen; al invertir la condición cada elemento toma la rama contraria.' }
  );

  /* ---------- true / false statements ---------- */
  const VF = [
    ['«org 7C00h» genera 7C00h bytes de código en el programa.', false, 'ORG no genera bytes: solo informa al ensamblador de la dirección de carga.'],
    ['«dw 0AA55h» deja en memoria primero el byte 55h y luego AAh.', true, 'Little-endian: el byte bajo va primero.'],
    ['«test al, 1» modifica el valor de AL.', false, 'TEST solo actualiza banderas; AL no cambia.'],
    ['«and al, 1» modifica el valor de AL.', true, 'AND guarda el resultado en el destino: AL queda en 0 ó 1.'],
    ['«cmp al, 9» guarda el resultado de la resta en AL.', false, 'CMP resta pero descarta el resultado; solo deja banderas.'],
    ['«loop ciclo» decrementa CX y salta si CX ≠ 0.', true, 'Es el «for» del ensamblador.'],
    ['«jz» salta cuando ZF = 1.', true, 'jz = je: salta si el resultado fue cero / iguales.'],
    ['«ja» salta cuando el primer valor es mayor que el segundo (sin signo).', true, 'ja: CF=0 y ZF=0.'],
    ['«jae» y «jnb» son la misma instrucción.', true, 'Son sinónimos: salta si CF=0.'],
    ['El contrario de «jb» es «jbe».', false, 'El contrario de jb (<) es jae (≥). El de jbe (≤) es ja (>).'],
    ['«mov si, num1» copia en SI el primer valor del arreglo num1.', false, 'En FASM carga la DIRECCIÓN de num1; para el contenido se usa [si].'],
    ['«mov al, [si]» copia en AL el byte cuya dirección está en SI.', true, 'Los corchetes indican «contenido de esa dirección».'],
    ['«mov [di], [si]» es válida en el 8086.', false, 'No se puede de memoria a memoria; hay que pasar por un registro.'],
    ['«mov ds, cs» es una instrucción válida.', false, 'No existe mov entre registros de segmento: se usa mov ax, cs / mov ds, ax.'],
    ['«inc di» modifica la bandera CF.', false, 'INC y DEC no tocan CF.'],
    ['«add di, 2» avanza DI dos posiciones (dos bytes).', true, 'Cada elemento ocupa 1 byte, así que salta un elemento.'],
    ['«num2 db 10 dup (3)» reserva 10 bytes con el valor inicial 3.', true, 'DUP repite el valor entre paréntesis.'],
    ['«times 510-($-$$) db 0» escribe siempre exactamente 510 ceros.', false, 'Escribe 510 − (bytes usados) ceros, para llegar a 510 bytes.'],
    ['El BIOS carga el sector de arranque en la dirección 0000:7C00h.', true, 'Por eso se usa org 7C00h.'],
    ['Si los 2 últimos bytes del sector no son 55h AAh, el BIOS ejecuta el sector igualmente.', false, 'Sin la firma, el BIOS no considera el sector arrancable.'],
    ['«jmp $» salta a la primera instrucción del programa.', false, '«$» es la dirección de la propia instrucción: salta a sí misma.'],
    ['«jmp $» detiene el programa mediante un bucle infinito.', true, 'Es la parada típica de un sector de arranque.'],
    ['«@f» se refiere al próximo «@@:» hacia adelante.', true, 'f = forward (adelante).'],
    ['«@b» salta hacia adelante.', false, '@b = backward: al @@ anterior.'],
    ['Si AL = 15, después de «cmp al, 15» la bandera ZF vale 1.', true, '15 − 15 = 0 ⇒ ZF=1.'],
    ['Si AL = 15, después de «cmp al, 20» la bandera CF vale 1.', true, '15 < 20 ⇒ hay préstamo ⇒ CF=1.'],
    ['«xor al, al» deja AL en 0.', true, 'Un valor XOR sí mismo da 0.'],
    ['CX es el registro contador que utiliza LOOP.', true, 'LOOP trabaja con CX.'],
    ['AL es un registro de 16 bits.', false, 'AL es de 8 bits (la parte baja de AX, que es de 16).'],
    ['AX está formado por AH (alto) y AL (bajo).', true, '16 bits = 8 + 8.'],
    ['«sub si, 3» hace que SI apunte tres posiciones más adelante.', false, 'Resta: retrocede tres posiciones.'],
    ['«num1+8» es la dirección del noveno elemento de num1.', true, 'num1+0 es el primero.'],
    ['«and al, 1» da 1 cuando AL es par.', false, 'Da 1 cuando el bit 0 es 1, es decir, cuando es IMPAR.'],
    ['Después de «test al, 1», el salto «jz» se toma con los números pares.', true, 'Par ⇒ bit 0 = 0 ⇒ resultado 0 ⇒ ZF=1.'],
    ['El destino de un «mov» puede ser un número inmediato (por ejemplo, mov 5, al).', false, 'El destino debe ser un registro o una posición de memoria.'],
    ['El código ASCII de \'A\' es 41h y el de \'a\' es 61h.', true, 'Diferencia de 20h.'],
    ['Para convertir una mayúscula en minúscula se resta 20h.', false, 'Se SUMA 20h (o se activa el bit 5 con or al, 20h).'],
    ["«format binary as 'img'» genera un ejecutable .exe.", false, 'Genera un binario plano, sin cabeceras.'],
    ['En estas pruebas los datos (num1, num2…) se colocan después del «jmp $».', true, 'Así la CPU nunca los ejecuta.'],
    ['«cmp» modifica las banderas pero no modifica sus operandos.', true, 'Es una resta «de mentira».'],
    ['«ja» y «jg» son equivalentes para cualquier dato.', false, 'ja compara SIN signo; jg compara CON signo.'],
    ['«dec di» retrocede DI un byte.', true, 'DI ← DI − 1.'],
    ['Para que [si] acceda a los datos del sector, DS debe valer lo mismo que CS.', true, 'Datos y código comparten segmento.'],
    ['Un salto condicional (por ejemplo jz) modifica las banderas.', false, 'Los saltos solo LEEN las banderas.'],
    ["«mov al, 'A'» carga el valor 41h en AL.", true, "Un carácter entre comillas es su código ASCII."],
    ['«$$» es la dirección de inicio del programa y «$» la dirección actual.', true, '$-$$ = bytes ocupados hasta ese punto.'],
    ['Si CX = 5 al entrar a un ciclo con LOOP, el cuerpo se ejecuta 5 veces.', true, 'CX: 5→4→3→2→1→0.'],
    ['Al terminar un ciclo controlado por LOOP, CX vale 0.', true, 'LOOP sale cuando CX llega a 0.'],
    ['«mov cx, 10» después de «ciclo:» reinicia el contador en cada vuelta.', false, 'Estaría dentro del ciclo y nunca terminaría; el contador se carga ANTES de la etiqueta.'],
    ['«add al, 100» con AL = 200 deja AL = 44 y CF = 1.', true, '300 − 256 = 44 con acarreo.']
  ];

  const C = { explainLine, CARDS, DIRECTIVES, ANATOMY, MCQ, VF };
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.Content = C;
})(typeof window !== 'undefined' ? window : globalThis);
