// Genera la música del video (original, sintetizada): `npm run music`.
// Lee la línea de tiempo (src/timeline.ts) y las jugadas (src/data.ts) para que cada corte de escena,
// cada punto, cada cambio de saque y cada momento clave tenga su golpe exactamente en su frame.
// 120 BPM, La menor (Am – F – C – G). Salida: out/music.wav (luego se pasa a public/music.mp3).

import { mkdirSync, writeFileSync } from "node:fs";
import { LIVE_PLAYS, LIVE_START, MESA_PLAYS, MESA_START, applySideout } from "../src/data";
import { ADMIN, BAR, BEAT, FPS, LIGAS, PROMO_DURATION, RULES_SERVE, SCENE_START, SCENES, TORNEO_STEPS, TRANSITION, type SceneKey } from "../src/timeline";

const SR = 48000;
const TOTAL = PROMO_DURATION / FPS;
const N = Math.ceil(TOTAL * SR);
const sec = (frame: number) => frame / FPS;

// Buses: batería, música (con sidechain del bombo) y efectos.
const drumsL = new Float32Array(N), drumsR = new Float32Array(N);
const musL = new Float32Array(N), musR = new Float32Array(N);
const sfxL = new Float32Array(N), sfxR = new Float32Array(N);
const duck = new Float32Array(N).fill(1);

let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

function put(bl: Float32Array, br: Float32Array, i: number, v: number, pan = 0) {
  if (i < 0 || i >= N) return;
  bl[i] += v * Math.min(1, 1 - pan);
  br[i] += v * Math.min(1, 1 + pan);
}

// ---------- Instrumentos ----------
function kick(t0: number, gain = 1) {
  const s0 = Math.round(t0 * SR);
  let ph = 0;
  for (let n = 0; n < 0.4 * SR; n++) {
    const t = n / SR;
    const f = 45 + 95 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 8) + (n < 120 ? noise() * 0.3 * (1 - n / 120) : 0);
    put(drumsL, drumsR, s0 + n, v * gain);
  }
  // Sidechain: la música "respira" con el bombo.
  for (let n = 0; n < 0.3 * SR; n++) {
    const i = s0 + n;
    if (i < N) duck[i] = Math.min(duck[i], 1 - 0.65 * Math.exp(-(n / SR) * 11));
  }
}

function snare(t0: number, gain = 1) {
  const s0 = Math.round(t0 * SR);
  let prev = 0;
  for (let n = 0; n < 0.28 * SR; n++) {
    const t = n / SR;
    const x = noise();
    const hp = x - prev;
    prev = x;
    const v = hp * 0.55 * Math.exp(-t * 16) + Math.sin(2 * Math.PI * 185 * t) * 0.5 * Math.exp(-t * 28);
    put(drumsL, drumsR, s0 + n, v * gain * 0.75, -0.05);
  }
}

function hat(t0: number, open = false, pan = 0.25, gain = 1) {
  const s0 = Math.round(t0 * SR);
  let p1 = 0, p2 = 0;
  const len = open ? 0.25 : 0.06;
  for (let n = 0; n < len * SR; n++) {
    const t = n / SR;
    const x = noise();
    const h1 = x - p1;
    p1 = x;
    const h2 = h1 - p2;
    p2 = h1;
    put(drumsL, drumsR, s0 + n, h2 * 0.16 * gain * Math.exp(-t * (open ? 14 : 70)), pan);
  }
}

function saw(f: number, t: number, harmonics: number, tilt = 1) {
  let v = 0;
  for (let k = 1; k <= harmonics; k++) {
    if (f * k > SR / 2.2) break;
    v += Math.sin(2 * Math.PI * f * k * t) / k ** tilt;
  }
  return v;
}

function bass(t0: number, dur: number, f: number, gain = 1) {
  const s0 = Math.round(t0 * SR);
  for (let n = 0; n < (dur + 0.05) * SR; n++) {
    const t = n / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 5) * (t > dur ? Math.exp(-(t - dur) * 60) : 1);
    const v = (saw(f, t, 6, 1.3) * 0.35 + Math.sin(2 * Math.PI * f * t) * 0.6) * env;
    put(musL, musR, s0 + n, v * gain * 0.55);
  }
}

