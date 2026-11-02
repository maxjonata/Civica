import type { RelatedProposal } from "@shared/civic/contracts";
import { normalizeText } from "./validation";
import type { ProposalRecord, RelatedCandidateInput } from "./types";

function terms(value: string): Set<string> {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

export function findRelatedProposals(
  candidate: RelatedCandidateInput,
  existing: readonly ProposalRecord[],
  limit = 5
): RelatedProposal[] {
  const candidateTerms = terms([
    candidate.title,
    candidate.summary,
    candidate.description,
  ].join(" "));
  if (candidateTerms.size < 2) return [];

  return existing
    .filter(item => item.kind === candidate.kind)
    .map(item => {
      const itemTerms = terms([item.title, item.summary, item.description].join(" "));
      const sharedTerms = [...candidateTerms].filter(term => itemTerms.has(term)).sort();
      const union = new Set([...candidateTerms, ...itemTerms]);
      const lexicalScore = union.size ? sharedTerms.length / union.size : 0;
      const sameMunicipality = Boolean(
        candidate.municipalityCode &&
        item.municipalityCode &&
        item.municipalityCode === candidate.municipalityCode
      );
      const score = Math.min(1, lexicalScore + (sameMunicipality ? 0.08 : 0));
      return { item, sharedTerms, score, sameMunicipality };
    })
    .filter(result => result.sharedTerms.length >= 2 && result.score >= 0.12)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, Math.max(0, Math.min(limit, 10)))
    .map(result => ({
      proposal: {
        id: result.item.id,
        title: result.item.title,
        kind: result.item.kind,
        municipality: result.item.municipality,
        state: result.item.state,
      },
      score: Number(result.score.toFixed(3)),
      sharedTerms: result.sharedTerms,
      explanation: `Possível relação por ${result.sharedTerms.length} termos em comum${result.sameMunicipality ? " e pela mesma localidade informada, ainda não verificada" : ""}. Leia as propostas; semelhança não confirma equivalência.`,
    }));
}
