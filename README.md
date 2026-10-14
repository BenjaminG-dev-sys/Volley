# Gestión de Torneos de Voleibol

Demo full stack para ligas y asociaciones de voleibol en Ecuador: torneos, calendario, tabla de posiciones FIVB
y **planilla electrónica** para la mesa de control, con marcador público en tiempo real.

**Demo en la nube:** https://my4nm2i7.insforge.site

| Usuario | Contraseña | Rol | Qué puede hacer |
|---|---|---|---|
| `admin@demo.ec` | `Voley2026!` | Administrador | Todo, incluido asignar roles |
| `organizador@demo.ec` | `Voley2026!` | Organizador | Torneos, equipos, nóminas, calendario, asignaciones |
| `planillero@demo.ec` | `Voley2026!` | Planillero | Llevar la planilla de los partidos asignados |
| `arbitro@demo.ec` | `Voley2026!` | Árbitro | Ver el sitio con sesión iniciada (rol reservado; aún sin permisos propios) |
| `publico@demo.ec` | `Voley2026!` | Público (con cuenta) | Lo mismo que sin cuenta |
| _(sin cuenta)_ | | Público | Portada, torneos, posiciones, marcador en vivo, planilla final |

## Guion de demostración (≈5 min)

1. **Portada** (`/`): partido en vivo, torneos, próximos partidos y resultados.
2. **Torneo** → tablas de los grupos A y B (puntos FIVB 3/2/1, cocientes de sets y puntos), calendario por jornada.
3. Abre el **marcador en vivo** del partido en juego en una pantalla grande (sin sesión).
4. En otra pestaña o tablet, ingresa como `planillero@demo.ec` → **Mesa** → *Continuar planilla*.
   Anota puntos, pide un tiempo, toca un jugador para sustituirlo o hacer entrar al líbero, y usa **Deshacer**.
   El marcador público cambia al instante, sin recargar.
5. Termina el set: el sistema aplica el cambio de cancha, alterna el saque y pide las formaciones del siguiente set.
6. Al terminar el partido: firmas → **Planilla final** imprimible (Imprimir / PDF).
7. Como `organizador@demo.ec` → **Admin**: inscripción de equipos, generador de calendario, asignación de
   planillero y árbitros, nóminas con validación de cédula y edad por categoría.

## Arquitectura

- **Next.js 15** (App Router, Server Components y Server Actions) + Tailwind CSS. UI en español, hora `America/Guayaquil`.
- **InsForge** (proyecto `Volei`): Postgres + PostgREST, Auth (cookies SSR), Realtime y hosting.
- **Planilla basada en eventos**: cada acción de la mesa es una fila inmutable en `match_events` (`seq` único por partido).
  El estado se deriva con un motor de reglas puro (`replay(setup, events)`): deshacer, auditoría y reconstrucción
  tras una desconexión salen gratis. `matches.live_state` guarda un snapshot pequeño para los listados.
- **Realtime**: triggers en `matches` y `match_events` publican en `match:{id}` y `live`; los clientes no pueden
  publicar (RLS en `realtime.messages`).
- **App instalable (PWA)**: manifiesto, íconos y service worker (`public/sw.js`). Las páginas visitadas (mesa,
  torneos, partidos, equipos) abren sin red; el resto redirige a `/offline`. Al cerrar sesión se borran las páginas
  guardadas.
- **Estadísticas**: calculadas con el motor a partir de la planilla (`src/lib/stats/`): puntos en saque y en
  recepción (o cambios de saque en ecuavóley), rachas, mejor sacador, evolución del marcador por set, participación
  de cada jugador y destacados del torneo.
- **Offline**: la mesa guarda cada evento primero en IndexedDB y lo sincroniza en orden al volver la conexión
  (los reintentos no duplican gracias a `UNIQUE (match_id, seq)`). Si otro dispositivo ocupó la misma secuencia, la mesa
  lo detecta, adopta la planilla del servidor y ofrece reaplicar o descartar sus acciones; la consola y el marcador
  público escuchan `match:{id}` y releen la planilla al reconectarse.
- **Seguridad (RLS)**: lectura pública de información deportiva; escritura solo para staff; la planilla solo la
  escribe el planillero asignado; la cédula y la fecha de nacimiento solo las ve el staff (el público lee la vista
  `players_public`). El servidor valida el resultado que publica la mesa (marcadores posibles, sets ganados), deriva el
  ganador y solo acepta cerrar el partido si la planilla tiene el evento `close`.

### Dos modos de juego: Vóley y Ecuavóley

Cada torneo elige su deporte y reglamento (`tournaments.sport` y `tournaments.rules`); el motor aplica un `RuleSet`
(`src/lib/scoresheet/rules.ts`) y la mesa, la cancha, el marcador y la planilla se adaptan solos.

