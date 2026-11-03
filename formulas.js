/* Typeset formulas for question 2 (MathML, no external libraries).
 *
 * Notation (standard in computer-architecture texts):
 *   T = 1/f                          period / frequency
 *   t_CPU = ciclos x T = ciclos / f  time = clock cycles x cycle time
 *   MT/s = 2 x f_bus                 DDR transfers twice per bus clock
 *   MB/s = MT/s x 8 B                64-bit bus (module name PCn-X)
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const DDR = isNode ? require('./ddr.js') : root.DDR;
  const fmt = DDR.fmt;

  /* ---------- MathML builders (return strings) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const mi = (s, it) => '<mi' + (it ? ' mathvariant="italic"' : '') + '>' + esc(s) + '</mi>';
  const mn = s => '<mn>' + esc(s) + '</mn>';
  const mo = s => '<mo>' + esc(s) + '</mo>';
  const mt = s => '<mtext>' + esc(s) + '</mtext>';
  const sub = (b, s) => '<msub>' + b + s + '</msub>';
  const row = (...a) => '<mrow>' + a.join('') + '</mrow>';
  const frac = (n, d) => '<mfrac>' + row(n) + row(d) + '</mfrac>';
  const ceil = x => row(mo('⌈'), x, mo('⌉'));
  const unit = u => mt(' ' + u);
  const M = (...a) => '<math display="block">' + a.join('') + '</math>';
  const EQ = mo('='), TIM = mo('×'), PLUS = mo('+'), ARROW = mo('⇒'), BOTH = mo('⇔');

  /* symbols */
  const S = {
    f: mi('f'), T: mi('T'),
    fCPU: sub(mi('f'), mt('CPU')), TCPU: sub(mi('T'), mt('CPU')),
    ciclos: mt('ciclos'),
    tcapt: sub(mi('t'), mt('capt')), tmem: sub(mi('t'), mt('mem')), ttot: sub(mi('t'), mt('total')),
    D: mi('D'), c: mi('c'),
    Btr: sub(mi('B'), mt('tr')), Ntr: sub(mi('N'), mt('tr')),
    vef: sub(mi('v'), mt('ef')), fbus: sub(mi('f'), mt('bus')), Tbus: sub(mi('T'), mt('bus')),
    BWmod: sub(mi('BW', true), mt('mód')), BWtot: sub(mi('BW', true), mt('total'))
  };

  /* ---------- formula sheet (every formula used in question 2) ---------- */
  const SHEET = [
    {
      title: 'Período y frecuencia', items: [
        { id: 'T', math: M(S.T, EQ, frac(mn(1), S.f), mo(','), S.f, EQ, frac(mn(1), S.T)), donde: 'T = período (lo que dura un ciclo), f = frecuencia (ciclos por segundo).' },
        { id: 'conv', math: M(mn(1), unit('GHz'), BOTH, S.T, EQ, mn(1), unit('ns'), mo(','), S.T, mo('('), mt('ns'), mo(')'), EQ, frac(mn(1000), row(S.f, mo('('), mt('MHz'), mo(')')))), donde: 'Con f en GHz, T sale directo en ns. Con f en MHz: T(ns) = 1000 ÷ f(MHz). Además 1 µs = 1000 ns.' }
      ]
    },
    {
      title: 'a) Captación, decodificación y resolución de direcciones', items: [
        { id: 'a', math: M(S.tcapt, EQ, S.ciclos, TIM, S.TCPU, EQ, frac(S.ciclos, S.fCPU)), donde: 'ciclos = ciclos de reloj del procesador (dato del enunciado); f_CPU en GHz ⇒ t en ns.' }
      ]
    },
    {
      title: 'b) Transferencias necesarias', items: [
        { id: 'b1', math: M(S.Btr, EQ, mn(8), unit('B'), TIM, S.c), donde: 'Cada módulo mueve 64 bits = 8 B por transferencia; los c canales trabajan en paralelo. B_tr = bytes por transferencia.' },
        { id: 'b2', math: M(S.Ntr, EQ, ceil(frac(S.D, S.Btr)), EQ, ceil(frac(S.D, row(mn(8), unit('B'), TIM, S.c)))), donde: 'D = bytes a transferir (dato del enunciado). ⌈ ⌉ = redondear hacia ARRIBA si no da un entero exacto.' }
      ]
    },
    {
      title: 'c) Frecuencia del bus', items: [
        { id: 'c1', math: M(S.vef, EQ, mi('Y'), unit('MT/s')), donde: 'Si el nombre es DDRn-Y: la velocidad efectiva v_ef es directamente el número Y, en MT/s (mega-transferencias por segundo).' },
        { id: 'c1b', math: M(S.vef, EQ, frac(S.BWmod, row(mn(8), unit('B'))), mo(','), S.BWmod, EQ, mi('X'), unit('MB/s')), donde: 'Si el nombre es PCn-X: X es el ancho de banda de UN módulo (BW_mód) en MB/s; cada transferencia son 8 B, así que v_ef = X ÷ 8.' },
        { id: 'c2', math: M(S.fbus, EQ, frac(S.vef, mn(2)), BOTH, S.vef, EQ, mn(2), TIM, S.fbus), donde: 'DDR (Double Data Rate) transfiere 2 veces por ciclo del bus: MT/s = 2 × MHz. f_bus es la frecuencia real del reloj del bus.' }
      ]
    },
    {
      title: 'e) Notación alternativa del nombre', items: [
        { id: 'e', math: M(mt('PCn-X'), BOTH, mt('DDRn-Y'), mo(','), mi('X'), EQ, mn(8), TIM, mi('Y'), mo(','), mi('Y'), EQ, frac(mi('X'), mn(8))), donde: 'X = MB/s del módulo (PC), Y = MT/s (DDR); el 8 son los bytes por transferencia. Ejemplo: DDR3-1600 ⇔ PC3-(1600 × 8) = PC3-12800.' },
        { id: 'e2', math: M(S.BWmod, EQ, S.vef, TIM, mn(8), unit('B')), donde: 'El ancho de banda de un módulo es la velocidad efectiva por 8 B (bus de 64 bits). Ejemplo: 1600 MT/s × 8 B = 12 800 MB/s.' }
      ]
    },
    {
      title: 'd) Tiempo que demora la memoria', items: [
        { id: 'd1', math: M(S.tmem, EQ, frac(S.Ntr, S.vef)), donde: 'N_tr = transferencias; v_ef en MT/s (10⁶ transferencias por segundo) ⇒ el cociente sale en µs.' },
        { id: 'd1b', math: M(S.tmem, mo('('), mt('ns'), mo(')'), EQ, mn(1000), TIM, frac(S.Ntr, S.vef), mo('('), S.vef, mt('\u00a0en MT/s'), mo(')')), donde: 'Para pasar de µs a ns se multiplica por 1000 (1 µs = 1000 ns).' },
        { id: 'd2', math: M(S.tmem, EQ, frac(S.Ntr, mn(2)), TIM, S.Tbus, mo(','), S.Tbus, EQ, frac(mn(1), S.fbus)), donde: 'Método equivalente: ciclos de bus = N_tr ÷ 2 (2 transferencias por ciclo) por el período del bus T_bus.' }
      ]
    },
    {
      title: 'f) Tiempo total', items: [
        { id: 'f', math: M(S.ttot, EQ, S.tcapt, PLUS, S.tmem), donde: 'Primero se capta/decodifica (CPU) y después se transfieren los datos (memoria): los tiempos se suman.' }
      ]
    },
    {
      title: 'Comprobación (ancho de banda)', items: [
        { id: 'bw', math: M(S.BWtot, EQ, S.vef, TIM, mn(8), unit('B'), TIM, S.c, mo(','), S.tmem, EQ, frac(S.D, S.BWtot)), donde: 'Si los dos métodos para t_mem coinciden, el cálculo está bien. (1 MB/s = 1 B/µs.)' }
      ]
    },
    {
      title: 'Despejes (problemas inversos)', items: [
        { id: 'inv1', math: M(S.Ntr, EQ, frac(row(S.tmem, TIM, S.vef), mn(1000)), mo(','), S.D, EQ, S.Ntr, TIM, mn(8), TIM, S.c, mo(','), S.c, EQ, frac(S.D, row(mn(8), TIM, S.Ntr))), donde: 'Si te dan t_mem (en ns) y piden los bytes D o los canales c.' },
        { id: 'inv2', math: M(S.vef, EQ, mn(1000), TIM, frac(S.Ntr, S.tmem), mo(','), S.fCPU, EQ, frac(S.ciclos, S.tcapt), mo(','), S.ciclos, EQ, S.tcapt, TIM, S.fCPU), donde: 'Si piden la velocidad de la memoria, la frecuencia del procesador o los ciclos.' }
      ]
    }
  ];

  const SYMBOLS = [
    [mi('f'), 'Frecuencia', 'Hz · MHz · GHz', 'todas'],
    [mi('T'), 'Período: duración de un ciclo (T = 1/f)', 'ns', 'a), d)'],
    [S.fCPU, 'Frecuencia del reloj del procesador', 'GHz', 'a)'],
    [S.ciclos, 'Ciclos de captación, decodificación y resolución de direcciones', 'ciclos', 'a)'],
    [S.tcapt, 'Tiempo de captación, decodificación y resolución de direcciones', 'ns', 'a), f)'],
    [S.D, 'Datos a transferir', 'B (bytes)', 'b), d)'],
    [S.c, 'Número de canales (módulos en paralelo)', '—', 'b)'],
    [S.Btr, 'Bytes que se mueven en cada transferencia = 8 B × c', 'B', 'b)'],
    [S.Ntr, 'Número de transferencias = ⌈ D ÷ B_tr ⌉', '—', 'b), d)'],
    [S.vef, 'Velocidad efectiva de la memoria (el número de DDRn-Y)', 'MT/s', 'c), d)'],
    [S.fbus, 'Frecuencia del reloj del bus de memoria = v_ef ÷ 2', 'MHz', 'c)'],
    [S.BWmod, 'Ancho de banda de un módulo (el número de PCn-X) = v_ef × 8 B', 'MB/s', 'c), e)'],
    [S.tmem, 'Tiempo que demora la memoria', 'ns', 'd), f)'],
    [S.ttot, 'Tiempo total de la instrucción', 'ns', 'f)']
  ];

  /* ---------- substituted formulas for a concrete problem ---------- */
  function forPart(p, s) {
    const m = s.mem; const out = {};
    out.a = [M(S.tcapt, EQ, frac(S.ciclos, S.fCPU), EQ, frac(mn(p.cycles), row(mn(p.cpuGHz), unit('GHz'))), EQ, mn(fmt(s.fetchNs)), unit('ns'))];
    out.b = [
      M(S.Btr, EQ, mn(8), unit('B'), TIM, S.c, EQ, mn(8), unit('B'), TIM, mn(p.channels), EQ, mn(s.perTransfer), unit('B')),
      M(S.Ntr, EQ, ceil(frac(S.D, S.Btr)), EQ, ceil(frac(row(mn(p.bytes), unit('B')), row(mn(s.perTransfer), unit('B')))), EQ, s.integer ? ceil(mn(fmt(s.exact))) : ceil(mn(fmt(s.exact))), EQ, mn(s.transfers))
    ];
    out.c = [];
    if (m.prefix === 'PC') out.c.push(M(S.vef, EQ, frac(S.BWmod, row(mn(8), unit('B'))), EQ, frac(row(mn(m.mbps), unit('MB/s')), row(mn(8), unit('B'))), EQ, mn(m.mts), unit('MT/s')));
    else out.c.push(M(S.vef, EQ, mt(m.given), EQ, mn(m.mts), unit('MT/s')));
    out.c.push(M(S.fbus, EQ, frac(S.vef, mn(2)), EQ, frac(row(mn(m.mts), unit('MT/s')), mn(2)), EQ, mn(fmt(s.busMHz)), unit('MHz')));
    out.d = [
      M(S.tmem, EQ, frac(S.Ntr, S.vef), EQ, frac(mn(s.transfers), row(mn(m.mts), unit('MT/s'))), EQ, mn(fmt(s.transfers / m.mts, 6)), unit('µs'), EQ, mn(fmt(s.memNs)), unit('ns')),
      M(mt('Comprobación:'), mt(' '), S.tmem, EQ, frac(S.Ntr, mn(2)), TIM, S.Tbus, EQ, mn(fmt(s.busCycles, 2)), TIM, mn(fmt(s.busPeriodNs, 4)), unit('ns'), EQ, mn(fmt(s.busCycles * s.busPeriodNs)), unit('ns'))
    ];
    out.e = [m.prefix === 'DDR'
      ? M(mt(m.given), BOTH, mt('PC' + m.gen + '-'), mo('('), mn(m.mts), TIM, mn(8), mo(')'), EQ, mt(s.alt))
      : M(mt(m.given), BOTH, mt('DDR' + m.gen + '-'), mo('('), frac(mn(m.mbps), mn(8)), mo(')'), EQ, mt(s.alt))];
    out.f = [M(S.ttot, EQ, S.tcapt, PLUS, S.tmem, EQ, mn(fmt(s.fetchNs)), unit('ns'), PLUS, mn(fmt(s.memNs)), unit('ns'), EQ, mn(fmt(s.totalNs)), unit('ns'))];
    return out;
  }

  /* compact list of the six formulas a)–f) for hint panels */
  function compact() {
    return [
      ['a)', M(S.tcapt, EQ, frac(S.ciclos, S.fCPU))],
      ['b)', M(S.Ntr, EQ, ceil(frac(S.D, row(mn(8), unit('B'), TIM, S.c))))],
      ['c)', M(S.fbus, EQ, frac(S.vef, mn(2)))],
      ['d)', M(S.tmem, EQ, frac(S.Ntr, S.vef))],
      ['e)', M(mt('PCn-X'), BOTH, mt('DDRn-Y'), mo(','), mi('Y'), EQ, frac(mi('X'), mn(8)))],
      ['f)', M(S.ttot, EQ, S.tcapt, PLUS, S.tmem)]
    ];
  }

  const byId = id => { for (const g of SHEET) for (const it of g.items) if (it.id === id) return it; return null; };
  const Fx = { SHEET, SYMBOLS, forPart, compact, byId, M, S };
  if (isNode) module.exports = Fx; else root.Fx = Fx;
})(typeof window !== 'undefined' ? window : globalThis);
