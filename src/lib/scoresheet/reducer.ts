import { LIBERO_EXIT_INDEX, isBackRow, rotate } from "./rotation";
import { rulesOf } from "./rules";
import {
  type MatchEventInput,
  type MatchSetup,
  type MatchState,
  type ResolvedSanction,
  RuleError,
  type SetState,
  type Side,
  type TeamSetState,
  otherSide,
} from "./types";

/** Límites de vóley FIVB. Para el partido en curso usar `state.rules`. */
export const MAX_TIMEOUTS = 2;
export const MAX_SUBSTITUTIONS = 6;
export const MAX_LIBEROS = 2;

export const setsToWin = (bestOf: 3 | 5) => Math.ceil(bestOf / 2);

export function initialState(setup: MatchSetup): MatchState {
  const rules = rulesOf(setup);
  return {
    phase: "coin_toss",
    rules,
    bestOf: rules.bestOf,
    setsWon: { A: 0, B: 0 },
    sets: [],
    currentSet: 1,
    serving: null,
    leftTeam: "A",
    pendingLineups: {},
    decidingToss: null,
    sanctions: [],
    expelled: { A: [], B: [] },
    disqualified: { A: [], B: [] },
    winner: null,
    signatures: null,
    notice: null,
    log: [],
    lastSeq: 0,
  };
}

export function currentSet(state: MatchState): SetState | null {
  const s = state.sets[state.sets.length - 1];
  return s && s.no === state.currentSet ? s : null;
}

export const isDecidingSet = (state: MatchState, setNo = state.currentSet) => setNo === state.bestOf;

export function targetPoints(_setup: MatchSetup, state: MatchState, setNo = state.currentSet) {
  return isDecidingSet(state, setNo) ? state.rules.pointsDecidingSet : state.rules.pointsPerSet;
}

const SANCTION_LABEL: Record<ResolvedSanction, string> = {
  warning: "Amonestación",
  penalty: "Castigo",
  expulsion: "Expulsión",
  disqualification: "Descalificación",
  delay_warning: "Amonestación por retraso",
  delay_penalty: "Castigo por retraso",
};

/**
 * Aplica un evento al estado. Es pura: no muta `prev`.
 * Lanza `RuleError` (con mensaje para la mesa) si el evento viola las reglas.
 */
