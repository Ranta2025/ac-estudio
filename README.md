# Arquitectura de Computadoras — estudio interactivo

Material de estudio para las pruebas parciales de Arquitectura de Computadoras, basado en las baterías anteriores (2023, 2024 y 2024-25).

Está organizado en dos bloques, cada uno con su teoría, práctica y ejercicios:

- **Pregunta 2 — Memoria y tiempos (DDR):** conceptos y hoja de fórmulas, calculadora paso a paso con las 6 pruebas resueltas, y ejercicios (pregunta completa, un apartado, conversiones, problemas inversos, comparar configuraciones y teoría).
- **Pregunta 3 — Ensamblador (FASM, sector de arranque 8086):** números y ASCII, anatomía del programa, registros y banderas, instrucciones, simulador paso a paso, las 6 pruebas resueltas, ejercicios y simulacro completo.

Los ejercicios de la pregunta 3 se centran en lo que piden las pruebas: **traceo de código** (por instrucción, por vueltas, estado a mitad del ciclo, conteo de saltos), **completar el código** (varios huecos, corregido ejecutando tu versión) y los apartados a) b) c) d). Además hay práctica extra: verdadero/falso, banderas y registros, direcciones y tamaños. Todos admiten **series** de 10, 20 o 30 ejercicios con marcador final.

## Cómo usarlo

No necesita instalación ni servidor: abre `index.html` en el navegador (funciona sin conexión).

## Cómo funciona

Las respuestas de los ejercicios no están escritas a mano: salen de ejecutar el programa en un emulador propio (`emu.js`, subconjunto de FASM / 8086 en modo real) o de aplicar las fórmulas (`ddr.js`). Ambos se validan contra los resultados calculados a mano de las 6 pruebas.

| Archivo | Contenido |
| --- | --- |
| `emu.js` | Ensamblador + emulador 8086 (banderas, saltos, `loop`, `db/dw/dup/times`, `@@/@f/@b`) |
| `programs.js` | Los 6 programas de la pregunta 3 con sus líneas subrayadas y variantes del apartado d) |
| `ddr.js` | Motor de la pregunta 2 (cálculo, explicaciones, generadores) |
| `formulas.js` | Fórmulas de la pregunta 2 en notación matemática real (MathML): hoja de fórmulas, símbolos y unidades, y el desarrollo con los valores sustituidos |
| `content.js` | Contenido didáctico, banco de preguntas y de verdadero/falso |
| `exercises.js`, `exercises2.js` | Generadores de ejercicios de la pregunta 3 (filtros, traceo, completado, banderas, direcciones) |
| `ui.js`, `app.js`, `style.css`, `index.html` | Interfaz |

## Pruebas

```sh
node test/emu.test.js
node test/ddr.test.js
node test/formulas.test.js
node test/exercises.test.js
node test/exercises2.test.js
```

## Supuestos a contrastar con los apuntes

- «Frecuencia del bus» se calcula como el reloj del bus (MT/s ÷ 2). El tiempo de memoria no depende de cómo se nombre.
- Si `bytes ÷ (8 × canales)` no es entero (Batería B 2024), se redondea hacia arriba.
- El enunciado de d) de la Batería B 2024-25 menciona `jz` pero su código usa `ja`; se resuelven ambas lecturas.
