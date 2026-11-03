# Arquitectura de Computadoras — estudio interactivo

Material de estudio para las pruebas parciales de Arquitectura de Computadoras, basado en las baterías anteriores (2023, 2024 y 2024-25).

Cubre:

- **Pregunta 3 — Ensamblador (FASM, sector de arranque 8086):** anatomía del programa, registros y banderas, instrucciones, simulador paso a paso, las 6 pruebas resueltas, ejercicios generados al azar y simulacro completo.
- **Pregunta 2 — Memoria y tiempos (DDR):** hoja de fórmulas, qué es cada dato, decodificador de nombres (`DDR4-3200` ↔ `PC4-25600`), calculadora paso a paso, las 6 pruebas resueltas y ejercicios.
- **Sistemas numéricos y ASCII** como base para trazar.

## Cómo usarlo

No necesita instalación ni servidor: abre `index.html` en el navegador (funciona sin conexión).

## Cómo funciona

Las respuestas de los ejercicios no están escritas a mano: salen de ejecutar el programa en un emulador propio (`emu.js`, subconjunto de FASM / 8086 en modo real) o de aplicar las fórmulas (`ddr.js`). Ambos se validan contra los resultados calculados a mano de las 6 pruebas.

| Archivo | Contenido |
| --- | --- |
| `emu.js` | Ensamblador + emulador 8086 (banderas, saltos, `loop`, `db/dw/dup/times`, `@@/@f/@b`) |
| `programs.js` | Los 6 programas de la pregunta 3 con sus líneas subrayadas y variantes del apartado d) |
| `ddr.js` | Motor de la pregunta 2 (fórmulas, pasos, generador) |
| `content.js`, `exercises.js` | Contenido didáctico y generadores de ejercicios |
| `ui.js`, `app.js`, `style.css`, `index.html` | Interfaz |

## Pruebas

```sh
node test/emu.test.js
node test/ddr.test.js
node test/exercises.test.js
```

## Supuestos a contrastar con los apuntes

- «Frecuencia del bus» se calcula como el reloj del bus (MT/s ÷ 2). El tiempo de memoria no depende de cómo se nombre.
- Si `bytes ÷ (8 × canales)` no es entero (Batería B 2024), se redondea hacia arriba.
- El enunciado de d) de la Batería B 2024-25 menciona `jz` pero su código usa `ja`; se resuelven ambas lecturas.