export function applyEvent(
  prev: MatchState,
  event: MatchEventInput & { seq?: number },
  setup: MatchSetup,
): MatchState {
  const state = cloneState(prev);
  state.notice = null;
  const seq = event.seq ?? state.lastSeq + 1;
  state.lastSeq = Math.max(state.lastSeq, seq);

  const name = (t: Side) => setup.teams[t].name;
  const roster = (t: Side) => setup.teams[t].players;
  const inRoster = (t: Side, n: number) => roster(t).some((p) => p.number === n);
  const isLibero = (t: Side, n: number) => roster(t).some((p) => p.number === n && p.libero);
  const set = currentSet(state);
  const rules = state.rules;
  const log = (text: string) =>
    state.log.push({ seq, set: state.currentSet, text, score: set ? { ...set.score } : { A: 0, B: 0 } });
  const fail = (msg: string): never => {
    throw new RuleError(msg);
  };
  const requirePlaying = () => {
    if (state.phase !== "playing" || !set) fail("No hay un set en juego.");
    return set as SetState;
  };

  switch (event.type) {
    case "coin_toss": {
      if (state.phase !== "coin_toss") fail("El sorteo no corresponde en este momento.");
      state.serving = event.serving;
      state.leftTeam = event.leftTeam;
      if (isDecidingSet(state)) state.decidingToss = { serving: event.serving, leftTeam: event.leftTeam };
      state.phase = "lineups";
      log(`Sorteo: saca ${name(event.serving)}; ${name(event.leftTeam)} a la izquierda`);
      return state;
    }

    case "lineup": {
      if (state.phase !== "lineups") fail("La formación inicial solo se registra antes del set.");
      const { team, positions } = event;
      const liberos = event.liberos ?? [];
      const n = rules.playersOnCourt;
      if (positions.length !== n)
        fail(rules.rotation ? `La formación debe tener ${n} jugadores (posiciones I a VI).` : `La formación debe tener ${n} jugadores (${rules.positionLabels.join(", ")}).`);
      if (new Set(positions).size !== n) fail("La formación tiene jugadores repetidos.");
      for (const n of positions) {
        if (!inRoster(team, n)) fail(`El N.º ${n} no está en la nómina de ${name(team)}.`);
        if (isLibero(team, n)) fail(`El N.º ${n} es líbero y no puede estar en la formación inicial.`);
        if (state.disqualified[team].includes(n)) fail(`El N.º ${n} está descalificado.`);
      }
      if (liberos.length > rules.liberos) fail(rules.liberos ? `Máximo ${rules.liberos} líberos por equipo.` : "Este modo de juego no usa líbero.");
      for (const l of liberos) {
        if (!isLibero(team, l)) fail(`El N.º ${l} no está registrado como líbero.`);
        if (state.disqualified[team].includes(l)) fail(`El N.º ${l} está descalificado.`);
      }
      state.pendingLineups[team] = { positions: [...positions], liberos: [...liberos] };
      log(`Formación de ${name(team)}: ${positions.join(", ")}`);
      if (state.pendingLineups.A && state.pendingLineups.B) startSet(state, seq, setup);
      return state;
    }

    case "point": {
      requirePlaying();
      awardPoint(state, event.team, setup, seq, false);
      return state;
    }

    case "timeout": {
      const s = requirePlaying();
      const ts = s.teams[event.team];
      if (ts.timeouts >= rules.timeoutsPerSet)
        fail(`${name(event.team)} ya usó sus ${rules.timeoutsPerSet} tiempos en este set.`);
      if (rules.timeoutsOnlyServing && state.serving !== event.team) fail("Solo el equipo que tiene el saque puede pedir tiempo.");
      ts.timeouts += 1;
      log(`Tiempo para ${name(event.team)} (${ts.timeouts}/${rules.timeoutsPerSet})`);
      return state;
    }

    case "substitution": {
      const s = requirePlaying();
      const { team, out, in: inn } = event;
      const ts = s.teams[team];
      if (ts.substitutions >= rules.maxSubstitutions)
        fail(`${name(team)} ya usó ${rules.maxSubstitutions} sustituciones en este set.`);
      if (ts.liberoOnCourt?.replaced === out)
        fail(`El N.º ${out} está reemplazado por el líbero; primero debe salir el líbero.`);
      const idx = ts.positions.indexOf(out);
      if (idx === -1) fail(`El N.º ${out} no está en la cancha.`);
      if (isLibero(team, out)) fail("El líbero no puede ser sustituido con una sustitución regular.");
      if (!inRoster(team, inn)) fail(`El N.º ${inn} no está en la nómina de ${name(team)}.`);
      if (isLibero(team, inn)) fail("Un líbero no puede entrar por sustitución regular.");
      if (ts.positions.includes(inn) || ts.liberoOnCourt?.replaced === inn)
        fail(`El N.º ${inn} ya está en la cancha.`);
      if (state.expelled[team].includes(inn)) fail(`El N.º ${inn} está expulsado en este set.`);
      if (state.disqualified[team].includes(inn)) fail(`El N.º ${inn} está descalificado.`);

      const pairAsStarter = ts.subPairs.find((p) => p.starter === out);
      const pairAsSub = ts.subPairs.find((p) => p.sub === out);
      if (rules.substitutionModel === "free") {
        // Sustitución libre (ecuavóley): cualquier jugador de la banca por cualquiera en cancha.
      } else if (pairAsSub) {
        // Sale un suplente: solo puede volver el titular al que reemplazó.
        if (pairAsSub.starter !== inn)
          fail(`El N.º ${out} solo puede ser reemplazado por el titular N.º ${pairAsSub.starter}.`);
        pairAsSub.returned = true;
      } else {
        if (!ts.starters.includes(out)) fail(`El N.º ${out} no puede salir: no es titular ni suplente en cancha.`);
        if (pairAsStarter) fail(`El titular N.º ${out} ya completó su sustitución en este set.`);
        if (ts.starters.includes(inn)) fail(`El N.º ${inn} es titular y solo puede volver a su posición.`);
        if (ts.subPairs.some((p) => p.sub === inn))
          fail(`El N.º ${inn} ya entró como suplente en este set.`);
        ts.subPairs.push({ starter: out, sub: inn, returned: false });
      }
      ts.positions[idx] = inn;
      ts.entered.push(inn);
      ts.substitutions += 1;
      log(`Sustitución ${name(team)}: sale ${out}, entra ${inn} (${ts.substitutions}/${rules.maxSubstitutions})`);
      return state;
    }

    case "libero_in": {
      const s = requirePlaying();
      const { team, libero, replaced } = event;
      const ts = s.teams[team];
      if (!rules.liberos) fail("Este modo de juego no usa líbero.");
      if (!ts.liberos.includes(libero)) fail(`El N.º ${libero} no está registrado como líbero en este set.`);
      if (state.expelled[team].includes(libero) || state.disqualified[team].includes(libero))
        fail(`El líbero N.º ${libero} no puede jugar (sancionado).`);
      if (ts.liberoOnCourt) fail("Ya hay un líbero en la cancha.");
      checkLiberoRallyGap(ts, s, fail);
      const idx = ts.positions.indexOf(replaced);
      if (idx === -1) fail(`El N.º ${replaced} no está en la cancha.`);
      if (!isBackRow(idx)) fail("El líbero solo puede reemplazar a un zaguero (posiciones I, V o VI).");
      if (idx === 0 && state.serving === team) fail("El líbero no puede sacar.");
      ts.positions[idx] = libero;
      ts.entered.push(libero);
      ts.liberoOnCourt = { libero, replaced };
      ts.lastLiberoRally = s.rallies.length;
      log(`Líbero ${name(team)}: entra ${libero} por ${replaced}`);
      return state;
    }

    case "libero_out": {
      const s = requirePlaying();
      const ts = s.teams[event.team];
      if (!ts.liberoOnCourt) fail("No hay líbero en la cancha.");
      checkLiberoRallyGap(ts, s, fail);
      const { libero, replaced } = ts.liberoOnCourt!;
      ts.positions[ts.positions.indexOf(libero)] = replaced;
      ts.liberoOnCourt = null;
      ts.lastLiberoRally = s.rallies.length;
      log(`Líbero ${name(event.team)}: sale ${libero}, vuelve ${replaced}`);
      return state;
    }

    case "sanction": {
      const s = requirePlaying();
      const { team } = event;
      const player = event.player ?? null;
      if (player !== null && !inRoster(team, player)) fail(`El N.º ${player} no está en la nómina de ${name(team)}.`);
      let kind: ResolvedSanction;
      if (event.kind === "delay") {
        const warned = state.sanctions.some((x) => x.team === team && x.kind === "delay_warning");
        kind = warned ? "delay_penalty" : "delay_warning";
      } else {
        kind = event.kind;
      }
      if ((kind === "expulsion" || kind === "disqualification") && player === null)
        fail("La expulsión y la descalificación requieren indicar el jugador.");
      state.sanctions.push({ set: s.no, team, kind, player, score: { ...s.score } });
      if (kind === "expulsion") state.expelled[team].push(player!);
      if (kind === "disqualification") state.disqualified[team].push(player!);
      log(`${SANCTION_LABEL[kind]} a ${name(team)}${player !== null ? ` (N.º ${player})` : ""}`);
      if (kind === "penalty" || kind === "delay_penalty") awardPoint(state, otherSide(team), setup, seq, true);
      else if ((kind === "expulsion" || kind === "disqualification") && onCourt(s.teams[team], player!))
        state.notice = `El N.º ${player} de ${name(team)} debe ser sustituido.`;
      return state;
    }

    case "close": {
      if (state.phase !== "finished") fail("El partido aún no ha terminado.");
      if (!event.captainA.trim() || !event.captainB.trim() || !event.referee.trim())
        fail("Faltan las firmas de capitanes y del árbitro.");
      state.signatures = { captainA: event.captainA, captainB: event.captainB, referee: event.referee };
      state.phase = "closed";
      log("Planilla cerrada y firmada");
      return state;
    }

    case "undo":
      return fail("`undo` se resuelve en replay(), no en applyEvent().");
  }
}

