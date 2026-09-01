import { describe, expect, it } from "vitest";
import { BLOCKS, INDICATORS } from "@/lib/indicators";

describe("catálogo aprovado", () => {
  it("preserva exatamente 55 indicadores numerados em seis blocos", () => {
    expect(INDICATORS).toHaveLength(55);
    expect(BLOCKS).toHaveLength(6);
    expect(INDICATORS.map((item) => item.number)).toEqual(Array.from({ length: 55 }, (_, index) => index + 1));
    expect(new Set(INDICATORS.map((item) => item.key)).size).toBe(55);
    expect(INDICATORS.every((item) => item.label.trim().length > 0)).toBe(true);
  });

  it("marca somente os campos 16 e 17 como gerencial restrito", () => {
    expect(INDICATORS.filter((item) => item.restricted).map((item) => item.number)).toEqual([16, 17]);
  });
});
