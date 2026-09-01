import { describe, expect, it } from "vitest";
import { scoringConfigurationIssues } from "@/lib/scoring";

describe("trava de pontuação", () => {
  it("bloqueia score e bônus quando os parâmetros estão incompletos", () => {
    expect(scoringConfigurationIssues([], [], [])).not.toHaveLength(0);
  });
});
