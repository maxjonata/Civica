import { describe, expect, it } from "vitest";
import { getRelatedValidation, getStepErrors, type SuggestionValidationInput } from "./suggestion-validation";

const textReady: SuggestionValidationInput = {
  title: "Iluminação da praça",
  summary: "A praça fica escura depois do anoitecer.",
  description: "Pessoas relatam dificuldade de atravessar a praça com segurança.",
  desiredChange: "Avaliar a iluminação da praça.",
  locationIncluded: false,
  municipalityCode: "",
  municipality: "",
  state: "",
  areaLabel: "",
  publicLocation: "",
  publicNotice: true,
};

describe("optional location in suggestion intake", () => {
  it("allows advancing and searching related ideas without disclosing a location", () => {
    expect(getStepErrors(2, textReady)).toEqual({});
    expect(getRelatedValidation(textReady)).toEqual({ firstInvalidStep: null, errors: {} });
  });

  it("does not require an area or public reference when location is included", () => {
    expect(getStepErrors(2, {
      ...textReady,
      locationIncluded: true,
      municipality: "São Paulo",
      state: "SP",
    })).toEqual({});
  });

  it("requires a consistent basic locality only when the participant elects to provide one", () => {
    const included = { ...textReady, locationIncluded: true };
    expect(getStepErrors(2, included)).toMatchObject({
      municipality: expect.any(String),
      state: expect.any(String),
    });
    expect(getStepErrors(2, { ...included, municipality: "São Paulo", state: "SP" })).toEqual({});
  });
});
