import { describe, expect, it } from "vitest";
import { contrast, deltaE, distinctPair, initials, luminance, mix, readableOn, teamVars } from "./color";

describe("contraste", () => {
  it("calcula luminancia y razón WCAG", () => {
    expect(luminance("#000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1);
  });

  it("elige texto negro o blanco legible (AA) sobre los colores de campaña", () => {
    expect(readableOn("#d4ff3a")).toBe("#111111"); // volt
    expect(readableOn("#ffd100")).toBe("#111111"); // sun
    expect(readableOn("#ff6b1a")).toBe("#111111"); // court
    expect(readableOn("#2459f5")).toBe("#ffffff"); // sky
    expect(readableOn("#1d4ed8")).toBe("#ffffff");
    for (const bg of ["#d4ff3a", "#ffd100", "#ff6b1a", "#2459f5", "#111111", "#ffffff"])
      expect(contrast(bg, readableOn(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("tolera colores inválidos o abreviados", () => {
    expect(teamVars("nope")["--team"]).toBe("#111111");
    expect(teamVars("#fff")["--team"]).toBe("#ffffff");
  });
});

describe("mix / teamVars / initials", () => {
  it("mezcla colores", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#123456", "#ffffff", 0)).toBe("#123456");
  });

  it("genera variables del equipo", () => {
    expect(teamVars("#1D4ED8")).toEqual({ "--team": "#1d4ed8", "--team-ink": "#ffffff", "--team-soft": mix("#1d4ed8", "#ffffff", 0.85) });
  });

  it("arma siglas para escudos sin logo", () => {
    expect(initials("Club Deportivo Quito")).toBe("CDQ");
    expect(initials("LDU")).toBe("LDU");
    expect(initials("Espoli")).toBe("ESP");
    expect(initials("  Mi  Club ")).toBe("MC");
  });
});

describe("pares de colores de equipo", () => {
  it("mide la diferencia perceptual", () => {
    expect(deltaE("#ff0000", "#ff0000")).toBeCloseTo(0);
    expect(deltaE("#000000", "#ffffff")).toBeGreaterThan(90);
  });

  it("conserva colores distintos y neutraliza los que se confunden", () => {
    expect(distinctPair("#e4002b", "#1d4ed8")).toEqual(["#e4002b", "#1d4ed8"]);
    expect(distinctPair("#e4002b", "#d0002a")).toEqual(["#e4002b", "#8a8a8c"]);
    expect(distinctPair("#8a8a8c", "#8b8b8d")[1]).toBe("#111111");
  });
});
