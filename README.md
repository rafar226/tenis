# Neón Pong

Juego web táctil de tenis de mesa para tablet. Funciona sin instalar dependencias y también sin conexión después de la primera visita.

## Probarlo localmente

Desde esta carpeta ejecutá un servidor estático, por ejemplo:

```powershell
python -m http.server 8080
```

Abrí `http://localhost:8080`. Para jugar, deslizá el dedo verticalmente en tu mitad de la pantalla.

## Publicar en GitHub Pages

1. Subí el contenido a un repositorio de GitHub usando la rama `main`.
2. En el repositorio abrí **Settings → Pages**.
3. En **Source**, elegí **GitHub Actions**.
4. Cada push a `main` publicará automáticamente el juego.

En la tablet se puede agregar a la pantalla de inicio desde el menú del navegador para abrirlo como una app a pantalla completa.
