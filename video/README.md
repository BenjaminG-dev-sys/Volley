# Video de presentación — Voley EC

Video promocional en motion graphics (1920×1080, 30 fps, ≈46 s) hecho con [Remotion](https://www.remotion.dev).
Usa la misma identidad visual de la app: base monocromo, colores de campaña, Barlow Condensed e Inter.

Escenas, en orden:

1. Intro
2. Dos modos (vóley y ecuavóley)
3. Mesa digital
4. Marcador en vivo
5. Estadísticas
6. Torneos
7. Admin
8. Perfiles y app
9. Contacto

```console
cd video
npm i
npm run dev                                          # Remotion Studio para previsualizar y editar
npx remotion render Promo out/voley-ec-promo.mp4     # exportar el MP4
```

- El teléfono y el correo de contacto son props de la composición `Promo`, editables desde el panel de Studio.
- Para cambiar los valores por defecto, edita `defaultContact` en `src/scenes/Contact.tsx`.
- Cada escena también está registrada por separado en la carpeta "Escenas", para previsualizarla sola.
- Las fuentes están en `public/fonts` (licencia OFL), así el render no depende de la red.

Remotion es gratis para equipos de hasta 3 personas; empresas más grandes necesitan licencia
(https://www.remotion.pro/license).