function pad(t0: number, dur: number, freqs: number[], gain = 1, attack = 0.25) {
  const s0 = Math.round(t0 * SR);
  for (let n = 0; n < (dur + 0.5) * SR; n++) {
    const t = n / SR;
    const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) * 6) : 1);
    let l = 0, r = 0;
    for (const f of freqs) {
      l += saw(f * 0.997, t, 7, 1.6);
      r += saw(f * 1.003, t, 7, 1.6);
    }
    put(musL, musR, s0 + n, (l / freqs.length) * env * gain * 0.22, -0.4);
    put(musL, musR, s0 + n, (r / freqs.length) * env * gain * 0.22, 0.4);
  }
}

function pluck(t0: number, f: number, gain = 1, pan = 0) {
  const s0 = Math.round(t0 * SR);
  for (let n = 0; n < 0.22 * SR; n++) {
    const t = n / SR;
    let v = 0;
    for (const k of [1, 3, 5, 7]) v += Math.sin(2 * Math.PI * f * k * t) / k;
    put(musL, musR, s0 + n, v * Math.exp(-t * 14) * Math.min(1, t / 0.002) * gain * 0.16, pan);
  }
}

function riser(t0: number, t1: number, gain = 1) {
  const s0 = Math.round(t0 * SR);
  const len = Math.round((t1 - t0) * SR);
  let lp = 0, ph = 0;
  for (let n = 0; n < len; n++) {
    const x = n / len;
    const a = 0.02 + 0.5 * x * x;
    lp += a * (noise() - lp);
    ph += (2 * Math.PI * (300 + 1500 * x * x)) / SR;
    const v = (lp * 0.6 + Math.sin(ph) * 0.12) * x * x;
    put(sfxL, sfxR, s0 + n, v * gain * 0.9, Math.sin(x * 9) * 0.3);
  }
}

function impact(t0: number, gain = 1) {
  kick(t0, 1.1 * gain);
  const s0 = Math.round(t0 * SR);
  let prev = 0;
  for (let n = 0; n < 2.2 * SR; n++) {
    const t = n / SR;
    const x = noise();
    const hp = x - prev;
    prev = x;
    const v = hp * 0.22 * Math.exp(-t * 2.6) + Math.sin(2 * Math.PI * 38 * t) * 0.45 * Math.exp(-t * 3.5);
    put(sfxL, sfxR, s0 + n, v * gain, (n % 2 ? 0.3 : -0.3) * 0.5);
  }
}

function whoosh(t0: number, dur: number, gain = 1, dir = 1) {
  const s0 = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  let lp = 0;
  for (let n = 0; n < len; n++) {
    const x = n / len;
    lp += (0.05 + 0.25 * Math.sin(Math.PI * x)) * (noise() - lp);
    put(sfxL, sfxR, s0 + n, lp * Math.sin(Math.PI * x) ** 2 * gain * 0.9, dir * (x * 2 - 1) * 0.8);
  }
}

function tone(t0: number, f: number, dur: number, gain = 1, decay = 20, drop = 0, pan = 0) {
  const s0 = Math.round(t0 * SR);
  let ph = 0;
  for (let n = 0; n < dur * SR; n++) {
    const t = n / SR;
    ph += (2 * Math.PI * f * (1 + drop * Math.exp(-t * 40))) / SR;
    put(sfxL, sfxR, s0 + n, Math.sin(ph) * Math.exp(-t * decay) * Math.min(1, t / 0.002) * gain, pan);
  }
}

const tock = (t0: number, gain = 1) => {
  tone(t0, 900, 0.08, 0.35 * gain, 45, 0.6);
  hat(t0, false, 0, 1.5 * gain);
};
const pointPop = (t0: number) => {
  tock(t0);
  tone(t0, midi(81), 0.25, 0.28, 12);
  tone(t0 + 0.06, midi(88), 0.3, 0.22, 10);
};
const sideoutSwap = (t0: number) => {
  tock(t0, 0.8);
  tone(t0, midi(76), 0.16, 0.24, 18, 0, -0.3);
  tone(t0 + 0.11, midi(71), 0.22, 0.24, 14, 0, 0.3);
};
const ding = (t0: number, gain = 1) => {
  tone(t0, midi(88), 1.2, 0.22 * gain, 4);
  tone(t0, midi(95), 1.0, 0.12 * gain, 5);
};
const click = (t0: number) => {
  const s0 = Math.round(t0 * SR);
  for (let n = 0; n < 0.006 * SR; n++) put(sfxL, sfxR, s0 + n, noise() * 0.18 * (1 - n / (0.006 * SR)), 0.2);
};

