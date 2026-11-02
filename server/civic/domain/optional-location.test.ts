import { describe, expect, it } from "vitest";
import { findRelatedProposals } from "./related";
import { validateProposalInput } from "./validation";
import type { ProposalRecord, RelatedCandidateInput } from "./types";

const proposalInput = {
  kind: "public_service",
  title: "Água potável na escola",
  summary: "A escola precisa de água potável acessível.",
  description: "A comunidade relata que estudantes não têm acesso confiável a água potável.",
  desiredChange: "Garantir água potável para estudantes e funcionários.",
  acceptPublicPreview: true as const,
};

const existingProposal: ProposalRecord = {
  id: "existing",
  kind: "public_service",
  title: "Água potável para estudantes",
  summary: "A comunidade pede água limpa e segura na escola.",
  description: "Estudantes precisam de água potável no ambiente escolar.",
  desiredChange: "Instalar acesso à água potável.",
  municipalityCode: null,
  municipality: null,
  state: null,
  areaLabel: undefined,
  publicLocation: null,
  latitude: null,
  longitude: null,
  precision: "not_provided",
  createdAt: 1,
};

describe("optional proposal location", () => {
  it("accepts a proposal when the participant does not know or disclose a location", () => {
    expect(validateProposalInput(proposalInput)).not.toHaveProperty("region");
    expect(validateProposalInput({ ...proposalInput, region: null })).toMatchObject({ region: null });
  });

  it("still validates every field when a location is supplied", () => {
    expect(() => validateProposalInput({
      ...proposalInput,
      region: { municipalityCode: "bad", municipality: "X", state: "R" },
    })).toThrow();
  });

  it("accepts a manually reported municipality and UF without requiring IBGE code knowledge", () => {
    const result = validateProposalInput({
      ...proposalInput,
      region: { municipality: "São Paulo", state: "SP" },
    });
    expect(result.region).toEqual({ municipality: "São Paulo", state: "SP" });
  });

  it("can suggest textual matches without claiming geographic proximity", () => {
    const candidate: RelatedCandidateInput = {
      kind: "public_service",
      title: proposalInput.title,
      summary: proposalInput.summary,
      description: proposalInput.description,
      municipalityCode: null,
      municipality: null,
      state: null,
    };
    const matches = findRelatedProposals(candidate, [existingProposal]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.explanation).not.toMatch(/mesmo município/i);
    expect(matches[0]?.proposal.municipality).toBeNull();
  });
});
