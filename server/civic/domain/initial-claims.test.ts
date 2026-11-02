import { describe, expect, it } from "vitest";
import { validateProposalInput } from "./validation";

const base = {
  kind: "legislative_change",
  title: "Atualizar regra de transporte acessível",
  summary: "A proposta discute melhorias nas regras de acessibilidade do transporte público.",
  description: "O relato pergunta como uma regra poderia cobrir melhor as barreiras de acesso.",
  desiredChange: "Avaliar uma alteração depois de consultar as normas e as pessoas afetadas.",
  region: null,
  acceptPublicPreview: true as const,
};

const participantClaim = {
  category: "other",
  type: "participant_report",
  relation: "unknown",
  statement: "Este é um relato comunitário; não foi conferido pela plataforma.",
};

describe("optional initial claims", () => {
  it("allows no claims and preserves up to five fully described community submissions", () => {
    expect(validateProposalInput(base)).not.toHaveProperty("initialClaims");
    const input = validateProposalInput({ ...base, initialClaims: Array.from({ length: 5 }, (_, index) => ({ ...participantClaim, statement: `${index + 1}. ${participantClaim.statement}` })) });
    expect(input.initialClaims).toHaveLength(5);
    expect(input.initialClaims?.[0]?.type).toBe("participant_report");
  });

  it("rejects more than five claims and documented facts without a source title and HTTPS URL", () => {
    expect(() => validateProposalInput({ ...base, initialClaims: Array.from({ length: 6 }, (_, index) => ({ ...participantClaim, statement: `${index + 1}. ${participantClaim.statement}` })) })).toThrow();
    expect(() => validateProposalInput({ ...base, initialClaims: [{ ...participantClaim, type: "documented_fact" }] })).toThrow();
    expect(() => validateProposalInput({ ...base, initialClaims: [{ ...participantClaim, sourceUrl: "http://example.org/source" }] })).toThrow();
  });

  it("accepts a documented-fact label only with explicit source metadata and never adds a checked status", () => {
    const input = validateProposalInput({
      ...base,
      initialClaims: [{ ...participantClaim, type: "documented_fact", sourceTitle: "Norma publicada", sourceUrl: "https://example.org/norma" }],
    });
    expect(input.initialClaims?.[0]).not.toHaveProperty("status");
    expect(input.initialClaims?.[0]).not.toHaveProperty("checkedAt");
  });
});