// ---------- Armonía ----------
const CHORDS = [
  { root: midi(33), notes: [57, 60, 64] }, // Am
  { root: midi(29), notes: [53, 57, 60] }, // F
  { root: midi(36), notes: [60, 64, 67] }, // C
  { root: midi(31), notes: [55, 59, 62] }, // G
].map((c) => ({ root: c.root, notes: c.notes.map(midi) }));

const beatSec = BEAT / FPS;
const barSec = BAR / FPS;
const bars = Math.ceil(PROMO_DURATION / BAR);
const startOf = (k: SceneKey) => SCENE_START[k];
const sceneAt = (frame: number) => {
  let cur: SceneKey = "intro";
  for (const k of Object.keys(SCENES) as SceneKey[]) if (frame >= SCENE_START[k]) cur = k;
  return cur;
};

const FINAL = startOf("contact") + 3 * BAR; // golpe final: el contacto queda sonando
const DROP = startOf("rules");

for (let b = 0; b < bars; b++) {
  const f0 = b * BAR;
  const t0 = sec(f0);
  const chord = CHORDS[b % 4];
  const scene = sceneAt(f0);
  if (f0 >= FINAL) break;

  if (f0 < DROP) {
    // Intro: colchón y bajo largo, sin batería; hats que crecen en el segundo compás.
    pad(t0, barSec, chord.notes, 0.9, 0.6);
    if (b === 1) {
      bass(t0, barSec, chord.root, 0.7);
      for (let i = 0; i < 8; i++) hat(t0 + i * beatSec * 0.5, false, i % 2 ? 0.3 : -0.3, 0.4 + i * 0.08);
    }
    continue;
  }

  const lead = scene === "live" || scene === "tournaments" || scene === "admin" || scene === "profiles";
  const light = scene === "stats";
  pad(t0, barSec, chord.notes, light ? 0.7 : 1);
  for (let q = 0; q < 4; q++) {
    const tq = t0 + q * beatSec;
    kick(tq, q === 0 ? 1 : 0.9);
    if (!light && (q === 1 || q === 3)) snare(tq);
    if (light && q === 3) snare(tq, 0.6);
    hat(tq + beatSec / 2, scene === "profiles" && q === 3, 0.25);
    if (!light) hat(tq + beatSec * 0.75, false, -0.25, 0.5);
    // Bajo en corcheas, alternando octava.
    bass(tq, beatSec * 0.45, chord.root * (q % 2 ? 2 : 1), 0.9);
    bass(tq + beatSec / 2, beatSec * 0.4, chord.root * 2, 0.6);
  }
  if (lead) {
    const arp = [...chord.notes, chord.notes[1] * 2].map((f) => f * 2);
    for (let i = 0; i < 8; i++) pluck(t0 + i * beatSec * 0.5, arp[(i * 3) % arp.length], scene === "live" ? 1.1 : 0.85, i % 2 ? 0.35 : -0.35);
  }
}

// ---------- Cortes: whoosh en la transición, subida antes y golpe al entrar cada escena ----------
for (const k of Object.keys(SCENES) as SceneKey[]) {
  const f = SCENE_START[k];
  if (f === 0) continue;
  riser(sec(f - (k === "rules" ? 45 : BEAT * 2)), sec(f), k === "rules" ? 1.2 : 0.6);
  impact(sec(f), k === "rules" ? 1 : 0.55);
  whoosh(sec(f), sec(TRANSITION) + 0.1, 0.7, k === "profiles" ? -1 : 1);
}

