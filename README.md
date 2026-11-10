# NEON//REVENANT

> Arena shooter en tercera persona por oleadas, construido con Electron y Three.js.

![Los 12 sectores del juego](docs/screenshot-worlds.png)

## Que es

NEON//REVENANT es un juego de accion 3D en tercera persona: eliges un operador,
sobrevives a oleadas de hostiles y vas construyendo tu build con armas,
habilidades, evoluciones y reliquias. Todo el contenido se genera en codigo:
modelos, escenarios, effects y HUD, sin assets externos pesados.

![Gameplay](docs/screenshot-gameplay.png)

## Contenido

- **10 operadores** con modelo 3D, perk propio y arbol de habilidades.
- **20 armas** con elementos (burn, chain, slow, ricochet) y **33 evoluciones**.
- **33 habilidades**, 16 reliquias, 8 cuerpo a cuerpo, 8 utilidades y 8 objetivos.
- **6 facciones** y **18 jefes** con fases y mecanicas propias.
- **12 sectores** con bioma, cielo, utileria y paleta diferenciados.
- 20 logros, 14 modificadores, 6 dificultades, sistema de tienda y records.
- Calidad grafica adaptativa, bloom, sombras y musica sintetizada en tiempo real.

## Requisitos

- **Node.js 20 o superior** (desarrollado y probado con Node 22) y npm.
- Electron se instala como dependencia de desarrollo con `npm install`.
- Windows, macOS o Linux con entorno grafico.

## Instalacion y ejecucion

```bash
git clone https://github.com/kegonzalezs/neon-revenant.git
cd neon-revenant
npm install
npm start
```

`npm start` lanza Electron apuntando a la raiz del proyecto. Tambien se puede
abrir `preview.html` en un navegador para ver las tarjetas de los sectores.

## Scripts

| Comando | Que hace |
| --- | --- |
| `npm start` | Inicia el juego |
| `npm run dev` | Inicia el juego con logging habilitado |
| `npm run check` | Comprueba la sintaxis de los modulos principales |
| `npm run dist` | Genera el instalador con electron-builder |
| `node scripts/start.cjs --smoke-test` | Pasada automatica de verificacion (requiere pantalla) |

## Estructura

```
index.html        Interfaz, menus y HUD
main.cjs          Proceso principal de Electron
preload.cjs       Puente de precarga
src/game.js       Bucle de juego, combate y render
src/operators.js  Operadores y armas
src/enemies.js    Hostiles y modelos
src/bosses.js     Jefes
src/worlds.js     Sectores y generacion de niveles
src/voxel.js      Motor de terreno y cielo
src/content.js    Tablas de contenido y reglas
src/style.css     Estilos y HUD
scripts/          Utilidades de prueba, captura y diagnostico
art/              Tarjetas de los 12 sectores
docs/             Capturas que usa este README
```

## Notas

- El repositorio **no incluye** `node_modules/`, builds ni las capturas de las
  pruebas; todo eso se regenera en local.
- El lanzador `JUGAR.cmd` usado durante el desarrollo apunta a una instalacion
  local de Node y por eso no se versiona. En su lugar, usa `npm start`.
- Proyecto personal en desarrollo activo: puede haber cambios importantes entre
  versiones.

## Licencia

Pendiente de definir. Hasta que se indique lo contrario, todos los derechos
reservados.
