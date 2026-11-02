import { describe, expect, it } from "vitest";
import { normalizeText, validateProposalInput } from "./validation";
import { findRelatedProposals } from "./related";
import { publicVoteResult, suppressSmallCells } from "./analytics";
import { comparableDistance, projectGraph3d } from "./graph";
import type { ProposalRecord, PolicyProfileRecord } from "./types";

const proposal = (id: string, title: string, summary: string): ProposalRecord => ({
  id,
  kind: "public_work",
  title,
  summary,
  description: summary,
  desiredChange: "Melhorar acesso e segurança",
  municipalityCode: "3304557",
  municipality: "Rio de Janeiro",
  state: "RJ",
  publicLocation: null,
  createdAt: 1000,
});

describe("civic domain invariants", () => {
  it("normalizes accents and rejects markup, empty and oversized public content", () => {
    expect(normalizeText("Iluminação pública no bairro"))
      .toBe("iluminacao publica");
    expect(() => validateProposalInput({
      kind: "public_work",
      title: "<script>alert(1)</script>",
      summary: "Resumo suficiente",
      description: "Descrição suficiente para a proposta.",
      desiredChange: "Mudança desejada",
      region: { municipalityCode: "3304557", municipality: "Rio de Janeiro", state: "RJ" },
      acceptPublicPreview: true,
    })).toThrow();
    expect(() => validateProposalInput({
      kind: "public_work",
      title: " ",
      summary: "Resumo suficiente",
      description: "Descrição suficiente para a proposta.",
      desiredChange: "Mudança desejada",
      region: { municipalityCode: "3304557", municipality: "Rio de Janeiro", state: "RJ" },
      acceptPublicPreview: true,
    })).toThrow();
  });

  it("suggests related projects by shared terms without claiming equivalence", () => {
    const results = findRelatedProposals({
      kind: "public_work",
      title: "Iluminação segura na ciclovia",
      summary: "Instalar iluminação pública na ciclovia do bairro",
      description: "A ciclovia fica escura e insegura durante a noite.",
      municipalityCode: "3304557",
      municipality: "Rio de Janeiro",
      state: "RJ",
    }, [
      proposal("same", "Iluminação pública da ciclovia", "Mais luz e segurança para ciclistas"),
      proposal("unrelated", "Nova creche municipal", "Vagas de educação infantil"),
    ]);
    expect(results.map(result => result.proposal.id)).toEqual(["same"]);
    expect(results[0]?.sharedTerms.length).toBeGreaterThan(0);
    expect(results[0]?.explanation).toMatch(/palavras|termos/i);
  });

  it("hides vote breakdowns until the public cells meet the minimum", () => {
    expect(publicVoteResult([
      "support", "support", "support", "support", "support",
      "support", "support", "support", "support", "support",
      "oppose",
    ], 10)).toMatchObject({ visible: false, total: null, choices: null });
    expect(publicVoteResult([
      ...Array.from({ length: 10 }, () => "support" as const),
      ...Array.from({ length: 10 }, () => "oppose" as const),
      ...Array.from({ length: 10 }, () => "need_information" as const),
    ], 10)).toMatchObject({ visible: true, total: 30 });
  });

  it("suppresses small region cells and one complementary cell to prevent subtraction", () => {
    const result = suppressSmallCells([
      { key: "A", count: 4 },
      { key: "B", count: 20 },
      { key: "C", count: 30 },
    ], 10);
    expect(result.find(cell => cell.key === "A")?.count).toBeNull();
    expect(result.filter(cell => cell.count === null)).toHaveLength(2);
    expect(result.every(cell => cell.suppressed === (cell.count === null))).toBe(true);
  });

  it("computes distance only across sourced common positions, never imputing missing stances", () => {
    const a: PolicyProfileRecord = {
      id: "a", label: "Autoridade A", kind: "public_authority", verified: true,
      positions: [
        { topic: "transporte", value: 1, sourceTitle: "Ata 1", sourceUrl: "https://example.org/1", sourceDate: "2026-01-01" },
        { topic: "educacao", value: -1, sourceTitle: "Votação 2", sourceUrl: "https://example.org/2", sourceDate: "2026-01-02" },
        { topic: "saude", value: 1, sourceTitle: "Ata 3", sourceUrl: "https://example.org/3", sourceDate: "2026-01-03" },
      ],
    };
    const b: PolicyProfileRecord = {
      id: "b", label: "Autoridade B", kind: "public_authority", verified: true,
      positions: [
        { topic: "transporte", value: -1, sourceTitle: "Voto 1", sourceUrl: "https://example.org/4", sourceDate: "2026-01-01" },
        { topic: "educacao", value: -1, sourceTitle: "Votação 2", sourceUrl: "https://example.org/5", sourceDate: "2026-01-02" },
        { topic: "saude", value: 1, sourceTitle: "Ata 3", sourceUrl: "https://example.org/6", sourceDate: "2026-01-03" },
      ],
    };
    expect(comparableDistance(a, b, 3)).toMatchObject({ distance: 2, sharedTopics: ["educacao", "saude", "transporte"] });
    expect(comparableDistance(a, { ...b, verified: false }, 3)).toBeNull();
    expect(comparableDistance(a, { ...b, positions: b.positions.slice(0, 1) }, 3)).toBeNull();
  });

  it("makes a stable, source-filtered 3D graph and returns an honest empty state", () => {
    const result = projectGraph3d([], 3);
    expect(result).toMatchObject({ nodes: [], edges: [], emptyReason: "no_verified_positions" });
  });

  it("excludes non-comparable profiles from the MDS instead of assigning zero distance", () => {
    const a: PolicyProfileRecord = {
      id: "a", label: "Autoridade A", kind: "public_authority", verified: true,
      positions: [
        { topic: "transporte", value: 1, sourceTitle: "Ata 1", sourceUrl: "https://example.org/1", sourceDate: "2026-01-01" },
        { topic: "educacao", value: -1, sourceTitle: "Ata 2", sourceUrl: "https://example.org/2", sourceDate: "2026-01-02" },
        { topic: "saude", value: 1, sourceTitle: "Ata 3", sourceUrl: "https://example.org/3", sourceDate: "2026-01-03" },
      ],
    };
    const b: PolicyProfileRecord = { ...a, id: "b", label: "Autoridade B" };
    const isolated: PolicyProfileRecord = {
      ...a,
      id: "isolated",
      label: "Perfil isolado",
      positions: a.positions.map(position => ({ ...position, topic: `outro-${position.topic}` })),
    };

    const result = projectGraph3d([isolated, b, a], 3);

    expect(result.nodes.map(node => node.id)).toEqual(["a", "b"]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ source: "a", target: "b", distance: 0 });
    expect(result.excludedProfileCount).toBe(1);
    expect(result.nodes.some(node => node.id === "isolated")).toBe(false);
    expect(result.edges.some(edge => edge.source === "isolated" || edge.target === "isolated")).toBe(false);
  });
});
