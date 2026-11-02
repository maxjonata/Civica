import { useEffect, useState } from "react";
import { civicApi } from "./api";
import type {
  IbgeMunicipalityOption,
  IbgeStateOption,
} from "@shared/civic/contracts";

export type LocalityField = "state" | "municipality" | "municipalityCode";

export function LocalityPicker({
  state,
  municipality,
  municipalityCode,
  errors,
  onChange,
}: {
  state: string;
  municipality: string;
  municipalityCode: string;
  errors: Record<string, string>;
  onChange: (field: LocalityField, value: string) => void;
}) {
  const [states, setStates] = useState<IbgeStateOption[]>([]);
  const [municipalities, setMunicipalities] = useState<IbgeMunicipalityOption[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [statesUnavailable, setStatesUnavailable] = useState(false);
  const [municipalitiesUnavailable, setMunicipalitiesUnavailable] = useState(false);
  const [manualMunicipalities, setManualMunicipalities] = useState(false);

  useEffect(() => {
    let active = true;
    void civicApi
      .states()
      .then(value => {
        if (active) setStates(value);
      })
      .catch(() => {
        if (active) setStatesUnavailable(true);
      })
      .finally(() => {
        if (active) setStatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const uf = state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) {
      setMunicipalities([]);
      setMunicipalitiesUnavailable(false);
      setMunicipalitiesLoading(false);
      return;
    }

    let active = true;
    setMunicipalities([]);
    setMunicipalitiesUnavailable(false);
    setMunicipalitiesLoading(true);
    void civicApi
      .municipalities(uf)
      .then(value => {
        if (active) setMunicipalities(value);
      })
      .catch(() => {
        if (active) setMunicipalitiesUnavailable(true);
      })
      .finally(() => {
        if (active) setMunicipalitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state]);

  function chooseState(value: string) {
    onChange("state", value);
    onChange("municipalityCode", "");
    onChange("municipality", "");
    setManualMunicipalities(false);
  }

  function chooseMunicipality(code: string) {
    const selected = municipalities.find(
      item => String(item.id).padStart(7, "0") === code,
    );
    onChange("municipalityCode", code);
    onChange("municipality", selected?.nome ?? "");
  }

  return (
    <fieldset className="civic-fieldset civic-locality-fields">
      <legend>Local do projeto</legend>
      <p className="civic-help">
        Informe onde a proposta se aplica, não onde você mora. As listas vêm do
        IBGE. No seletor nativo, digite as primeiras letras do nome para chegar
        mais rápido.
      </p>
      {states.length > 0 ? (
        <div className="civic-field">
          <label htmlFor="field-state">Estado (UF)</label>
          <select
            id="field-state"
            value={state}
            onChange={event => chooseState(event.target.value)}
            aria-invalid={errors.state ? "true" : undefined}
            aria-describedby={
              errors.state ? "help-state error-state" : "help-state"
            }
          >
            <option value="">Selecione uma UF</option>
            {states.map(item => (
              <option key={item.id} value={item.sigla}>
                {item.sigla} — {item.nome}
              </option>
            ))}
          </select>
          <small id="help-state">Lista oficial de unidades da federação.</small>
          {errors.state && <small id="error-state">{errors.state}</small>}
        </div>
      ) : (
        <div className="civic-field">
          <label htmlFor="field-state">Estado (UF)</label>
          <input
            id="field-state"
            maxLength={2}
            value={state}
            onChange={event => chooseState(event.target.value.toUpperCase())}
            aria-invalid={errors.state ? "true" : undefined}
            aria-describedby={
              errors.state ? "help-state error-state" : "help-state"
            }
          />
          <small id="help-state">
            {statesLoading
              ? "Carregando a lista oficial de estados…"
              : "Informe a sigla de duas letras. A lista oficial está indisponível neste momento."}
          </small>
          {errors.state && <small id="error-state">{errors.state}</small>}
          {statesUnavailable && (
            <p className="civic-status" role="status">
              Não foi possível carregar os estados do IBGE; você pode informar a
              UF manualmente.
            </p>
          )}
        </div>
      )}

      {municipalities.length > 0 && !manualMunicipalities ? (
        <div className="civic-field">
          <label htmlFor="field-municipality-code">Município do projeto</label>
          <select
            id="field-municipality-code"
            value={municipalityCode}
            onChange={event => chooseMunicipality(event.target.value)}
            aria-invalid={errors.municipalityCode ? "true" : undefined}
            aria-describedby={
              errors.municipalityCode
                ? "help-municipality error-municipality-code"
                : "help-municipality"
            }
          >
            <option value="">Selecione um município</option>
            {municipalities.map(item => {
              const code = String(item.id).padStart(7, "0");
              return (
                <option key={code} value={code}>
                  {item.nome}
                </option>
              );
            })}
          </select>
          <small id="help-municipality">
            Municípios oficiais do IBGE para a UF escolhida.
          </small>
          {errors.municipalityCode && (
            <small id="error-municipality-code">
              {errors.municipalityCode}
            </small>
          )}
        </div>
      ) : municipalitiesLoading && !manualMunicipalities ? (
        <div className="civic-field">
          <p className="civic-status" role="status">
            Carregando municípios oficiais da UF escolhida…
          </p>
          <button
            className="civic-button civic-button--secondary"
            type="button"
            onClick={() => setManualMunicipalities(true)}
          >
            Informar município manualmente
          </button>
        </div>
      ) : state ? (
        <>
          {municipalitiesLoading && manualMunicipalities && (
            <p className="civic-status" role="status">
              A lista continua carregando; você escolheu preencher o município
              manualmente.
            </p>
          )}
          {municipalitiesUnavailable && (
            <p className="civic-status" role="status">
              Não foi possível carregar os municípios do IBGE; informe o nome e
              o código oficial manualmente.
            </p>
          )}
          <div className="civic-field">
            <label htmlFor="field-municipality">Município</label>
            <input
              id="field-municipality"
              value={municipality}
              onChange={event => onChange("municipality", event.target.value)}
              aria-invalid={errors.municipality ? "true" : undefined}
              aria-describedby={
                errors.municipality
                  ? "help-manual-municipality error-municipality"
                  : "help-manual-municipality"
              }
            />
            <small id="help-manual-municipality">
              Se a lista estiver indisponível, informe o nome e o código IBGE de
              sete dígitos.
            </small>
            {errors.municipality && (
              <small id="error-municipality">{errors.municipality}</small>
            )}
          </div>
          <div className="civic-field">
            <label htmlFor="field-municipality-code">
              Código IBGE do município
            </label>
            <input
              id="field-municipality-code"
              inputMode="numeric"
              maxLength={7}
              value={municipalityCode}
              onChange={event => onChange("municipalityCode", event.target.value)}
              aria-invalid={errors.municipalityCode ? "true" : undefined}
              aria-describedby={
                errors.municipalityCode
                  ? "help-municipality-code error-municipality-code"
                  : "help-municipality-code"
              }
            />
            <small id="help-municipality-code">
              Use o código oficial de sete dígitos. A lista está indisponível ou
              você escolheu o preenchimento manual.
            </small>
            {errors.municipalityCode && (
              <small id="error-municipality-code">
                {errors.municipalityCode}
              </small>
            )}
          </div>
        </>
      ) : municipalitiesLoading ? (
        <div className="civic-field">
          <p className="civic-status" role="status">
            Carregando municípios oficiais da UF escolhida…
          </p>
          <button
            className="civic-button civic-button--secondary"
            type="button"
            onClick={() => setManualMunicipalities(true)}
          >
            Informar município manualmente
          </button>
        </div>
      ) : (
        <div className="civic-field">
          <label htmlFor="field-municipality-code">Município do projeto</label>
          <select
            id="field-municipality-code"
            value=""
            disabled
            aria-describedby="help-municipality"
          >
            <option value="">Selecione primeiro uma UF</option>
          </select>
          <small id="help-municipality">
            A lista oficial será carregada depois que você escolher uma UF.
          </small>
        </div>
      )}
    </fieldset>
  );
}
