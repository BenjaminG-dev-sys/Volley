# Video de presentación — Ligas Rurales Quito (ecuavóley)

Video promocional en motion graphics (1920×1080, 30 fps, 54,5 s, con música) hecho con [Remotion](https://www.remotion.dev).
Todo es de ecuavóley y usa la identidad de voley.integroecuador.com: paleta azul marino, dorado, rojo, naranja y
lavanda, la franja de marca, el fondo "esfera" y el logo de la Asociación de Ligas Rurales del Cantón Quito.

Los equipos, resultados, posiciones, nóminas y la planilla salen de la demo real (16 ligas parroquiales,
Interparroquial de Ecuavóley 2026) y están en `src/data.ts`; las escenas solo leen de ahí. Los marcadores de la
mesa y del marcador en vivo se calculan con la regla del cambio de saque (`applySideout`): solo suma quien saca.

La música es original y está sintetizada por código (`scripts/music.ts`, sin licencias de terceros). Va a 120 BPM en
La menor y lee `src/timeline.ts` y `src/data.ts`, así que cada corte de escena cae en un compás con su golpe, y cada
punto, cambio de saque, set ganado, tecleo, arrastre y botón tiene su sonido en su frame exacto. Si cambias tiempos
o jugadas, vuelve a generarla con `npm run music` (crea `public/music.mp3`).

Escenas, en orden:

1. Intro
2. Así se juega el ecuavóley
3. Mesa digital
4. Marcador en vivo
5. Planilla y estadísticas
6. Torneo (Grupo A)
7. Admin
8. Ligas y app
9. Contacto

```console
cd video
npm i
npm run dev                                          # Remotion Studio para previsualizar y editar
npx remotion render Promo out/ligas-rurales-ecuavoley.mp4   # exportar el MP4
```

- El teléfono, el correo y la web de contacto son props de la composición `Promo`, editables desde el panel de Studio.
- Para cambiar los valores por defecto, edita `defaultContact` en `src/scenes/Contact.tsx`.
- Cada escena también está registrada por separado en la carpeta "Escenas", para previsualizarla sola.
- Las fuentes están en `public/fonts` (licencia OFL), así el render no depende de la red.

Remotion es gratis para equipos de hasta 3 personas; empresas más grandes necesitan licencia
(https://www.remotion.pro/license).