// Copia estructural barata: las entradas de log, rallies y sanciones son inmutables
// una vez creadas, así que basta con copiar los arreglos.
function cloneTeam(t: TeamSetState): TeamSetState {
  return {
    ...t,
    positions: [...t.positions],
    starters: [...t.starters],
    liberos: [...t.liberos],
    subPairs: t.subPairs.map((p) => ({ ...p })),
    entered: [...t.entered],
    liberoOnCourt: t.liberoOnCourt && { ...t.liberoOnCourt },
  };
}

function cloneState(prev: MatchState): MatchState {
  return {
    ...prev,
    setsWon: { ...prev.setsWon },
    sets: prev.sets.map((s) => ({
      ...s,
      score: { ...s.score },
      teams: { A: cloneTeam(s.teams.A), B: cloneTeam(s.teams.B) },
      rallies: [...s.rallies],
    })),
    pendingLineups: { ...prev.pendingLineups },
    sanctions: [...prev.sanctions],
    expelled: { A: [...prev.expelled.A], B: [...prev.expelled.B] },
    disqualified: { A: [...prev.disqualified.A], B: [...prev.disqualified.B] },
    log: [...prev.log],
  };
}

function onCourt(ts: TeamSetState, n: number) {
  return ts.positions.includes(n) || ts.liberoOnCourt?.replaced === n;
}

function checkLiberoRallyGap(ts: TeamSetState, s: SetState, fail: (m: string) => never) {
  if (ts.lastLiberoRally >= 0 && s.rallies.length <= ts.lastLiberoRally)
    fail("Debe jugarse al menos un rally entre dos reemplazos del líbero.");
}

