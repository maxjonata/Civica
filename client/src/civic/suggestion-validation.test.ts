import { describe, expect, it } from "vitest";
import {
  getFieldErrorTargetId,
  getRelatedValidation,
  getStepErrors,
  type SuggestionValidationInput,
} from "./suggestion-validation";

const emptyDraft: SuggestionValidationInput = {
  title: "",
  summary: "",
  description: "",
  desiredChange: "",
  locationIncluded: false,
  municipalityCode: "",
  municipality: "",
  state: "",
  areaLabel: "",
  publicLocation: "",
  publicNotice: false,
};

const completeDraft: SuggestionValidationInput = {
  title: "Iluminação pública",
  summary: "A rua fica escura à noite.",
  description: "Moradores relatam pouca iluminação no trecho.",
  desiredChange: "Avaliar iluminação pública no local.",
  locationIncluded: true,
  municipalityCode: "3550308",
  municipality: "São Paulo",
  state: "SP",
  areaLabel: "Centro",
  publicLocation: "Praça da Sé",
  publicNotice: true,
};

describe("validation of suggestion steps", () => {
  it("maps every logical field error to an existing control id", () => {
    expect(getFieldErrorTargetId("title")).toBe("field-title");
    expect(getFieldErrorTargetId("summary")).toBe("field-summary");
    expect(getFieldErrorTargetId("description")).toBe("field-description");
    expect(getFieldErrorTargetId("desiredChange")).toBe("field-desired-change");
    expect(getFieldErrorTargetId("municipalityCode")).toBe("field-municipality-code");
    expect(getFieldErrorTargetId("municipality")).toBe("field-municipality");
    expect(getFieldErrorTargetId("state")).toBe("field-state");
    expect(getFieldErrorTargetId("areaLabel")).toBe("field-area");
    expect(getFieldErrorTargetId("publicNotice")).toBe("field-public-notice");
    expect(getFieldErrorTargetId("unknown-field")).toBe("page-title");
  });

  it("shows only errors belonging to the first invalid step", () => {
    const result = getRelatedValidation(emptyDraft);
    expect(result.firstInvalidStep).toBe(1);
    expect(Object.keys(result.errors)).toEqual([
      "title",
      "summary",
      "description",
      "desiredChange",
    ]);
  });

  it("shows location errors only after the text step is valid", () => {
    const result = getRelatedValidation({
      ...completeDraft,
      locationIncluded: true,
      municipalityCode: "",
      municipality: "",
      state: "",
      areaLabel: "",
      publicLocation: "",
    });
    expect(result.firstInvalidStep).toBe(2);
    expect(Object.keys(result.errors)).toEqual([
      "municipality",
      "state",
    ]);
  });

  it("does not retain hidden step errors when all related-search fields are valid", () => {
    const result = getRelatedValidation(completeDraft);
    expect(result).toEqual({ firstInvalidStep: null, errors: {} });
  });

  it("validates only the requested step, including visibility consent on review", () => {
    expect(Object.keys(getStepErrors(1, emptyDraft))).toEqual([
      "title",
      "summary",
      "description",
      "desiredChange",
    ]);
    expect(getStepErrors(2, emptyDraft)).toEqual({});
    expect(Object.keys(getStepErrors(2, { ...emptyDraft, locationIncluded: true }))).toEqual(["municipality", "state"]);
    expect(getStepErrors(4, { ...completeDraft, publicNotice: false })).toEqual({
      publicNotice: "Confirme que entendeu a visibilidade antes de publicar.",
    });
  });
});