| | Vóley (FIVB) | Ecuavóley (por defecto) |
|---|---|---|
| Jugadores | 6, rotación, hasta 2 líberos | 3 con roles fijos (servidor, colocador, volador), sin líbero ni rotación |
| Sets | Al mejor de 5 (o 3), a 25; decisivo a 15 | Al mejor de 3, a 15 (variantes a 12 o 10) |
| Puntuación | Rally point | Con cambio: solo suma quien saca; si gana el receptor, recupera el saque (variante punto directo) |
| Tiempos / sustituciones | 2 por set / 6 (titular ↔ suplente) | 2 por set solo con el saque / 6 libres |
| Cambio de cancha | Decisivo a los 8 | 3.er set a los 8 (a los 6 si es a 12) |
| Nómina | 14 jugadores, 2 líberos | 7 jugadores (3 + 4 suplentes) |

El ecuavóley no tiene un reglamento oficial único; los valores por defecto siguen los reglamentos de torneos más
citados y se pueden ajustar por torneo.

### Reglas FIVB implementadas (`src/lib/scoresheet/`)

Sets a 25 (5.º a 15) con diferencia de 2 · mejor de 5 o de 3 · rally point y rotación horaria al recuperar el saque ·
primer saque alternado y sorteo para el set decisivo · cambio de cancha a los 8 en el set decisivo · 2 tiempos por set ·
6 sustituciones por set (titular ↔ suplente, una vuelta por set) · hasta 2 líberos: solo zagueros, no saca, sale al
rotar a delantera, un rally entre reemplazos · amonestación, castigo (punto y saque al rival), expulsión,
descalificación y escalamiento por retraso · cierre con firmas.

## Panel de administración

`/admin` (organizadores y administradores):

- **Panel**: partidos de hoy, en vivo, sin planillero o árbitro, nóminas incompletas, conflictos de horario y
  torneos en borrador, con accesos directos. **Buscador global** (⌘K / Ctrl+K) de torneos, equipos, jugadores
  (también por cédula), árbitros y sedes.
- **Torneos**: asistente en 5 pasos (datos → equipos → formato → calendario → confirmar); por torneo, pestañas de
  ajustes (reglamento, sistema de puntos 3·2·1·0 / 2·1 / 3·0, color, portada), inscripción, calendario visual con
  arrastrar y soltar y detección de conflictos de equipo o sede, partidos (planillero, árbitros por jornada,
  agregar, eliminar, **reabrir** un partido cerrado para corregirlo), eliminatorias para 1 a 4 grupos y exportación
  (CSV de posiciones, calendario y nóminas; planillas de una jornada para imprimir).
- **Equipos y nóminas**: ficha editable, logo y portada, edición y transferencia de jugadores, foto, importación de
  nóminas por CSV con validación por fila (plantilla descargable) y exportación.
- **Árbitros, sedes, organizaciones**, **usuarios** (roles e invitaciones por correo: el rol se aplica al crear la
  cuenta) y **auditoría** (quién cambió qué y cuándo; cierres y reaperturas de planillas).
- Inscripción y generación del calendario son **atómicas** (funciones SQL `set_entries` y `replace_schedule`).

Las imágenes se suben al bucket público `media` de InsForge Storage (se guardan `url` y `key`). Crearlo una vez:
`npx -y @insforge/cli storage create-bucket media --public`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con los valores del proyecto InsForge
npm run dev                  # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas del motor de reglas, calendario, posiciones y cédula (Vitest) |
| `npm run lint` / `npm run build` | Lint y compilación de producción |
| `npm run seed` | Reemplaza los datos demo: torneo de vóley (8 clubes de parroquias rurales de Quito, 96 jugadoras) e interparroquial de ecuavóley (6 parroquias), con partidos simulados con el motor |
| `npm run seed:users` | Crea/actualiza los usuarios demo y asigna al planillero los partidos pendientes |
| `npm run test:e2e` | Playwright: flujo de mesa + marcador en vivo y panel de admin (`BASE_URL` para apuntar a la nube). Modifica datos: luego `npm run seed && npm run seed:users` |

Base de datos: migraciones en `migrations/` (`npx -y @insforge/cli db migrations up --all`).
Despliegue: `npx -y @insforge/cli deployments deploy .` (variables `NEXT_PUBLIC_INSFORGE_*` ya configuradas en InsForge).

> Para la demo se desactivó la verificación de correo en InsForge (`insforge.toml` → `require_email_verification = false`)
> porque las cuentas `@demo.ec` no reciben correo. Antes de producción conviene volver a activarla y aplicar con
> `npx -y @insforge/cli config apply`.

## Fuera del alcance de esta demo

Ecuavóley, vóley playa, estadísticas por jugadora, pagos de inscripción, protestas y sustituciones excepcionales,
firmas con validez legal y app móvil nativa.