function startSet(state: MatchState, seq: number, setup: MatchSetup) {
  const firstServer = state.serving!;
  const mk = (t: Side): TeamSetState => {
    const l = state.pendingLineups[t]!;
    return {
      positions: [...l.positions],
      starters: [...l.positions],
      liberos: [...l.liberos],
      timeouts: 0,
      substitutions: 0,
      subPairs: [],
      entered: [],
      liberoOnCourt: null,
      lastLiberoRally: -1,
    };
  };
  state.sets.push({
    no: state.currentSet,
    firstServer,
    score: { A: 0, B: 0 },
    teams: { A: mk("A"), B: mk("B") },
    rallies: [],
    winner: null,
    switchedAtEight: false,
  });
  state.pendingLineups = {};
  state.expelled = { A: [], B: [] };
  state.phase = "playing";
  state.log.push({
    seq,
    set: state.currentSet,
    text: `Inicio del set ${state.currentSet}: saca ${setup.teams[firstServer].name}`,
    score: { A: 0, B: 0 },
  });
}

function awardPoint(state: MatchState, team: Side, setup: MatchSetup, seq: number, bySanction: boolean) {
  const set = currentSet(state)!;
  const rules = state.rules;
  const server = state.serving!;
  const serverNumber = set.teams[server].positions[0];
  const gainsServe = team !== server;
  // Con cambio de saque solo suma quien sacó; el receptor que gana solo recupera el saque.
  const scores = rules.scoring === "rally" || !gainsServe;
  if (scores) set.score[team] += 1;
  set.rallies.push({ winner: team, server, serverNumber, score: { ...set.score }, bySanction, ...(scores ? {} : { sideout: true }) });

  if (gainsServe) {
    const ts = set.teams[team];
    if (rules.rotation) {
      // Recupera el saque: rota. Si el líbero está en V pasaría a delantera, así que sale antes.
      if (ts.liberoOnCourt && ts.positions[LIBERO_EXIT_INDEX] === ts.liberoOnCourt.libero) {
        ts.positions[LIBERO_EXIT_INDEX] = ts.liberoOnCourt.replaced;
        state.log.push({
          seq,
          set: set.no,
          text: `Líbero ${setup.teams[team].name}: sale ${ts.liberoOnCourt.libero} por rotación, vuelve ${ts.liberoOnCourt.replaced}`,
          score: { ...set.score },
        });
        ts.liberoOnCourt = null;
        ts.lastLiberoRally = set.rallies.length;
      }
      ts.positions = rotate(ts.positions);
    }
    state.serving = team;
  }

  if (!scores) {
    state.log.push({
      seq,
      set: set.no,
      text: `${bySanction ? "Castigo: cambio" : "Cambio"} de saque para ${setup.teams[team].name} (${set.score.A}-${set.score.B})`,
      score: { ...set.score },
    });
    return;
  }

  state.log.push({
    seq,
    set: set.no,
    text: `${bySanction ? "Punto por castigo" : "Punto"} para ${setup.teams[team].name} (${set.score.A}-${set.score.B})`,
    score: { ...set.score },
  });

  const target = targetPoints(setup, state, set.no);

  if (isDecidingSet(state, set.no) && !set.switchedAtEight && Math.max(set.score.A, set.score.B) === Math.ceil(target / 2)) {
    set.switchedAtEight = true;
    state.leftTeam = otherSide(state.leftTeam);
    state.notice = "Cambio de cancha";
  }

  const other = otherSide(team);
  if (set.score[team] >= target && set.score[team] - set.score[other] >= 2) {
    set.winner = team;
    state.setsWon[team] += 1;
    state.log.push({
      seq,
      set: set.no,
      text: `Fin del set ${set.no}: gana ${setup.teams[team].name} ${set.score[team]}-${set.score[other]}`,
      score: { ...set.score },
    });
    if (state.setsWon[team] === setsToWin(state.bestOf)) {
      state.winner = team;
      state.phase = "finished";
      state.serving = null;
      state.notice = `Fin del partido: gana ${setup.teams[team].name} ${state.setsWon[team]}-${state.setsWon[other]}`;
      return;
    }
    state.currentSet += 1;
    state.leftTeam = otherSide(state.leftTeam);
    state.notice = `Fin del set ${set.no}. Cambio de cancha.`;
    if (isDecidingSet(state)) {
      state.phase = "coin_toss";
      state.serving = null;
    } else {
      // En los sets 2..4 saca primero quien no sacó primero en el set anterior.
      state.serving = otherSide(set.firstServer);
      state.phase = "lineups";
    }
  }
}
