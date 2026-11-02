export type SuggestionValidationInput = {
  title: string;
  summary: string;
  description: string;
  desiredChange: string;
  locationIncluded: boolean;
  municipalityCode: string;
  municipality: string;
  state: string;
  areaLabel: string;
  publicLocation: string;
  publicNotice: boolean;
};

const fieldTargetIds: Record<string, string> = {
  title: "field-title",
  summary: "field-summary",
  description: "field-description",
  desiredChange: "field-desired-change",
  municipalityCode: "field-municipality-code",
  municipality: "field-municipality",
  state: "field-state",
  areaLabel: "field-area",
  publicLocation: "field-public-location",
  publicNotice: "field-public-notice",
};

export function getFieldErrorTargetId(field: string): string {
  return fieldTargetIds[field] ?? "page-title";
}

export function getStepErrors(
  target: number,
  draft: SuggestionValidationInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (target === 1) {
    if (!draft.title.trim()) errors.title = "Diga em poucas palavras o que deveria mudar.";
    if (!draft.summary.trim()) errors.summary = "Escreva um resumo curto para quem vai ler.";
    if (!draft.description.trim()) errors.description = "Conte o problema ou a necessidade com suas palavras.";
    if (!draft.desiredChange.trim()) errors.desiredChange = "Explique qual mudança você gostaria de ver.";
  }
  if (target === 2) {
    if (!draft.locationIncluded) return errors;
    if (!draft.municipality.trim()) errors.municipality = "Informe o município do projeto.";
    if (!/^[A-Za-zÀ-ÿ]{2}$/.test(draft.state.trim())) errors.state = "Informe a UF com duas letras.";
  }
  if (target === 4 && !draft.publicNotice) {
    errors.publicNotice = "Confirme que entendeu a visibilidade antes de publicar.";
  }
  return errors;
}

export function getRelatedValidation(draft: SuggestionValidationInput): {
  firstInvalidStep: 1 | 2 | null;
  errors: Record<string, string>;
} {
  const textErrors = getStepErrors(1, draft);
  if (Object.keys(textErrors).length) {
    return { firstInvalidStep: 1, errors: textErrors };
  }
  const locationErrors = getStepErrors(2, draft);
  if (Object.keys(locationErrors).length) {
    return { firstInvalidStep: 2, errors: locationErrors };
  }
  return { firstInvalidStep: null, errors: {} };
}
