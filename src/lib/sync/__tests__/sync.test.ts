import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";
import { maxSeq, mergeRows, renumber, sameEvent, skipsAhead, stableStringify } from "../rows";

const row = (seq: number, type = "point", payload: Record<string, unknown> = { team: "A" }) => ({ seq, type, payload });

describe("stableStringify / sameEvent", () => {
  it("ignora el orden de las claves (jsonb las reordena)", () => {
    expect(stableStringify({ b: 1, a: { d: [1, 2], c: null } })).toBe(stableStringify({ a: { c: null, d: [1, 2] }, b: 1 }));
  });

  it("compara tipo y contenido, no metadatos", () => {
    expect(sameEvent({ type: "point", payload: { team: "A" } }, { type: "point", payload: { team: "A" } })).toBe(true);
    expect(sameEvent({ type: "point", payload: { team: "A" } }, { type: "point", payload: { team: "B" } })).toBe(false);
    expect(sameEvent({ type: "point", payload: { team: "A" } }, { type: "timeout", payload: { team: "A" } })).toBe(false);
    expect(
      sameEvent(
        { type: "substitution", payload: { team: "A", out: 4, in: 12 } },
        { type: "substitution", payload: { in: 12, out: 4, team: "A" } },
      ),
    ).toBe(true);
  });
});

describe("mergeRows", () => {
  it("une por seq, ordena y da prioridad a las filas entrantes", () => {
    const merged = mergeRows([row(1), row(3, "point", { team: "B" })], [row(2), row(3, "timeout")]);
    expect(merged.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(merged[2].type).toBe("timeout");
  });
});

describe("renumber / maxSeq / skipsAhead", () => {
  it("renumera desde after+1 conservando el orden", () => {
    expect(renumber([row(9), row(7), row(8)], 20).map((r) => r.seq)).toEqual([21, 22, 23]);
    expect(renumber([row(9, "timeout"), row(7, "point")], 0).map((r) => r.type)).toEqual(["point", "timeout"]);
  });

  it("detecta un hueco respecto de lo conocido", () => {
    expect(maxSeq([])).toBe(0);
    expect(skipsAhead([row(1), row(2)], 3)).toBe(false);
    expect(skipsAhead([row(1), row(2)], 2)).toBe(false);
    expect(skipsAhead([row(1), row(2)], 5)).toBe(true);
    expect(skipsAhead([], 1)).toBe(false);
  });
});

describe("safeNext", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/mesa")).toBe("/mesa");
    expect(safeNext("/mesa/abc?x=1")).toBe("/mesa/abc?x=1");
  });

  it("rechaza destinos externos o raros", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", "/\n/evil.com", "javascript:alert(1)"])
      expect(safeNext(bad)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
