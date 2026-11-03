/* Sections and navigation. */
(function () {
  'use strict';
  const { Emu, Programs, Content, Ex, UI } = window;
  const { h, Store, Stats, codeBlock, iterTable, sectorMap, renderExercise } = UI;
  const view = document.getElementById('view');
  const sim = UI.Sim();
  let pendingSim = null;

  const SECTIONS = [
    { id: 'map', icon: '🧭', title: 'La prueba', sub: 'Qué preguntan y cómo se responde', render: secMap },
    { id: 'ddr', icon: '💾', title: 'Pregunta 2: memoria', sub: 'Fórmulas, ns y transferencias', render: secDDR },
    { id: 'nums', icon: '🔢', title: 'Números y ASCII', sub: 'Base para poder trazar', render: secNums },
    { id: 'anat', icon: '🧱', title: 'Anatomía del programa', sub: 'Línea por línea', render: secAnat },
    { id: 'regs', icon: '🧠', title: 'Registros y banderas', sub: 'Punteros, memoria, ZF/CF', render: secRegs },
    { id: 'instr', icon: '📖', title: 'Instrucciones', sub: 'Qué hace cada una', render: secInstr },
    { id: 'sim', icon: '▶', title: 'Simulador', sub: 'Paso a paso', render: secSim },
    { id: 'solved', icon: '✅', title: 'Pruebas resueltas', sub: 'Las 6 baterías', render: secSolved },
    { id: 'practice', icon: '🏋', title: 'Ejercicios', sub: 'Infinitos, con corrección', render: secPractice },
    { id: 'mock', icon: '📝', title: 'Simulacro', sub: 'Pregunta 3 completa', render: secMock }
  ];

  /* ---------- shell ---------- */
  const nav = document.getElementById('nav');
  SECTIONS.forEach((s, i) => nav.append(h('button', { 'data-id': s.id, onclick: () => go(s.id) }, h('span', { class: 'n' }, i + 1), h('span', null, s.title, h('small', { class: 'muted', style: 'display:block;font-size:.76rem' }, s.sub)))));
  const side = document.getElementById('side');
  document.getElementById('menu').addEventListener('click', () => side.classList.toggle('open'));
  function go(id) {
    const s = SECTIONS.find(x => x.id === id) || SECTIONS[0];
    sim.stop();
    [...nav.children].forEach(b => b.setAttribute('aria-current', b.dataset.id === s.id ? 'page' : 'false'));
    view.innerHTML = '';
    view.append(h('div', { class: 'sec-head' }, h('h1', null, s.icon + ' ' + s.title)));
    s.render();
    side.classList.remove('open');
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + s.id); } catch (e) { /* file:// restrictions */ }
    Store.set('last', s.id);
  }
  function openSim(source, title) { pendingSim = { source, title }; go('sim'); }

  const prog = document.getElementById('progress');
  function refreshProgress() { const t = Stats.total(); prog.textContent = t.n ? t.ok + ' / ' + t.n + ' ejercicios bien' : 'Aún sin ejercicios'; }
  document.addEventListener('stats', refreshProgress);
  document.getElementById('reset').addEventListener('click', () => { if (confirm('¿Borrar tu progreso de ejercicios?')) Stats.reset(); });
  const themeBtn = document.getElementById('theme');
  function applyTheme(t) { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); themeBtn.textContent = { auto: '◐ Tema: auto', light: '☀ Tema: claro', dark: '☾ Tema: oscuro' }[t]; }
  let theme = Store.get('theme', 'auto'); applyTheme(theme);
  themeBtn.addEventListener('click', () => { theme = { auto: 'light', light: 'dark', dark: 'auto' }[theme]; Store.set('theme', theme); applyTheme(theme); });

  /* ---------- small builders ---------- */
  const fmt = (x, d) => window.DDR.fmt(x, d);
  const P = (...c) => h('p', null, ...c);
  const C = t => h('code', null, t);
  const callout = (cls, ...c) => h('div', { class: 'callout ' + cls }, ...c);
  const card = (...c) => h('div', { class: 'card' }, ...c);
  const arrTxt = (v, text) => text ? "'" + v + "'" : '[' + v.join(', ') + ']';
  function exResult(e, source) {
    const r = Emu.runSource(source || e.source); const out = {};
    for (const l of e.ask) { const v = Emu.readLabel(r.prog, r.trace.final.mem, l).values; out[l] = (e.id === 'B23' || e.id === 'B24') ? String.fromCharCode(...v) : v; }
    return { r, out };
  }
  function ulSet(e) {
    const lines = e.source.split('\n'); const set = new Set(); let from = 0;
    for (const u of e.underlined) { const i = lines.findIndex((l, ix) => ix >= 0 && !set.has(ix) && l.trim().toLowerCase().replace(/\s+/g, ' ') === u.toLowerCase().replace(/\s+/g, ' ')); if (i >= 0) set.add(i); from = i; }
    return set;
  }

  /* =====================================================================
     1. LA PRUEBA
     ===================================================================== */
  function secMap() {
    view.append(
      callout('', h('b', null, 'Foco: la pregunta 3 (ensamblador). '), 'Revisé las 6 baterías (2023, 2024 y 2024-25, A y B). Las 6 repiten EXACTAMENTE el mismo molde: un «sector de arranque» en FASM que recorre un arreglo, filtra elementos con una comparación y guarda el resultado en otro arreglo. Cambian los datos y el criterio del filtro. Si dominas ese molde, dominas la pregunta.'),
      callout('good', h('b', null, 'La pregunta 2 (memoria y tiempos) también está: '), 'fórmulas, qué es cada dato, calculadora y ejercicios en la sección «Pregunta 2: memoria». ', h('button', { class: 'btn sm', onclick: () => go('ddr') }, 'Ir a la pregunta 2 →')),
      h('div', { class: 'card' }, h('h3', null, 'Las 6 pruebas de un vistazo'), h('div', { class: 'tscroll' }, h('table', null,
        h('thead', null, h('tr', null, ...['Batería', 'Qué hace el programa', 'a) preguntan', 'c) resultado', 'd) variación'].map(t => h('th', null, t)))),
        h('tbody', null, Programs.EXAMS.map(e => { const { out } = exResult(e); return h('tr', null, h('td', null, e.bat + ' ' + e.year), h('td', null, e.family), h('td', null, C(e.asked.a)), h('td', null, ...Object.entries(out).map(([k, v]) => h('div', null, C(k + ' = ' + arrTxt(v, typeof v === 'string'))))), h('td', null, C(e.asked.d))); })))),
        h('p', { class: 'small muted' }, 'Los resultados de la columna c) los calcula el emulador de esta página ejecutando el programa real (no están escritos a mano).')),
      h('h2', null, 'Los 4 apartados: qué piden y cómo se responde'),
      h('div', { class: 'grid2' },
        card(h('span', { class: 'tag' }, 'a)'), h('h3', null, 'Una directiva'), P('Siempre es UNA de estas tres (rotan):'), h('ul', null, h('li', null, C('org 7C00h')), h('li', null, C('times 510-($-$$) db 0')), h('li', null, C('dw 0AA55h'))), P('Respuesta modelo: qué hace + para qué sirve para el BIOS. Las tres están explicadas en «Anatomía del programa».')),
        card(h('span', { class: 'tag' }, 'b)'), h('h3', null, 'Explicar las instrucciones subrayadas'), P('Suelen subrayar 5–7 líneas del programa: inicializaciones (', C('mov si, num1'), ', ', C('mov cx, 10'), '), el ', C('cmp'), '/', C('test'), ', un salto, ', C('inc si'), ', ', C('loop ciclo'), ', ', C('jmp $'), ' y alguna definición de datos.'), P(h('b', null, 'Fórmula: '), 'QUÉ hace (con valores) + PARA QUÉ sirve en el programa. «mov cx,10: carga 10 en CX, el contador de LOOP; el ciclo da 10 vueltas, una por elemento de num1».')),
        card(h('span', { class: 'tag' }, 'c)'), h('h3', null, 'Qué queda almacenado'), P('Escribe el arreglo COMPLETO (todos sus elementos, incluidos los que el programa no tocó: conservan su valor inicial). Por eso hay que mirar con qué valores se declaró con ', C('dup'), '.'), P('Se hace trazando el ciclo vuelta a vuelta.')),
        card(h('span', { class: 'tag' }, 'd)'), h('h3', null, 'Qué pasa si cambio…'), P('Siempre es UNA modificación pequeña: invertir un salto (', C('jz→jnz'), ', ', C('jae→jbe'), ') o cambiar el rango (', C("'A','Z'→'a','z'"), '). Se resuelve razonando qué elementos pasan ahora al filtro y retrazando.'), P('Contrarios: ', C('jz↔jnz'), ' · ', C('ja↔jbe'), ' · ', C('jae↔jb'), '.'))),
      h('h2', null, 'Método de traceo en 5 pasos'),
      h('div', { class: 'stepflow' }, ...[['1 · Punteros', 'Anota SI, DI, BX iniciales (con su desplazamiento: num1+8) y CX.'], ['2 · Lee', 'AL ← [SI]: ¿qué valor toca esta vuelta?'], ['3 · Decide', 'Aplica cmp/test + salto: ¿salta o no? (el salto descarta el elemento)'], ['4 · Escribe', 'Si no saltó: [DI] ← AL y mueve DI (según el programa).'], ['5 · Avanza', 'SI se mueve, CX − 1. Si CX ≠ 0, vuelve al paso 2.']].map(([t, d]) => h('div', null, h('b', null, t), d))),
      callout('warn', h('b', null, 'Errores típicos que cuestan puntos: '), h('ul', null,
        h('li', null, 'Confundir ', C('ja'), ' (>) con ', C('jae'), ' (≥) justo en el valor límite (el que compara con K).'),
        h('li', null, 'Olvidar si DI avanza SIEMPRE (', C('inc di'), ' fuera del bloque, como en B 2023) o SOLO al guardar.'),
        h('li', null, C('num1+8'), ' no es el elemento 8: es el NOVENO (se cuenta desde 0).'),
        h('li', null, 'Responder solo los valores guardados en vez del arreglo completo con los huecos.'),
        h('li', null, C('and al,1'), ' destruye AL; ', C('test al,1'), ' no. Por eso en las pruebas con ', C('and'), ' se recarga AL.'),
        h('li', null, 'CX = N ⇒ N vueltas. Con ', C('sub si,3'), ' y CX=3 solo se leen 3 elementos.'))),
      callout('', h('b', null, 'Una cosa a vigilar: '), 'en la Batería B 2024-25 el enunciado de d) dice «jz @f → jnz @f», pero el código no tiene ningún ', C('jz'), ': tiene ', C('ja @f'), ' (parece un error al copiar la A). En «Pruebas resueltas» están resueltas las dos lecturas.'),
      h('h2', null, 'Plan para los 2 días'),
      studyPlan());
  }
  function studyPlan() {
    const saved = Store.get('plan', {});
    const items = [
      ['Día 1', [
        ['d1a', 'Leer «Números y ASCII» y hacer 10 ejercicios de numeración.'],
        ['d1b', 'Leer «Anatomía del programa» completa (las 10 etapas).'],
        ['d1c', 'Leer «Registros y banderas» y jugar con el laboratorio de banderas.'],
        ['d1d', 'Repasar «Instrucciones» y ejecutar los ejemplos en el simulador.'],
        ['d1e', 'Ejercicios: 10 de «a/b conceptos» + 10 de «explica la instrucción».'],
        ['d1f', 'Resolver a mano (sin mirar) las pruebas 2023 y comprobar en «Pruebas resueltas».'],
        ['d1g', 'Pregunta 2: aprender la hoja de fórmulas y hacer 15 conversiones rápidas.']]],
      ['Día 2', [
        ['d2a', 'Ejercicios: 15 de «Predice la memoria» + 10 de «¿Qué pasa si…?».'],
        ['d2b', 'Ejercicios: 6 de traceo por vueltas + 5 de «¿Qué salto falta?».'],
        ['d2c', 'Hacer 3 simulacros completos de la pregunta 3 con tiempo (≈ 15 min cada uno).'],
        ['d2d', 'Resolver a mano las pruebas 2024 y 2024-25 y comprobarlas.'],
        ['d2e', 'Repasar los errores típicos y el método de 5 pasos.'],
        ['d2f', 'Pregunta 2: 5 «Pregunta 2 completa» sin mirar las fórmulas.']]]
    ];
    return h('div', { class: 'grid2' }, items.map(([t, list]) => card(h('h3', null, t), list.map(([id, txt]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!saved[id], onchange: e => { saved[id] = e.target.checked; Store.set('plan', saved); } }), h('span', null, txt))))));
  }

  /* =====================================================================
     PREGUNTA 2: MEMORIA Y TIEMPOS
     ===================================================================== */
  function practiceBlock(list, key) {
    let cat = Store.get(key, list[0][0]); if (!list.some(c => c[0] === cat)) cat = list[0][0];
    const chips = h('div', { class: 'tabsrow', role: 'group', 'aria-label': 'Tipos de ejercicio' }); const desc = h('p', { class: 'muted small' }); const host = h('div');
    function drawChips() {
      chips.innerHTML = '';
      list.forEach(([id, lb]) => { const s = Stats.data[id]; chips.append(h('button', { class: 'chip', 'aria-pressed': id === cat ? 'true' : 'false', onclick: () => { cat = id; Store.set(key, id); drawChips(); next(); } }, lb, s ? h('span', { class: 'sc' }, s.ok + '/' + s.n) : null)); });
      desc.textContent = list.find(c => c[0] === cat)[2];
    }
    function next() { renderExercise(Ex.make(cat), host, { onResult: (c, ok) => { Stats.add(c, ok); drawChips(); }, onNext: next, openSim }); }
    drawChips(); next();
    return h('div', null, chips, desc, host);
  }

  function secDDR() {
    const D = window.DDR;
    const sample = D.EXAMS[0];
    view.append(
      callout('', h('b', null, 'La pregunta 2 es SIEMPRE el mismo problema con otros números: '), 'un procesador, una memoria DDR, cuántos canales y cuántos bytes hay que mover. Se resuelve con 6 fórmulas cortas, una por apartado. Las 6 baterías están resueltas abajo y los números salen de código, no de mi cabeza (5 de las 6 dan resultados redondos, buena señal de que el método es el correcto).'),
      card(h('h3', null, 'Así se ve en la prueba (Batería A 2023)'), h('div', { class: 'callout' }, D.statement(sample.p)), h('ul', null, Object.entries(D.PARTS).map(([k, v]) => h('li', null, h('b', null, k + ') '), v)))),
      h('h2', null, '¿De dónde sale cada dato y para qué se usa?'),
      card(h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, ['Dato del enunciado', 'Qué es', 'Se usa en'].map(t => h('th', null, t)))), h('tbody', null, [
        ['1.5 GHz', 'Frecuencia del reloj del procesador: 1.5 mil millones de ciclos por segundo. Su inversa es el período de un ciclo (1 ÷ 1.5 = 0.67 ns).', 'a) y f)'],
        ['60 ciclos', 'Ciclos que gasta la CPU en captar la instrucción, decodificarla y resolver las direcciones, ANTES de tocar la memoria.', 'a)'],
        ['DDR3-1600  (o PC3-12800)', 'El tipo de memoria. DDR3 = generación 3 de «doble tasa». 1600 = millones de transferencias por segundo (MT/s). PC3-12800 es el mismo módulo expresado en MB/s.', 'b), c), d), e)'],
        ['3 memorias, triple canal', 'Tres módulos trabajando en paralelo. Cada uno mueve 8 bytes por transferencia ⇒ 24 bytes a la vez.', 'b)'],
        ['576 bytes', 'Cantidad de datos que la instrucción debe transferir.', 'b) y d)']].map(r => h('tr', null, r.map((c, i) => h('td', null, i === 0 ? h('code', null, c) : c)))))))),
      h('h2', null, 'Hoja de fórmulas (la que debes memorizar)'),
      card(h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, ['', 'Fórmula', 'Unidades', 'Ojo'].map(t => h('th', null, t)))), h('tbody', null, [
        ['a)', 't_captación = ciclos ÷ f_CPU', 'ciclos ÷ GHz = ns', 'Con GHz el resultado sale directo en ns.'],
        ['b)', 'transferencias = bytes ÷ (8 × canales)', 'sin unidad', 'Si no es entero, se redondea hacia ARRIBA.'],
        ['c)', 'f_bus = MT/s ÷ 2', 'MHz', 'DDR transfiere 2 veces por ciclo. Si te dan PC: MT/s = MB/s ÷ 8.'],
        ['d)', 't_memoria = transferencias ÷ MT/s', 'transf ÷ (millones/s) = µs → ×1000 = ns', 'Equivale a: ciclos de bus (transf ÷ 2) × período del bus.'],
        ['e)', 'PCn-X ↔ DDRn-(X ÷ 8)', 'X en MB/s, Y en MT/s', 'Al revés: DDRn-Y ↔ PCn-(Y × 8).'],
        ['f)', 't_total = t_captación + t_memoria', 'ns', 'Es a) + d).']].map(r => h('tr', null, r.map((c, i) => h('td', null, i === 0 ? h('b', null, c) : (i === 1 ? h('code', null, c) : c)))))))),
        callout('good', h('b', null, 'Truco de comprobación: '), 'el tiempo de memoria también sale de t = bytes ÷ ancho de banda. Con 3 × PC3-12800 = 38 400 MB/s = 38.4 B/ns ⇒ 576 ÷ 38.4 = 15 ns. Si tus dos métodos coinciden, está bien.')),
      h('h2', null, 'Glosario: qué es cada cosa'),
      h('div', { class: 'grid2' },
        card(h('dl', { style: 'margin:0' }, ...[
          ['Hz / GHz', 'Ciclos por segundo. 1 GHz = 10⁹ ciclos/s.'], ['Período (T)', 'Lo que dura un ciclo: T = 1 ÷ f. 1 GHz → 1 ns; 3 GHz → 0.333 ns.'], ['ns / µs', '1 µs = 1000 ns. Con MHz: T(ns) = 1000 ÷ f(MHz).'],
          ['Ciclo de reloj', 'La unidad de tiempo del procesador (o del bus). Las instrucciones se miden en ciclos.']].flatMap(([t, d]) => [h('dt', { style: 'font-weight:700;margin-top:8px' }, t), h('dd', { style: 'margin:0 0 0 0' }, d)]))),
        card(h('dl', { style: 'margin:0' }, ...[
          ['Transferencia', 'Un movimiento de datos por el bus: 64 bits = 8 bytes por módulo.'], ['MT/s', 'Mega-transferencias por segundo: velocidad EFECTIVA de la memoria (el número de DDR3-1600).'], ['Canal', 'Un camino de 64 bits hacia la memoria. Doble canal = 2 módulos a la vez (16 B por transferencia).'],
          ['DDR', 'Double Data Rate: dos transferencias por ciclo de reloj (flanco de subida y de bajada).'], ['Frecuencia del bus', 'El reloj real del bus de memoria = MT/s ÷ 2. (DDR3-1600 → 800 MHz).']].flatMap(([t, d]) => [h('dt', { style: 'font-weight:700;margin-top:8px' }, t), h('dd', { style: 'margin:0' }, d)])))),
      h('h2', null, 'Cómo se lee el nombre de una memoria'),
      h('div', { class: 'grid2', style: 'align-items:start' },
        card(h('h3', null, 'Decodificador'), memDecoder()),
        card(h('h3', null, 'Generaciones'), h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, ['DDR', 'PC', 'MT/s', 'Bus (MHz)', 'MB/s'].map(t => h('th', null, t)))), h('tbody', null, D.PAIRS.map(q => h('tr', null, h('td', null, D.ddrName(q.gen, q.mts)), h('td', null, D.pcName(q.gen, q.mbps)), h('td', null, q.mts), h('td', null, q.mts / 2), h('td', null, q.mbps)))))), h('p', { class: 'small muted' }, 'El número de PC es MB/s de un módulo: MT/s × 8 bytes. DDR4-3200 ↔ PC4-25600 porque 3200 × 8 = 25600.'))),
      h('h2', null, 'Calculadora paso a paso'),
      card(memCalc()),
      h('h2', null, 'Las 6 pruebas resueltas'),
      ...D.EXAMS.map((e, i) => solvedDDR(e, i === 0)),
      callout('warn', h('b', null, 'Errores típicos: '), h('ul', null,
        h('li', null, 'Usar 1600 como si fuera MHz del bus: 1600 son MT/s; el bus va a 800 MHz.'),
        h('li', null, 'Olvidar los canales: con triple canal cada transferencia mueve 24 B, no 8.'),
        h('li', null, 'Dividir los bytes entre 8 sin multiplicar por los canales en b).'),
        h('li', null, 'Confundir el número de PC (MB/s) con MT/s: PC3-12800 son 12 800 MB/s = 1600 MT/s.'),
        h('li', null, 'Calcular d) con la frecuencia del bus como si hubiera 1 transferencia por ciclo: son 2.'),
        h('li', null, 'Olvidar sumar a) + d) en f).'),
        h('li', null, 'Batería B 2024: 360 ÷ 16 = 22.5. Se redondea a 23 (la última transferencia va incompleta). Pon el desarrollo y, si quieres, el valor sin redondear (3.75 ns / 43.75 ns).'))),
      callout('', h('b', null, 'Una duda legítima: '), 'en la pregunta c) «frecuencia del bus» aquí uso el reloj del bus (MT/s ÷ 2, p. ej. 800 MHz para DDR3-1600). Algunos apuntes llaman «frecuencia» también a la velocidad efectiva (1600 MHz). Si tu profesor lo hace así, el tiempo d) NO cambia, solo cómo lo nombras: contrasta con tus apuntes.'),
      h('h2', null, 'Practica'),
      practiceBlock([['ddrconv', 'Conversión rápida', 'Notación PC ↔ DDR, MT/s, MHz, períodos, canales y ancho de banda.'], ['ddr', 'Una parte (a–f)', 'Un enunciado completo; calcula un solo apartado.'], ['ddrfull', 'Pregunta 2 completa', 'Los 6 apartados como en la prueba.']], 'ddrcat'));
  }

  function memDecoder() {
    const D = window.DDR; const wrap = h('div'); const out = h('div', { style: 'margin-top:10px' });
    const inp = h('input', { type: 'text', value: 'PC5-48000', 'aria-label': 'Nombre de la memoria', placeholder: 'DDR4-3200 o PC4-25600', style: 'width:180px' });
    const ch = h('select', { 'aria-label': 'Canales' }, ...[1, 2, 3, 4].map(n => h('option', { value: n, selected: n === 3 ? true : null }, n + (n === 1 ? ' canal' : ' canales'))));
    function upd() {
      out.innerHTML = ''; const m = D.parseMem(inp.value);
      if (!m) { out.append(h('span', { class: 'muted' }, 'Escribe un nombre como DDR4-3200, PC4-25600 o DDR-400.')); return; }
      const c = +ch.value;
      out.append(h('table', null, h('tbody', null, [
        ['Generación', m.gen ? 'DDR' + m.gen : 'DDR (primera generación)'], ['Velocidad efectiva', fmt(m.mts) + ' MT/s'], ['Frecuencia del bus', fmt(m.busMHz) + ' MHz  (= MT/s ÷ 2)'], ['Período del bus', fmt(1000 / m.busMHz, 4) + ' ns'],
        ['Ancho de banda por módulo', fmt(m.mbps) + ' MB/s  (= MT/s × 8 B)'], ['Notación alternativa', m.prefix === 'DDR' ? m.pc : m.ddr], ['Con ' + c + ' canal(es)', fmt(m.mbps * c / 1000) + ' GB/s  y ' + 8 * c + ' B por transferencia']].map(r => h('tr', null, h('th', { style: 'width:42%' }, r[0]), h('td', null, r[1]))))));
    }
    [inp, ch].forEach(e => e.addEventListener('input', upd));
    wrap.append(h('div', { class: 'row' }, inp, ch), out); upd(); return wrap;
  }

  function stepsView(p) {
    const D = window.DDR; const s = D.solve(p); const st = D.steps(p, s); const A = D.answers(p, s);
    return h('div', null, Object.keys(D.PARTS).map(k => h('div', { style: 'margin:10px 0' }, h('div', null, h('b', null, k + ') '), D.PARTS[k]), st[k].map(t => h('div', { class: 'small', style: 'margin:2px 0 2px 14px' }, t)),
      h('div', { style: 'margin:2px 0 0 14px' }, h('span', { class: 'pill-arr' }, '⇒ ' + (A[k].kind === 'text' ? A[k].answer : fmt(A[k].answer) + ' ' + A[k].unit))))),
      s.integer ? null : callout('warn', 'Sin redondear: ' + fmt(s.exact) + ' transferencias → d) ' + fmt(s.memNsExact) + ' ns y f) ' + fmt(s.totalNsExact) + ' ns. Redondeando hacia arriba (' + s.transfers + '): d) ' + fmt(s.memNs) + ' ns y f) ' + fmt(s.totalNs) + ' ns.'));
  }
  function solvedDDR(e, open) {
    const D = window.DDR;
    return h('details', { open: open ? true : null }, h('summary', null, h('span', { class: 'tag' }, e.label), h('span', { class: 'muted', style: 'font-weight:400' }, e.p.cpuGHz + ' GHz · ' + e.p.cycles + ' ciclos · ' + e.p.channels + '× ' + e.p.mem + ' · ' + e.p.bytes + ' B')),
      h('div', { class: 'inner' }, h('div', { class: 'callout' }, D.statement(e.p)), stepsView(e.p)));
  }
  function memCalc() {
    const D = window.DDR; const wrap = h('div'); const out = h('div', { style: 'margin-top:10px' });
    const mk = (type, props, w) => h('input', Object.assign({ type, style: 'width:' + w }, props));
    const cpu = mk('number', { value: 3, step: '0.1', min: '0.1', 'aria-label': 'Frecuencia del procesador en GHz' }, '90px'), cyc = mk('number', { value: 60, min: '1', 'aria-label': 'Ciclos' }, '80px'), mem = mk('text', { value: 'PC5-48000', 'aria-label': 'Memoria' }, '130px'), bytes = mk('number', { value: 720, min: '1', 'aria-label': 'Bytes' }, '90px');
    const ch = h('select', { 'aria-label': 'Canales' }, ...[1, 2, 3, 4].map(n => h('option', { value: n, selected: n === 3 ? true : null }, n + (n === 1 ? ' canal' : ' canales'))));
    const load = h('select', { 'aria-label': 'Cargar una prueba' }, h('option', { value: '' }, 'Cargar una prueba…'), ...D.EXAMS.map((e, i) => h('option', { value: i }, e.label)));
    function upd() {
      out.innerHTML = '';
      const p = { cpuGHz: parseFloat(cpu.value), cycles: parseFloat(cyc.value), mem: mem.value, channels: +ch.value, bytes: parseFloat(bytes.value) };
      if (![p.cpuGHz, p.cycles, p.bytes].every(x => x > 0) || !D.parseMem(p.mem)) { out.append(h('span', { class: 'muted' }, 'Completa los datos (memoria tipo DDR4-3200 o PC4-25600).')); return; }
      out.append(h('div', { class: 'callout' }, D.statement(p)), stepsView(p));
    }
    load.addEventListener('change', () => { const e = D.EXAMS[+load.value]; if (!e) return; cpu.value = e.p.cpuGHz; cyc.value = e.p.cycles; mem.value = e.p.mem; ch.value = e.p.channels; bytes.value = e.p.bytes; upd(); });
    [cpu, cyc, mem, ch, bytes].forEach(e => e.addEventListener('input', upd));
    wrap.append(h('div', { class: 'row' }, h('span', null, 'CPU'), cpu, h('span', null, 'GHz ·'), cyc, h('span', null, 'ciclos · memoria'), mem, ch, h('span', null, '·'), bytes, h('span', null, 'bytes')), h('div', { class: 'row', style: 'margin-top:8px' }, load), out); upd(); return wrap;
  }

  /* =====================================================================
     2. NÚMEROS Y ASCII
     ===================================================================== */
  function secNums() {
    view.append(
      callout('', 'Para trazar un programa necesitas pasar sin pensar entre decimal, binario y hexadecimal, y saber cuántos bytes ocupa un número. También entra en el apartado de Verdadero/Falso («5. Sistemas numéricos»).'),
      h('div', { class: 'grid2' },
        card(h('h3', null, 'Las tres bases'), h('ul', null,
          h('li', null, h('b', null, 'Decimal'), ': 10 dígitos (0–9).'),
          h('li', null, h('b', null, 'Binario'), ': solo 0 y 1. Se escribe con sufijo ', C('b'), ' (1010b). Cada dígito es un BIT.'),
          h('li', null, h('b', null, 'Hexadecimal'), ': 16 dígitos (0–9, A–F). Sufijo ', C('h'), ' (3Ah); si empieza con letra, se antepone 0 (', C('0AAh'), '). Cada dígito hex = 4 bits.')),
          P('Un ', h('b', null, 'byte'), ' = 8 bits = 2 dígitos hex ⇒ valores 0…255 (', C('00h'), '…', C('FFh'), '). Una ', h('b', null, 'palabra'), ' (word) = 2 bytes = 4 dígitos hex ⇒ 0…65 535 (', C('FFFFh'), ').')),
        card(h('h3', null, 'Tabla que debes saber de memoria'), hexTable())),
      h('div', { class: 'grid2' },
        card(h('h3', null, 'Cómo convertir'), h('ul', null,
          h('li', null, h('b', null, 'Binario → decimal: '), 'suma las potencias de 2 donde hay un 1. 101101b = 32+8+4+1 = 45.'),
          h('li', null, h('b', null, 'Hex → decimal: '), 'dígito × 16 + dígito. 2Dh = 2×16 + 13 = 45.'),
          h('li', null, h('b', null, 'Decimal → binario: '), 'divide entre 2 y lee los restos de abajo hacia arriba (o resta potencias: 128, 64, 32, 16, 8, 4, 2, 1).'),
          h('li', null, h('b', null, 'Binario ↔ hex: '), 'agrupa de 4 en 4 bits (desde la derecha). 0010 1101b = 2Dh.'),
          h('li', null, h('b', null, '¿Cabe en un byte? '), 'si el hex tiene 1–2 dígitos (≤ FFh = 255), sí. 234h tiene 3 dígitos ⇒ necesita 2 bytes. 100h = 256 ⇒ 2 bytes. FFh ⇒ 1 byte.'),
          h('li', null, h('b', null, 'Registros: '), 'AL/BL/CL/DL son de 8 bits (0–255): «BL = 257» es imposible. AX/BX/CX/DX son de 16 bits.'))),
        card(h('h3', null, 'ASCII: lo mínimo'), h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Grupo'), h('th', null, 'Hex'), h('th', null, 'Decimal'))),
          h('tbody', null, [["'0' … '9'", '30h … 39h', '48 … 57'], ["'A' … 'Z'", '41h … 5Ah', '65 … 90'], ["'a' … 'z'", '61h … 7Ah', '97 … 122'], ['minúscula − mayúscula', '20h', '32']].map(r => h('tr', null, r.map(c => h('td', null, c))))))),
          P('Por eso ', C("cmp al,'A' / cmp al,'Z'"), ' selecciona las mayúsculas, y para pasar de mayúscula a minúscula se suma ', C('20h'), '.'), asciiTool())),
      card(h('h3', null, 'Conversor interactivo'), converter()),
      h('h2', null, 'Practica'),
      practiceMount('num'));
  }
  function hexTable() {
    const rows = []; for (let i = 0; i < 16; i++) rows.push([String(i), i.toString(2).padStart(4, '0'), i.toString(16).toUpperCase()]);
    const half = (a) => h('table', null, h('thead', null, h('tr', null, h('th', null, 'Dec'), h('th', null, 'Bin'), h('th', null, 'Hex'))), h('tbody', null, a.map(r => h('tr', null, r.map(c => h('td', null, c))))));
    return h('div', { class: 'grid2', style: 'gap:8px' }, half(rows.slice(0, 8)), half(rows.slice(8)));
  }
  function converter() {
    const wrap = h('div');
    let bits = Store.get('bits', 0);
    const input = h('input', { type: 'text', placeholder: 'Escribe: 45, 2Dh, 101101b, 0x2D', 'aria-label': 'Número a convertir', style: 'width:100%;max-width:320px' });
    const res = h('div', { style: 'margin-top:10px' });
    const bitsEl = h('div', { class: 'bits', style: 'margin-top:12px' });
    function parse(s) {
      s = s.trim().toLowerCase(); if (!s) return NaN;
      if (/^0x[0-9a-f]+$/.test(s)) return parseInt(s, 16); if (/^[0-9][0-9a-f]*h$/.test(s)) return parseInt(s, 16); if (/^[01]+b$/.test(s)) return parseInt(s, 2); if (/^\d+$/.test(s)) return parseInt(s, 10); return NaN;
    }
    function show(v) {
      res.innerHTML = '';
      if (Number.isNaN(v)) { res.append(h('span', { class: 'muted' }, 'Escribe un número (decimal, 2Dh, 101101b o 0x2D).')); return; }
      const need = v <= 255 ? '1 byte (cabe en AL)' : v <= 65535 ? '2 bytes (necesita AX)' : 'más de 2 bytes';
      res.append(h('table', null, h('tbody', null, [['Decimal', String(v)], ['Hexadecimal', Emu.hx(v, v > 255 ? 16 : 8)], ['Binario', v.toString(2) + 'b' + (v <= 255 ? '  (8 bits: ' + v.toString(2).padStart(8, '0') + ')' : '')], ['Tamaño', need], ['ASCII', v >= 32 && v < 127 ? "'" + String.fromCharCode(v) + "'" : '—']].map(r => h('tr', null, h('th', { style: 'width:130px' }, r[0]), h('td', null, h('code', null, r[1])))))));
    }
    function drawBits() {
      bitsEl.innerHTML = '';
      for (let i = 7; i >= 0; i--) bitsEl.append(h('button', { class: 'bit' + ((bits >> i) & 1 ? ' on' : ''), 'aria-pressed': (bits >> i) & 1 ? 'true' : 'false', title: 'Bit ' + i + ' (valor ' + (1 << i) + ')', onclick: () => { bits ^= (1 << i); Store.set('bits', bits); input.value = String(bits); show(bits); drawBits(); } }, (bits >> i) & 1, h('small', null, 1 << i)));
    }
    input.addEventListener('input', () => { const v = parse(input.value); show(v); if (!Number.isNaN(v) && v <= 255) { bits = v; drawBits(); } });
    input.value = String(bits); show(bits); drawBits();
    wrap.append(h('div', { class: 'row' }, input), res, h('p', { class: 'small muted', style: 'margin-bottom:4px' }, 'Pulsa los bits para encenderlos/apagarlos y ver el valor de un byte:'), bitsEl);
    return wrap;
  }
  function asciiTool() {
    const inp = h('input', { type: 'text', maxlength: '1', placeholder: 'a', 'aria-label': 'Carácter', style: 'width:5ch;text-align:center' });
    const out = h('span', { style: 'margin-left:8px' });
    inp.addEventListener('input', () => { out.textContent = inp.value ? "'" + inp.value + "' = " + Emu.hx(inp.value.charCodeAt(0), 8) + ' = ' + inp.value.charCodeAt(0) + ' = ' + inp.value.charCodeAt(0).toString(2).padStart(8, '0') + 'b' : ''; });
    return h('div', { class: 'row' }, h('span', { class: 'small' }, 'Prueba un carácter:'), inp, out);
  }

  /* =====================================================================
     3. ANATOMÍA
     ===================================================================== */
  function secAnat() {
    const a24 = Programs.EXAMS.find(e => e.id === 'A24');
    const r = Emu.runSource(a24.source);
    view.append(
      callout('', 'Vamos a leer UN programa completo (el de la Batería A 2024) por bloques. Los de las otras 5 pruebas son variaciones de este molde. Pulsa un bloque para ver qué hace, para qué sirve y cómo lo preguntan.'),
      h('h2', null, '¿Qué es un «sector de arranque»?'),
      h('div', { class: 'stepflow' }, ...[['1 · Enciendes el PC', 'El BIOS toma el control.'], ['2 · Lee el sector 0', 'Los primeros 512 bytes del disco.'], ['3 · Comprueba la firma', 'Los 2 últimos bytes deben ser 55h AAh.'], ['4 · Lo copia a 7C00h', 'Dirección fija 0000:7C00h.'], ['5 · Salta ahí', 'Ejecuta TU código, sin sistema operativo.']].map(([t, d]) => h('div', null, h('b', null, t), d))),
      P('Eso explica las tres directivas de la pregunta a): ', C('org 7C00h'), ' (dónde se carga), ', C('times 510-($-$$) db 0'), ' (rellenar hasta 510 bytes) y ', C('dw 0AA55h'), ' (la firma que el BIOS comprueba).'),
      h('h2', null, 'Mapa del sector de este programa'), card(sectorMap(r.prog)),
      h('h2', null, 'El programa por bloques'));
    const wrap = h('div', { class: 'grid2', style: 'align-items:start' });
    const listing = h('div'); const detail = h('div');
    const lines = a24.source.split('\n');
    let selBlock = 4;
    function blockLines(b) { const s = new Set(); let from = 0; b.lines.forEach(t => { const i = lines.findIndex((l, ix) => ix >= from && l.trim() === t); if (i >= 0) { s.add(i); from = i + 1; } }); return s; }
    function draw() {
      listing.innerHTML = ''; detail.innerHTML = '';
      const sel = blockLines(Content.ANATOMY[selBlock]);
      listing.append(codeBlock(a24.source, { mark: sel, onClick: i => { const b = Content.ANATOMY.findIndex(bb => blockLines(bb).has(i)); if (b >= 0) { selBlock = b; draw(); } } }));
      const b = Content.ANATOMY[selBlock];
      detail.append(card(h('span', { class: 'tag' }, 'Bloque ' + b.step), h('h3', { style: 'margin-top:8px' }, b.title),
        h('div', { class: 'kv' }, h('b', null, 'Qué hace'), h('span', null, b.what), h('b', null, 'Para qué'), h('span', null, b.why), h('b', null, 'En la prueba'), h('span', null, b.exam)),
        h('h4', { style: 'margin-top:14px' }, 'Línea por línea'), b.lines.map(l => { const idx = lines.findIndex(x => x.trim() === l); const [ti, tx] = Content.explainLine(lines, idx); return h('div', { style: 'margin:8px 0' }, h('code', null, l), h('div', { class: 'small' }, h('b', null, ti), ' — ', tx)); }),
        h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', disabled: selBlock === 0, onclick: () => { selBlock--; draw(); } }, '← Anterior'), h('button', { class: 'btn primary', disabled: selBlock === Content.ANATOMY.length - 1, onclick: () => { selBlock++; draw(); } }, 'Siguiente →'))));
    }
    draw(); wrap.append(listing, detail); view.append(wrap);
    view.append(h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn primary', onclick: () => openSim(a24.source, 'Batería A 2024') }, '▶ Ejecutar este programa paso a paso')),
      h('h2', null, 'Las 3 directivas del apartado a): respuestas modelo'),
      h('div', { class: 'grid3' }, ...[['org 7C00h', Content.MCQ[0]], ['times 510-($-$$) db 0', Content.MCQ[1]], ['dw 0AA55h', Content.MCQ[2]]].map(([s, q]) => card(h('h3', null, C(s)), P(q.o[q.a]), h('p', { class: 'small muted' }, q.w)))));
  }

  /* =====================================================================
     4. REGISTROS, MEMORIA, BANDERAS
     ===================================================================== */
  function secRegs() {
    view.append(
      h('div', { class: 'grid2' },
        card(h('h3', null, 'Registros que aparecen en la prueba'), h('table', null, h('tbody', null, [
          ['AL', 'Acumulador (8 bits). Aquí se lee cada elemento: mov al,[si].'],
          ['AX', '16 bits = AH (alto) + AL (bajo). Se usa solo para preparar DS.'],
          ['SI', 'Puntero de ORIGEN: la dirección del elemento que se lee.'],
          ['DI', 'Puntero de DESTINO: dónde se escribe el resultado.'],
          ['BX', 'Segundo puntero (cuando hay dos arreglos destino).'],
          ['CX', 'CONTADOR del ciclo. LOOP lo decrementa.'],
          ['CS / DS', 'Segmentos de código y de datos. DS debe igualar a CS.']].map(r => h('tr', null, h('th', { style: 'width:70px' }, r[0]), h('td', null, r[1])))))),
        card(h('h3', null, 'Dirección vs contenido (lo más importante)'), P('Una etiqueta como ', C('num1'), ' es una DIRECCIÓN (un número, p. ej. 7C2Ah). Los corchetes piden el CONTENIDO de esa dirección.'),
          h('table', null, h('tbody', null, [['mov si, num1', 'SI = dirección de num1 (7C2Ah)'], ['mov al, [si]', 'AL = el byte que está en esa dirección'], ['mov si, num1+8', 'SI = dirección del NOVENO elemento'], ['mov [di], al', 'escribe AL en la dirección que tiene DI'], ['inc si', 'SI = SI + 1 (apunta al siguiente byte)']].map(r => h('tr', null, h('td', null, C(r[0])), h('td', null, r[1])))))),
      ),
      h('h2', null, 'Demo: un puntero recorriendo un arreglo'), card(pointerDemo()),
      h('h2', null, 'Las banderas (flags)'),
      P('Casi todas las instrucciones aritméticas/lógicas dejan «anotaciones» en el registro de banderas. Los saltos condicionales las leen. Para la prueba bastan estas dos:'),
      h('div', { class: 'grid2' },
        card(h('h3', null, 'ZF — Zero'), P('ZF=1 cuando el resultado de la última operación fue 0. Con ', C('cmp'), ' significa «son iguales».')),
        card(h('h3', null, 'CF — Carry (acarreo / préstamo)'), P('En ', C('cmp a,b'), ' (o sub): CF=1 si a < b (sin signo). Con ', C('add'), ': CF=1 si el resultado no cabe.'))),
      callout('good', h('b', null, 'Regla para decidir saltos tras «cmp a, b»: '), 'lee «a  OPERADOR  b». ', C('ja'), ' = a > b · ', C('jae'), ' = a ≥ b · ', C('jb'), ' = a < b · ', C('jbe'), ' = a ≤ b · ', C('jz'), ' = a = b · ', C('jnz'), ' = a ≠ b.'),
      h('h2', null, 'Laboratorio de banderas'), card(flagLab()));
  }
  function pointerDemo() {
    const arr = [12, 3, 8, 9, 12, 15, 18, 6, 52]; const base = 0x7C27;
    let si = null, al = null, log = 'Pulsa «mov si, num1» para empezar.';
    const wrap = h('div');
    function draw() {
      wrap.innerHTML = '';
      const cells = h('div', { class: 'cells hasptr' }, arr.map((v, i) => h('div', { class: 'cell', style: si === base + i ? 'border-color:var(--accent);background:var(--accent-soft)' : '' }, h('div', { class: 'i' }, 'num1+' + i), h('div', { class: 'v' }, v), h('div', { class: 'x' }, Emu.hx(base + i, 16)), si === base + i ? h('div', { class: 'ptr' }, '▲SI') : null)));
      const btn = (label, fn) => h('button', { class: 'btn sm', onclick: () => { fn(); draw(); } }, label);
      wrap.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('code', null, 'num1 db 12, 3, 8, 9, 12, 15, 18, 6, 52'), h('span', { class: 'muted small' }, '(supongamos num1 en ' + Emu.hx(base, 16) + ')')), cells,
        h('div', { class: 'row', style: 'margin:10px 0' },
          btn('mov si, num1', () => { si = base; log = 'SI ← dirección de num1 = ' + Emu.hx(si, 16) + '. SI apunta al primer elemento.'; }),
          btn('mov si, num1+8', () => { si = base + 8; log = 'SI ← num1+8 = ' + Emu.hx(si, 16) + '. Apunta al NOVENO elemento (índice 8).'; }),
          btn('inc si', () => { if (si == null) { log = 'Primero carga SI.'; return; } si++; log = 'SI ← SI + 1 = ' + Emu.hx(si, 16) + '.'; }),
          btn('add si, 3', () => { if (si == null) { log = 'Primero carga SI.'; return; } si += 3; log = 'SI ← SI + 3: se salta 2 elementos.'; }),
          btn('sub si, 3', () => { if (si == null) { log = 'Primero carga SI.'; return; } si -= 3; log = 'SI ← SI − 3: retrocede 3 elementos.'; }),
          btn('mov al, [si]', () => { if (si == null) { log = 'Primero carga SI.'; return; } const i = si - base; if (i < 0 || i >= arr.length) { log = 'SI apunta fuera de num1: leerías basura (otro dato o el código).'; al = null; } else { al = arr[i]; log = 'AL ← contenido de la dirección ' + Emu.hx(si, 16) + ' = ' + al + '.'; } })),
        h('div', { class: 'explain' }, h('div', null, log), h('div', { class: 'small muted', style: 'margin-top:6px' }, 'SI = ' + (si == null ? '?' : Emu.hx(si, 16) + ' (num1+' + (si - base) + ')') + '   ·   AL = ' + (al == null ? '?' : al))));
    }
    draw(); return wrap;
  }
  function flagLab() {
    const wrap = h('div');
    const A = h('input', { type: 'number', min: 0, max: 255, value: 20, style: 'width:90px', 'aria-label': 'Valor de AL' });
    const B = h('input', { type: 'number', min: 0, max: 255, value: 15, style: 'width:90px', 'aria-label': 'Segundo operando' });
    const OP = h('select', { 'aria-label': 'Operación' }, ...['cmp', 'test', 'and', 'sub', 'add'].map(o => h('option', { value: o }, o)));
    const out = h('div', { style: 'margin-top:10px' });
    function upd() {
      const a = Math.max(0, Math.min(255, parseInt(A.value, 10) || 0)), b = Math.max(0, Math.min(255, parseInt(B.value, 10) || 0));
      const r = Emu.runSource('org 7C00h\nmov al, ' + a + '\n' + OP.value + ' al, ' + b + '\njmp $');
      const st = r.trace.final; const f = st.flags; const al = st.regs[0] & 0xFF;
      const names = ['jz', 'jnz', 'ja', 'jae', 'jb', 'jbe'];
      const rel = a === b ? 'AL = ' + b : a > b ? 'AL > ' + b : 'AL < ' + b;
      out.innerHTML = '';
      out.append(h('div', { class: 'row' }, h('code', null, OP.value + ' al, ' + b), h('span', null, '→ AL = ' + al + (OP.value === 'cmp' || OP.value === 'test' ? '  (no cambia)' : ''))),
        h('div', { class: 'flags' }, ...['ZF', 'CF', 'SF', 'OF', 'PF'].map(n => h('span', { class: 'flag' + (f[n] ? ' on' : '') }, n + '=' + f[n]))),
        OP.value === 'cmp' ? h('p', { class: 'small muted' }, 'Comparación (sin signo): ' + rel + '.') : null,
        h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, ...names.map(n => h('th', null, n)))), h('tbody', null, h('tr', null, ...names.map(n => h('td', { style: 'font-weight:700;color:var(--' + (Emu.COND[n][1](f) ? 'good' : 'muted') + ')' }, Emu.COND[n][1](f) ? '✔ salta' : '✘ no salta')))))));
    }
    [A, B, OP].forEach(e => e.addEventListener('input', upd));
    wrap.append(h('div', { class: 'row' }, h('span', null, 'AL ='), A, OP, h('span', null, 'AL,'), B), out); upd(); return wrap;
  }

  /* =====================================================================
     5. INSTRUCCIONES
     ===================================================================== */
  function secInstr() {
    view.append(callout('', 'Solo están las instrucciones que usan las pruebas (más un par de primas). Cada ejemplo se puede ejecutar en el simulador.'));
    const groups = [...new Set(Content.CARDS.map(c => c.g))];
    for (const g of groups) {
      view.append(h('h2', null, g));
      view.append(h('div', { class: 'grid2' }, Content.CARDS.filter(c => c.g === g).map(c => card(
        h('h3', null, C(c.n)), h('div', { class: 'kv' }, h('b', null, 'Sintaxis'), h('span', null, C(c.syn)), h('b', null, 'Qué hace'), h('span', null, c.what), h('b', null, 'Banderas'), h('span', null, c.flags)),
        c.rules.length ? h('ul', null, c.rules.map(r => h('li', null, r))) : null,
        c.ex.map(e => h('div', { style: 'margin-top:10px' }, codeBlock(e.code), h('div', { class: 'row', style: 'margin-top:6px' }, h('span', { class: 'small muted' }, e.note), h('button', { class: 'btn sm', onclick: () => openSim('org 7C00h\n' + e.code, 'Ejemplo: ' + c.n) }, '▶ Ejecutar')))),
        h('p', { class: 'small muted', style: 'margin-top:10px' }, '📌 En la prueba: ' + c.exam)))));
    }
    view.append(h('h2', null, 'Directivas y datos'), card(h('table', null, h('tbody', null, Content.DIRECTIVES.map(d => h('tr', null, h('td', { style: 'width:36%' }, C(d[0])), h('td', null, d[1])))))),
      h('h2', null, 'Saltos: equivalencias y contrarios'),
      card(h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, ['Condición (cmp a, b)', 'Sin signo (0–255)', 'Con signo', 'Contrario'].map(t => h('th', null, t)))), h('tbody', null, [
        ['a = b', 'jz / je', 'jz / je', 'jnz / jne'], ['a ≠ b', 'jnz / jne', 'jnz / jne', 'jz / je'], ['a > b', 'ja', 'jg', 'jbe / jle'], ['a ≥ b', 'jae (= jnb = jnc)', 'jge', 'jb / jl'], ['a < b', 'jb (= jnae = jc)', 'jl', 'jae / jge'], ['a ≤ b', 'jbe (= jna)', 'jle', 'ja / jg']].map(r => h('tr', null, r.map(c => h('td', null, c))))))),
        h('p', { class: 'small muted' }, 'En las pruebas solo aparecen los saltos «sin signo» (ja, jae, jb, jbe) porque los datos son bytes 0–255 y caracteres ASCII.')));
  }

  /* =====================================================================
     6. SIMULADOR
     ===================================================================== */
  function secSim() {
    view.append(callout('', 'Elige una de las 6 pruebas (o su variante d), ejecuta paso a paso y mira cómo cambian registros, banderas y memoria. En ', h('b', null, '✎ Editar código'), ' puedes escribir el tuyo: cambia un salto y comprueba tu respuesta de d).'));
    if (pendingSim) { sim.load(pendingSim.source, pendingSim.title); pendingSim = null; }
    else if (!sim.loaded) { const p = UI.PRESETS()[4]; sim.load(p.source, p.label); }
    else sim.render();
    view.append(sim.el);
  }

  /* =====================================================================
     7. PRUEBAS RESUELTAS
     ===================================================================== */
  function secSolved() {
    view.append(callout('', 'Las 6 pruebas con la pregunta 3 completa: a), b) con las líneas subrayadas del papel original, c) y d) calculadas ejecutando el programa. ', h('b', null, 'Intenta resolver cada una a mano ANTES de abrirla.')));
    Programs.EXAMS.forEach((e, idx) => {
      const { r, out } = exResult(e);
      const marks = ulSet(e); const lines = e.source.split('\n');
      const det = h('details', { open: idx === 0 ? true : null });
      det.append(h('summary', null, h('span', { class: 'tag' }, 'Batería ' + e.bat), 'Curso ' + e.year + ' — ', h('span', { class: 'muted', style: 'font-weight:400' }, e.family)));
      const inner = h('div', { class: 'inner' });
      inner.append(h('p', null, h('b', null, 'Idea del programa: '), e.summary), codeBlock(e.source, { mark: marks }), h('p', { class: 'small muted' }, 'Las líneas subrayadas son las que pedían explicar en b).'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => openSim(e.source, 'Batería ' + e.bat + ' ' + e.year) }, '▶ Ejecutar paso a paso')));
      // a
      const q = e.asked.a === 'org 7C00h' ? Content.MCQ[0] : e.asked.a.startsWith('times') ? Content.MCQ[1] : Content.MCQ[2];
      const [, aTx] = Content.explainLine([e.asked.a], 0);
      inner.append(h('h3', null, 'a) ¿Para qué se utiliza «' + e.asked.a + '»?'), details('Ver respuesta', h('div', null, P(q.o[q.a]), h('p', { class: 'small muted' }, aTx))));
      // b
      inner.append(h('h3', null, 'b) Función de las instrucciones subrayadas'), details('Ver respuestas', h('div', null, [...marks].map(i => { const [ti, tx] = Content.explainLine(lines, i); return h('div', { style: 'margin:10px 0' }, h('code', null, lines[i].trim()), h('div', null, h('b', null, ti)), h('div', { class: 'small' }, tx)); }))));
      // c
      inner.append(h('h3', null, 'c) ¿Qué se almacena en ' + e.ask.join(' y ') + '?'), details('Ver respuesta y traza', h('div', null, ...Object.entries(out).map(([k, v]) => h('div', null, h('span', { class: 'pill-arr' }, k + ' = ' + arrTxt(v, typeof v === 'string')))), h('p', { class: 'small muted' }, 'Traza por vueltas:'), iterTable(r.prog, r.trace))));
      // d
      e.variants.forEach(v => {
        const src2 = Programs.applyVariant(e.source, v); const res = exResult(e, src2);
        inner.append(h('h3', null, 'd) ' + (e.variants.length > 1 ? 'Lectura: ' : '') + v.label), details('Ver respuesta y traza', h('div', null, ...Object.entries(res.out).map(([k, val]) => h('div', null, h('span', { class: 'pill-arr' }, k + ' = ' + arrTxt(val, typeof val === 'string')))),
          h('p', { class: 'small' }, dExplain(e, v)), h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => openSim(src2, 'Batería ' + e.bat + ' ' + e.year + ' — variante d)') }, '▶ Ejecutar la variante')), iterTable(res.r.prog, res.r.trace))));
      });
      if (e.note) inner.append(callout('warn', e.note));
      det.append(inner); view.append(det);
    });
  }
  function details(label, content) { return h('details', null, h('summary', null, label), h('div', { class: 'inner' }, content)); }
  function dExplain(e, v) { return v.why || 'Se invierte el criterio del filtro.'; }

  /* =====================================================================
     8. EJERCICIOS
     ===================================================================== */
  const CATS = [
    ['num', 'Números / V-F', 'Conversión de bases, ASCII y Verdadero/Falso como en el apartado 5 de la pregunta 1.'],
    ['dir', 'a) Conceptos y directivas', 'org, times, dw 0AA55h, jmp $, dup, etiquetas… y preguntas de teoría.'],
    ['instr', 'b) Explica la instrucción', 'Elige la función de la línea subrayada.'],
    ['pred', 'c) Predice la memoria', '¿Qué queda en num2 / cadena2 al final?'],
    ['what', 'd) ¿Qué pasa si…?', 'Inversión de saltos y cambios de rango.'],
    ['trace', 'Traceo por vueltas', 'Tabla de traza, conteo de vueltas y valores finales.'],
    ['jump', '¿Qué salto falta?', 'Deduce el salto condicional a partir del resultado.'],
    ['extra', 'Extras (por si acaso)', 'Mayúsculas ↔ minúsculas y acumuladores en registros: no han caído aún.']
  ];
  const current = {};
  function practiceMount(cat) {
    const host = h('div'); const info = h('div');
    const next = () => { current[cat] = Ex.make(cat); renderExercise(current[cat], host, { onResult: (c, ok) => Stats.add(c, ok), onNext: next, openSim }); };
    next(); return h('div', null, info, host);
  }
  function secPractice() {
    let cat = Store.get('cat', 'pred');
    const chips = h('div', { class: 'tabsrow', role: 'group', 'aria-label': 'Categorías' }); const desc = h('p', { class: 'muted small' }); const host = h('div');
    function drawChips() {
      chips.innerHTML = '';
      CATS.forEach(([id, lb]) => { const s = Stats.data[id]; chips.append(h('button', { class: 'chip', 'aria-pressed': id === cat ? 'true' : 'false', onclick: () => { cat = id; Store.set('cat', id); drawChips(); next(); } }, lb, s ? h('span', { class: 'sc' }, s.ok + '/' + s.n) : null)); });
      desc.textContent = CATS.find(c => c[0] === cat)[2];
    }
    function next() { const ex = Ex.make(cat); renderExercise(ex, host, { onResult: (c, ok) => { Stats.add(c, ok); drawChips(); }, onNext: next, openSim }); }
    view.append(callout('', 'Cada ejercicio se genera al azar y su respuesta sale de ejecutar el programa en el emulador, así que puedes hacer cientos. Sigue el estilo de las pruebas: mismas instrucciones, mismos apartados.'), chips, desc, host);
    drawChips(); next();
  }

  /* =====================================================================
     9. SIMULACRO
     ===================================================================== */
  function secMock() {
    const host = h('div');
    view.append(callout('', 'Una pregunta 3 completa con apartados a), b), c) y d), como en la prueba. Cuenta ~15 minutos y responde sin usar el simulador. Al corregir, recibes la nota y las explicaciones.'), host);
    function build() {
      const s = Ex.makeSimulacro(); host.innerHTML = '';
      const ins = { a: null, b: [], c: {}, d: {} }; let done = false;
      host.append(h('div', { class: 'card' }, h('p', { class: 'prompt' }, '3. Dado el siguiente programa en lenguaje ensamblador efectúe el traceo y responda las siguientes preguntas:'), codeBlock(s.code, { mark: new Set(s.marked) })));
      // a
      const aOpts = h('div', { class: 'opts' });
      s.a.opts.forEach((t, i) => aOpts.append(h('button', { class: 'opt', 'aria-pressed': 'false', onclick: ev => { if (done) return; ins.a = i; [...aOpts.children].forEach((c, j) => { c.setAttribute('aria-pressed', j === i ? 'true' : 'false'); c.style.borderColor = j === i ? 'var(--accent)' : ''; }); } }, h('span', { class: 'l' }, 'ABCD'[i] + ')'), h('span', null, t))));
      host.append(card(h('h3', null, 'a) ' + s.a.prompt), aOpts));
      // b
      const bBox = card(h('h3', null, 'b) Explique qué función tiene en el código las instrucciones subrayadas'));
      const code = s.code.split('\n');
      s.parts.forEach((p, i) => { const sel = h('select', { 'aria-label': 'Función de la línea ' + (p.line + 1), style: 'max-width:100%' }, h('option', { value: '' }, '— elige —'), ...p.opts.map((t, j) => h('option', { value: j }, t))); ins.b[i] = sel; bBox.append(h('div', { class: 'ans-row' }, h('code', null, code[p.line].trim()), sel)); });
      host.append(bBox);
      // c, d
      const fieldsFor = (blk, key) => { const box = h('div'); const fs = blk.regs ? blk.regs : blk.asks; fs.forEach(l => { const inp = h('input', { type: 'text', 'aria-label': l, placeholder: blk.regs ? 'valor decimal' : blk.text ? 'cadena' : 'valores separados por comas', autocomplete: 'off', spellcheck: 'false' }); ins[key][l] = inp; box.append(h('div', { class: 'ans-row' }, h('label', null, l + ' ='), inp)); }); return box; };
      host.append(card(h('h3', null, 'c) ' + (s.c.regs ? '¿Qué valor tienen BL y DL al final?' : '¿Qué se almacena en ' + s.c.asks.join(' y ') + '?')), fieldsFor(s.c, 'c')));
      host.append(card(h('h3', null, 'd) ' + s.d.prompt), fieldsFor(s.d, 'd')));
      const res = h('div');
      const grade = () => {
        if (done) return; done = true; let pts = 0; const fb = [];
        const aok = ins.a === s.a.ans; if (aok) pts += 1; fb.push(['a)', aok, s.a.why + ' (Correcta: ' + 'ABCD'[s.a.ans] + ')']);
        let bok = 0; s.parts.forEach((p, i) => { const ok = ins.b[i].value !== '' && +ins.b[i].value === p.ans; if (ok) bok++; ins.b[i].classList.toggle('ok', ok); ins.b[i].classList.toggle('no', !ok); fb.push(['b) ' + code[p.line].trim(), ok, p.opts[p.ans] + ' — ' + p.why]); });
        pts += bok / s.parts.length;
        const check = (blk, key) => { let all = true; const lines = []; (blk.regs || blk.asks).forEach(l => { let ok; if (blk.regs) { ok = Ex.parseIn(ins[key][l].value, 10) === blk.answer[l]; lines.push(l + ' = ' + blk.answer[l]); } else { ok = Ex.checkList(Ex.parseList(ins[key][l].value, blk.text), blk.answer[l], blk.text).ok; lines.push(l + ' = ' + arrTxt(blk.answer[l], blk.text)); } ins[key][l].classList.toggle('ok', ok); ins[key][l].classList.toggle('no', !ok); all = all && ok; }); return [all, lines.join('   ')]; };
        const [cok, ctxt] = check(s.c, 'c'); if (cok) pts += 1; fb.push(['c)', cok, 'Respuesta: ' + ctxt]);
        const [dok, dtxt] = check(s.d, 'd'); if (dok) pts += 1; fb.push(['d)', dok, 'Respuesta: ' + dtxt]);
        Stats.add('pred', cok); Stats.add('what', dok); Stats.add('dir', aok); Stats.add('instr', bok === s.parts.length);
        res.innerHTML = '';
        res.append(h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Nota: ' + (Math.round(pts * 10) / 10) + ' / 4'), h('div', { class: 'tscroll' }, h('table', null, h('tbody', null, fb.map(([k, ok, m]) => h('tr', null, h('th', { style: 'width:34%' }, k), h('td', { style: 'width:36px;font-weight:700;color:var(--' + (ok ? 'good' : 'bad') + ')' }, ok ? '✔' : '✘'), h('td', null, m)))))), h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => openSim(s.code, 'Simulacro') }, '▶ Ver el programa original paso a paso'), h('button', { class: 'btn', onclick: () => openSim(s.d.runSource, 'Simulacro — variante d)') }, '▶ Ver la variante d)'), h('button', { class: 'btn primary', onclick: build }, 'Nuevo simulacro →'))));
        res.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      host.append(h('div', { class: 'row', style: 'margin:14px 0' }, h('button', { class: 'btn primary', onclick: grade }, 'Corregir'), h('button', { class: 'btn', onclick: build }, 'Otro simulacro')), res);
    }
    build();
  }

  /* ---------- start ---------- */
  refreshProgress();
  window.addEventListener('hashchange', () => { const id = (location.hash || '').slice(1); const cur = nav.querySelector('[aria-current="page"]'); if (SECTIONS.some(s => s.id === id) && (!cur || cur.dataset.id !== id)) go(id); });
  const start = (location.hash || '').slice(1) || Store.get('last', 'map');
  go(SECTIONS.some(s => s.id === start) ? start : 'map');
})();
