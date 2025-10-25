Dungeon Arcanum — Demo Complejo
---------------------------------
Proyecto de demo HTML5 para un dungeon crawler: tilemap, enemigos, iluminación,
partículas, guardado en localStorage y texturas incluidas.

Archivos:
- index.html -> punto de entrada
- style.css -> estilos
- game.js -> motor del juego (ES module)
- assets/ -> texturas (floor.png, wall.png, hero.png)

Instrucciones para ejecutar localmente:
1. Descomprime la carpeta.
2. Abre index.html en un navegador moderno (Chrome/Edge/Firefox).
   - Si ves problemas con rutas, ejecuta un servidor local:
     * Python 3: `python -m http.server 8000` y abre http://localhost:8000
3. Para publicar en GitHub Pages:
   - Crea un repositorio y sube todos los archivos (incluyendo la carpeta assets).
   - En Settings -> Pages configura la rama main y la carpeta / (root).
   - Espera unos minutos y tu demo estará en https://<usuario>.github.io/<repo>/

Notas:
- Las texturas son pequeñas (32x32) y generadas como PNGs incluídas.
- Este demo está pensado como base para ampliar: añadir audio, animaciones avanzadas,
  IA mejorada, mapas más grandes o soporte multijugador.