// ---------- Momentos de cada escena ----------
// Intro: aparición del logo y del título.
impact(0, 0.5);
ding(0, 0.6);
impact(sec(30), 0.45);
tone(sec(45), midi(76), 0.4, 0.15, 6);
// Reglamento: saque y caída del balón.
tock(sec(startOf("rules") + RULES_SERVE.from), 1.2);
tock(sec(startOf("rules") + RULES_SERVE.to), 0.7);
// Mesa y marcador: cada jugada suena según su resultado (punto o cambio de saque).
const plays = (scene: SceneKey, start: Parameters<typeof applySideout>[0], list: { f: number; w: "H" | "A" }[]) => {
  const states = applySideout(start, list.map((p) => p.w));
  list.forEach((p, i) => {
    const t = sec(startOf(scene) + p.f);
    if (states[i].last?.scored) pointPop(t);
    else sideoutSwap(t);
  });
  return states;
};
plays("scorer", MESA_START, MESA_PLAYS);
const live = plays("live", LIVE_START, LIVE_PLAYS);
if (live[live.length - 1].h >= 15) {
  const t = sec(startOf("live") + LIVE_PLAYS[LIVE_PLAYS.length - 1].f);
  impact(t, 0.8);
  pad(t, 0.6, CHORDS[0].notes.map((f) => f * 2), 1.4, 0.01);
  ding(t + 0.05);
}
// Torneo: cada paso del asistente sube una nota.
[69, 72, 76, 81].forEach((m, i) => tone(sec(startOf("tournaments") + TORNEO_STEPS.from + i * BEAT), midi(m), 0.3, 0.2, 10));
// Admin: tecleo del buscador, arrastre y partido soltado sin conflicto.
for (let i = 0; i < 10; i++) click(sec(startOf("admin") + ADMIN.typeFrom + (i * (ADMIN.typeTo - ADMIN.typeFrom)) / 10));
whoosh(sec(startOf("admin") + ADMIN.moveStart), sec(ADMIN.moveEnd - ADMIN.moveStart), 0.6);
tock(sec(startOf("admin") + ADMIN.moveEnd), 1.2);
ding(sec(startOf("admin") + ADMIN.moveEnd) + 0.04);
// Ligas y app: sube la ventana de instalación y se toca "Instalar".
whoosh(sec(startOf("profiles") + LIGAS.sheet), 0.4, 0.5, -1);
tock(sec(startOf("profiles") + LIGAS.tap));
ding(sec(startOf("profiles") + LIGAS.tap) + 0.04, 0.8);
// Contacto: cada dato entra con una nota y el golpe final deja sonar el acorde.
[45, 60, 75].forEach((d, i) => tone(sec(startOf("contact") + d), midi([69, 72, 76][i]), 0.35, 0.18, 9));
impact(sec(FINAL), 1.1);
pad(sec(FINAL), TOTAL - sec(FINAL) - 0.4, [...CHORDS[0].notes, CHORDS[0].notes[0] * 2], 1.3, 0.01);
bass(sec(FINAL), TOTAL - sec(FINAL) - 0.4, CHORDS[0].root, 1);
ding(sec(FINAL) + 0.05, 1.2);

// ---------- Mezcla ----------
const outL = new Float32Array(N), outR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const fadeOut = Math.min(1, (N - i) / (0.6 * SR));
  const l = (drumsL[i] * 0.8 + musL[i] * 0.55 * duck[i] + sfxL[i] * 0.7) * fadeOut;
  const r = (drumsR[i] * 0.8 + musR[i] * 0.55 * duck[i] + sfxR[i] * 0.7) * fadeOut;
  outL[i] = Math.tanh(l * 1.1);
  outR[i] = Math.tanh(r * 1.1);
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const norm = 0.89 / peak;

const data = Buffer.alloc(44 + N * 4);
data.write("RIFF", 0);
data.writeUInt32LE(36 + N * 4, 4);
data.write("WAVEfmt ", 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28);
data.writeUInt16LE(4, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(outL[i] * norm * 32767), 44 + i * 4);
  data.writeInt16LE(Math.round(outR[i] * norm * 32767), 46 + i * 4);
}
mkdirSync("out", { recursive: true });
writeFileSync("out/music.wav", data);
console.log(`out/music.wav · ${TOTAL.toFixed(2)} s · ${bars} compases a 120 BPM · cortes en frames ${Object.values(SCENE_START).join(", ")}`);
