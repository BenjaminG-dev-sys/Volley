// Línea de tiempo del video, compartida por las escenas y por el generador de música
// (scripts/music.mts). Todo va a 120 BPM a 30 fps: 1 tiempo = 15 frames, 1 compás = 60 frames.
// Cada escena dura 60·k + 15 frames y la transición dura 15, así cada corte cae en un compás.

export const FPS = 30;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 frames
export const BAR = BEAT * 4; // 60 frames
export const TRANSITION = BEAT;

export const SCENES = {
  intro: 135,
  rules: 195,
  scorer: 195,
  live: 195,
  stats: 195,
  tournaments: 195,
  admin: 195,
  profiles: 195,
  contact: 255,
};
export type SceneKey = keyof typeof SCENES;

export const PROMO_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0) - TRANSITION * (Object.keys(SCENES).length - 1);

/** Frame absoluto en el que empieza cada escena (inicio de su transición de entrada). */
export const SCENE_START: Record<SceneKey, number> = (() => {
  let t = 0;
  const out = {} as Record<SceneKey, number>;
  for (const [k, d] of Object.entries(SCENES) as [SceneKey, number][]) {
    out[k] = t;
    t += d - TRANSITION;
  }
  return out;
})();

// Momentos clave dentro de cada escena (frames locales), todos sobre el pulso.
export const INTRO = { title: 30, tagline: 45, strip: 75 };
export const RULES_SERVE = { from: 60, to: 105 };
export const MESA = { offlineFrom: 65, syncAt: 165 };
export const TORNEO_STEPS = { from: 30, to: 90 }; // un paso cada 15 frames
export const ADMIN = { typeFrom: 30, typeTo: 60, moveStart: 90, moveEnd: 120 };
export const LIGAS = { sheet: 75, tap: 120 };
export const STATS = { drawFrom: 60, drawTo: 150 };
