import React, {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { civicApi, CivicApiError } from "./api";
import { LocalityPicker } from "./LocalityPicker";
import type {
  ClaimCategory,
  ClaimRelation,
  ClaimType,
  CreateClaimInput,
  CreateProposalInput,
  CivicComment,
  CivicMediaView,
  DossierClaim,
  LegislativeMatch,
  ProposalDetail,
  ProposalKind,
  ProposalListItem,
  PublicAnalytics,
  PublicGraph,
  RelatedProposal,
  VoteChoice,
} from "@shared/civic/contracts";
import { GraphView } from "./GraphView";
import { resolveLegislativeSearchState } from "./legislative-search-state";
import {
  getFieldErrorTargetId,
  getRelatedValidation,
  getStepErrors,
} from "./suggestion-validation";

const kindLabels: Record<ProposalKind, string> = {
  public_work: "Obra pública",
  legislative_change: "Mudança legislativa",
  public_service: "Serviço público",
};

const kindDescriptions: Record<ProposalKind, string> = {
  public_work: "Espaço, obra ou manutenção de uso público.",
  legislative_change: "Mudança em regra, lei ou política pública.",
  public_service: "Atendimento, serviço ou funcionamento público.",
};

const voteLabels: Record<VoteChoice, string> = {
  support: "Apoiar",
  oppose: "Discordar",
  need_information: "Preciso de mais informações",
};

const stanceLabels: Record<CivicComment["stance"], string> = {
  supporting_evidence: "Evidência favorável",
  challenging_evidence: "Evidência contrária",
  question: "Pergunta",
  other: "Outro comentário",
};

const claimCategoryLabels: Record<ClaimCategory, string> = {
  authority: "Órgão ou competência",
  contact: "Contato institucional",
  cost: "Custo",
  timeline: "Cronograma",
  legislation: "Legislação",
  jurisprudence: "Jurisprudência",
  other: "Outro",
};

const claimTypeLabels: Record<ClaimType, string> = {
  participant_report: "Relato de participante",
  documented_fact: "Fato documentado",
  hypothesis: "Hipótese",
  estimate: "Estimativa",
  projection: "Projeção",
  missing_information: "Lacuna",
};

const claimRelationLabels: Record<ClaimRelation, string> = {
  supports: "Apoia",
  challenges: "Questiona",
  context: "Dá contexto",
  unknown: "Ainda não confirmada",
};

type CreateProposalWithInitialClaims = CreateProposalInput & {
  initialClaims?: CreateClaimInput[];
};

type DossierClaimWithSubmission = DossierClaim & {
  submittedAt: number;
  checkedAt: number | null;
};

function emptyInitialClaim(): CreateClaimInput {
  return { category: "other", type: "participant_report", relation: "unknown", statement: "" };
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeInitialClaim(claim: CreateClaimInput): CreateClaimInput {
  return {
    category: claim.category,
    type: claim.type,
    relation: claim.relation,
    statement: claim.statement.trim(),
    ...(claim.sourceTitle?.trim() ? { sourceTitle: claim.sourceTitle.trim() } : {}),
    ...(claim.sourceUrl?.trim() ? { sourceUrl: claim.sourceUrl.trim() } : {}),
    ...(claim.sourceExcerpt?.trim() ? { sourceExcerpt: claim.sourceExcerpt.trim() } : {}),
    ...(claim.jurisdiction?.trim() ? { jurisdiction: claim.jurisdiction.trim() } : {}),
    ...(claim.sourceDate?.trim() ? { sourceDate: claim.sourceDate.trim() } : {}),
  };
}

function getInitialClaimErrors(claims: CreateClaimInput[]) {
  const errors: Record<string, string> = {};
  claims.forEach((claim, index) => {
    const prefix = `initialClaim-${index}`;
    if (!claim.statement.trim()) errors[`${prefix}-statement`] = "Escreva o texto desta evidência ou remova o item.";
    if (claim.sourceUrl?.trim() && !isHttpsUrl(claim.sourceUrl.trim())) {
      errors[`${prefix}-sourceUrl`] = "Informe uma URL HTTPS válida; a página não será consultada automaticamente.";
    }
    if (claim.type === "documented_fact") {
      if (!claim.sourceTitle?.trim()) errors[`${prefix}-sourceTitle`] = "Para um fato documentado, informe o título da fonte.";
      if (!claim.sourceUrl?.trim()) errors[`${prefix}-sourceUrl`] = "Para um fato documentado, informe uma URL HTTPS.";
      else if (!isHttpsUrl(claim.sourceUrl.trim())) errors[`${prefix}-sourceUrl`] = "Para um fato documentado, informe uma URL HTTPS válida.";
    }
  });
  return errors;
}

function datePtBr(value: number | null | undefined) {
  if (value === null || value === undefined) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function errorText(error: unknown) {
  if (error instanceof CivicApiError && error.code?.startsWith("official_source_")) {
    return "A fonte oficial está indisponível ou não respondeu. Isso não significa que não existam registros; tente novamente mais tarde.";
  }
  return error instanceof CivicApiError ? error.message : "Não foi possível carregar este conteúdo. Tente novamente.";
}

const locationNotProvidedLabel = "Local não informado";
const locationUnverifiedLabel = "Local informado pela comunidade; não confirmado pela plataforma";

function proposalLocationLabel(
  proposal: Pick<ProposalListItem, "municipality" | "state" | "regionStatus">,
) {
  if (proposal.regionStatus === "not_provided" || (!proposal.municipality && !proposal.state)) {
    return locationNotProvidedLabel;
  }
  const locality = [proposal.municipality, proposal.state].filter(Boolean).join(" · ");
  return locality ? `${locationUnverifiedLabel} · ${locality}` : locationUnverifiedLabel;
}

function pagePath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname.replace(/\/$/, "") || "/";
}

function navigateHref(path: string) {
  return path;
}

function PageMessage({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "note" | "success" }) {
  return (
    <div className={`civic-note civic-note--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

function Loading({ label = "Carregando dados reais…" }: { label?: string }) {
  return <p className="civic-loading" role="status" aria-live="polite">{label}</p>;
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="civic-empty" role="status">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

function CivicHeader({ path }: { path: string }) {
  const links = [
    ["/propostas", "Explorar propostas"],
    ["/sugerir", "Fazer uma sugestão"],
    ["/mapa", "Mapa"],
    ["/dados", "Dados"],
    ["/conexoes", "Conexões"],
  ] as const;
  return (
    <>
      <a className="civic-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a>
      <header className="civic-header">
        <div className="civic-header-inner">
          <a className="civic-brand" href={navigateHref("/")}>
            <span className="civic-mark" aria-hidden="true">↗</span>
            <span>Cívica</span>
            <span className="civic-brand-note">experimental</span>
          </a>
          <nav className="civic-nav" aria-label="Navegação principal">
            {links.map(([href, label]) => (
              <a key={href} href={navigateHref(href)} aria-current={path === href ? "page" : undefined}>{label}</a>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}

function CivicFooter() {
  return (
    <footer className="civic-footer">
      <span>Participação experimental por sessão, sem promessa de representatividade.</span>
      <span><a href="/metodologia">Metodologia</a> · <a href="/privacidade">Privacidade</a> · <a href="/acessibilidade">Acessibilidade</a></span>
    </footer>
  );
}

function ProposalCard({ proposal }: { proposal: ProposalListItem }) {
  return (
    <a className="civic-proposal-card" href={`/propostas/${encodeURIComponent(proposal.id)}`}>
      <span className="civic-tag">{kindLabels[proposal.kind]}</span>
      <h2>{proposal.title}</h2>
      <p>{proposal.summary}</p>
      <div className="civic-proposal-meta">
        <span>{proposalLocationLabel(proposal)}</span>
        <span>{proposal.commentCount} comentário(s)</span>
        <span>{proposal.relatedCount} relação(ões)</span>
        <span>Publicado em {datePtBr(proposal.createdAt)}</span>
      </div>
    </a>
  );
}

function ProposalList({ proposals }: { proposals: ProposalListItem[] }) {
  if (!proposals.length) {
    return <Empty title="Ainda não há propostas públicas para esta consulta.">Você pode fazer uma sugestão; nenhum exemplo é criado para preencher a tela.</Empty>;
  }
  return <div className="civic-list">{proposals.map(item => <ProposalCard key={item.id} proposal={item} />)}</div>;
}

function HomePage() {
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void civicApi.proposals()
      .then(value => { if (active) setProposals(value); })
      .catch(value => { if (active) setError(errorText(value)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);
  return (
    <div className="civic-page civic-home">
      <PageMessage tone="note">Demonstração em Preview, não serviço público oficial. Propostas, comentários e fontes enviados podem ser lidos por qualquer pessoa com acesso a este Preview. Não inclua dados pessoais ou conteúdo identificável; ainda não há moderação, denúncia ou retirada operacional.</PageMessage>
      <div className="civic-home-grid">
        <section className="civic-home-copy" aria-labelledby="page-title">
          <p className="civic-kicker">Cívica · demonstração</p>
          <h1 id="page-title" tabIndex={-1}>Compreender propostas. Participar com transparência.</h1>
          <p className="civic-lede">Leia problemas e mudanças sugeridas, consulte as fontes disponíveis e escolha como participar. O fluxo funciona sem cadastro e explica o que a amostra experimental pode — e não pode — dizer.</p>
          <div className="civic-actions">
            <a className="civic-button" href="/propostas">Explorar propostas</a>
            <a className="civic-button civic-button--secondary" href="/sugerir">Fazer uma sugestão</a>
          </div>
        </section>
        <aside className="civic-home-aside" aria-labelledby="home-note-title">
          <p className="civic-kicker">Antes de participar</p>
          <h2 id="home-note-title">Uma sessão experimental não é uma pessoa verificada.</h2>
          <p className="civic-muted">Votos servem para testar o fluxo e aparecem somente como totais quando a amostra permite. Comentários usam pseudônimo separado do voto.</p>
          <a className="civic-text-link" href="/metodologia">Leia os limites e o método</a>
        </aside>
      </div>
      <section className="civic-section" aria-labelledby="home-proposals-title">
        <p className="civic-kicker">Acervo consultado</p>
        <h2 id="home-proposals-title">Propostas públicas</h2>
        {error ? (
          <PageMessage>{error} <button className="civic-button civic-button--quiet" type="button" onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</button></PageMessage>
        ) : loading ? (
          <Loading label="Carregando propostas públicas…" />
        ) : (
          <ProposalList proposals={proposals} />
        )}
      </section>
      <section className="civic-section" aria-labelledby="home-actions-title">
        <p className="civic-kicker">Outras formas de compreender</p>
        <h2 id="home-actions-title">Escolha a leitura que funciona para você</h2>
        <div className="civic-card-grid">
          <article className="civic-card civic-card--action"><div><h3>Mapa e lista</h3><p className="civic-muted">Veja apenas locais fornecidos por propostas reais. A lista textual permanece disponível.</p></div><a className="civic-text-link" href="/mapa">Abrir mapa e lista</a></article>
          <article className="civic-card civic-card--action"><div><h3>Dados e comparações</h3><p className="civic-muted">Consulte métricas agregadas, período, atualização e suas limitações.</p></div><a className="civic-text-link" href="/dados">Abrir dados</a></article>
          <article className="civic-card civic-card--action"><div><h3>Conexões documentadas</h3><p className="civic-muted">O grafo só aparece com perfis verificados pelo acervo real e tem uma tabela equivalente.</p></div><a className="civic-text-link" href="/conexoes">Abrir conexões</a></article>
        </div>
      </section>
    </div>
  );
}

function ProposalsPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true); setError(null);
    try { setProposals(await civicApi.proposals({ query: query.trim() || undefined, kind: (kind || undefined) as ProposalKind | undefined, municipalityCode: municipalityCode.trim() || undefined })); }
    catch (value) { setError(errorText(value)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  return (
    <div className="civic-page">
      <header className="civic-page-head">
        <p className="civic-kicker">Explorar</p>
        <h1 id="page-title" tabIndex={-1}>Propostas públicas</h1>
        <p className="civic-lede">Pesquise pelo assunto e filtre por tipo ou município. A lista é a forma principal de acesso; nenhum mapa ou gráfico é necessário.</p>
      </header>
      <form className="civic-filter-bar" onSubmit={load} aria-label="Filtrar propostas">
        <div className="civic-field"><label htmlFor="proposal-query">Buscar no título e resumo</label><input id="proposal-query" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="civic-field"><label htmlFor="proposal-kind">Tipo</label><select id="proposal-kind" value={kind} onChange={event => setKind(event.target.value)}><option value="">Todos os tipos</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="civic-field"><label htmlFor="proposal-municipality">Código do município</label><input id="proposal-municipality" value={municipalityCode} onChange={event => setMunicipalityCode(event.target.value)} /><small>Use se você já souber o código.</small></div>
        <button className="civic-button" type="submit" disabled={loading}>{loading ? "Consultando…" : "Aplicar filtros"}</button>
      </form>
      <div className="civic-status" aria-live="polite">{loading ? "Consultando propostas reais…" : `${proposals.length} resultado(s) nesta consulta.`}</div>
      {error ? <PageMessage>{error} <button className="civic-button civic-button--quiet" type="button" onClick={() => void load()}>Tentar novamente</button></PageMessage> : null}
      {!loading && !error ? <ProposalList proposals={proposals} /> : null}
    </div>
  );
}

type PhotoDraft = { file: File; altText: string; previewUrl: string };
type SuggestionDraft = {
  kind: ProposalKind;
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
  precision: "municipality" | "approximate_area";
  publicNotice: boolean;
  initialClaims: CreateClaimInput[];
};

const emptyDraft: SuggestionDraft = {
  kind: "public_service", title: "", summary: "", description: "", desiredChange: "",
  locationIncluded: false, municipalityCode: "", municipality: "", state: "", areaLabel: "", publicLocation: "", precision: "approximate_area", publicNotice: false, initialClaims: [],
};

function suggestionLocationLabel(draft: SuggestionDraft) {
  if (!draft.locationIncluded) return locationNotProvidedLabel;
  const locality = [draft.areaLabel, draft.municipality, draft.state].filter(Boolean).join(" · ");
  return locality ? `${locationUnverifiedLabel} · ${locality}` : locationUnverifiedLabel;
}

function suggestionRegion(draft: SuggestionDraft) {
  if (!draft.locationIncluded) return null;
  return {
    ...(draft.municipalityCode.trim() ? { municipalityCode: draft.municipalityCode.trim() } : {}),
    municipality: draft.municipality.trim(),
    state: draft.state.trim().toUpperCase(),
    areaLabel: draft.areaLabel.trim() || undefined,
    precision: draft.precision,
  };
}

function proposalRegionLabel(region: ProposalDetail["region"]) {
  if (!region) return locationNotProvidedLabel;
  const locality = [region.areaLabel, region.municipality, region.state].filter(Boolean).join(" · ");
  const precision = region.precision === "approximate_area" ? " · área aproximada" : "";
  return `${locationUnverifiedLabel}${locality ? ` · ${locality}` : ""}${precision}`;
}

function FieldErrorSummary({ errors }: { errors: Record<string, string> }) {
  if (Object.keys(errors).length === 0) return null;
  return (
    <div className="civic-error-list" role="alert">
      <strong>Há {Object.keys(errors).length} ponto(s) para corrigir.</strong>
      <ul>
        {Object.entries(errors).map(([field, message]) => (
          <li key={field}>
            <a href={`#${field.startsWith("initialClaim-") ? `field-${field}` : getFieldErrorTargetId(field)}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SuggestionDraft>(emptyDraft);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [related, setRelated] = useState<RelatedProposal[] | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function setField<K extends keyof SuggestionDraft>(field: K, value: SuggestionDraft[K]) {
    setDraft(current => ({ ...current, [field]: value }));
    setErrors(current => { const next = { ...current }; delete next[field]; return next; });
  }

  function updateInitialClaim<K extends keyof CreateClaimInput>(index: number, field: K, value: CreateClaimInput[K]) {
    setDraft(current => ({
      ...current,
      initialClaims: current.initialClaims.map((claim, claimIndex) => claimIndex === index ? { ...claim, [field]: value } : claim),
    }));
    setErrors(current => {
      const next = { ...current };
      Object.keys(next).filter(key => key.startsWith(`initialClaim-${index}-`)).forEach(key => delete next[key]);
      return next;
    });
  }

  function addInitialClaim() {
    setDraft(current => current.initialClaims.length >= 5 ? current : { ...current, initialClaims: [...current.initialClaims, emptyInitialClaim()] });
    setErrors({});
    setStatus(null);
  }

  function removeInitialClaim(index: number) {
    setDraft(current => ({ ...current, initialClaims: current.initialClaims.filter((_, claimIndex) => claimIndex !== index) }));
    setErrors({});
  }

  function setLocationIncluded(value: boolean) {
    setDraft(current => ({
      ...current,
      locationIncluded: value,
      ...(value ? {} : {
        municipalityCode: "",
        municipality: "",
        state: "",
        areaLabel: "",
        publicLocation: "",
      }),
    }));
    setErrors({});
  }

  function validateStep(target: number) {
    const next = getStepErrors(target, draft);
    if (target === 3 || target === 4) Object.assign(next, getInitialClaimErrors(draft.initialClaims));
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (validateStep(step)) setStep(current => Math.min(4, current + 1));
  }

  function previousStep() { setErrors({}); setStep(current => Math.max(1, current - 1)); }

  function addPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setStatus("Escolha uma foto JPG, PNG ou WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { setStatus("A foto ultrapassa o limite inicial de 5 MB."); return; }
    const previewUrl = typeof URL === "undefined" ? "" : URL.createObjectURL(file);
    setPhotos(current => [...current, { file, altText: "", previewUrl }]);
    setStatus("Foto adicionada ao rascunho. Ela ainda não foi enviada.");
  }

  function removePhoto(index: number) {
    setPhotos(current => { const photo = current[index]; if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl); return current.filter((_, itemIndex) => itemIndex !== index); });
  }

  function updatePhotoAlt(index: number, altText: string) { setPhotos(current => current.map((photo, photoIndex) => photoIndex === index ? { ...photo, altText } : photo)); }

  async function findRelated() {
    const validation = getRelatedValidation(draft);
    setErrors(validation.errors);
    if (validation.firstInvalidStep !== null) {
      setStep(validation.firstInvalidStep);
      return;
    }
    setRelatedLoading(true); setStatus(null);
    try { setRelated(await civicApi.related({ kind: draft.kind, title: draft.title, summary: draft.summary, description: draft.description, region: suggestionRegion(draft) })); }
    catch (value) { setStatus(errorText(value)); }
    finally { setRelatedLoading(false); }
  }

  async function publish() {
    if (!validateStep(4)) {
      if (Object.keys(getInitialClaimErrors(draft.initialClaims)).length) setStep(3);
      return;
    }
    setSending(true); setStatus(null);
    const normalizedClaims = draft.initialClaims.map(normalizeInitialClaim);
    const input: CreateProposalWithInitialClaims = {
      kind: draft.kind, title: draft.title.trim(), summary: draft.summary.trim(), description: draft.description.trim(), desiredChange: draft.desiredChange.trim(),
      region: suggestionRegion(draft),
      ...(draft.locationIncluded && draft.publicLocation.trim() ? { publicLocation: draft.publicLocation.trim() } : {}),
      ...(normalizedClaims.length ? { initialClaims: normalizedClaims } : {}),
      acceptPublicPreview: true,
    };
    try {
      const result = await civicApi.createProposal(input);
      setCreatedId(result.id);
      setStatus(photos.length ? "Proposta criada. As fotos permaneceram como prévias locais e não foram enviadas; esta versão não tem revisão humana de imagens." : "Proposta criada. O conteúdo poderá ser visto por quem acessar este protótipo.");
    } catch (value) { setStatus(errorText(value)); }
    finally { setSending(false); }
  }

  if (createdId) {
    return <div className="civic-page"><header className="civic-page-head"><p className="civic-kicker">Envio concluído</p><h1 id="page-title" tabIndex={-1}>Sua proposta foi recebida.</h1><p className="civic-lede">Ela está no acervo do protótipo e pode ser vista por outras pessoas. Votos e comentários continuam sendo experimentais.</p></header><div className="civic-actions"><a className="civic-button" href={`/propostas/${encodeURIComponent(createdId)}`}>Ler a proposta</a><a className="civic-button civic-button--secondary" href="/propostas">Voltar para propostas</a></div>{status && <p className="civic-status" role="status">{status}</p>}</div>;
  }

  return (
    <div className="civic-page">
      <header className="civic-page-head">
        <p className="civic-kicker">Fazer uma sugestão · etapa {step} de 4</p>
        <h1 id="page-title" tabIndex={-1}>O que você gostaria de mudar?</h1>
        <p className="civic-lede">Conte o problema com palavras simples. Você revisa tudo antes de publicar; nenhum campo de identificação civil é necessário.</p>
      </header>
      <div className="civic-stepper" aria-label={`Etapa ${step} de 4`}>
        {(["O que precisa mudar", "Onde se aplica", "Fotos e relações", "Revisar e publicar"] as const).map((label, index) => <span className="civic-step" key={label} aria-current={step === index + 1 ? "step" : undefined}>{index + 1}. {label}</span>)}
      </div>
      <div className="civic-form-layout">
        <form className="civic-form" onSubmit={event => { event.preventDefault(); if (step < 4) nextStep(); else void publish(); }} noValidate>
          <FieldErrorSummary errors={errors} />
          {step === 1 && <>
            <section className="civic-form-section" aria-labelledby="suggestion-type-title"><h2 id="suggestion-type-title">Primeiro, escolha o tipo</h2><fieldset className="civic-fieldset"><legend className="civic-help">Isso ajuda outras pessoas a entenderem o assunto.</legend><div className="civic-radio-grid">{(Object.keys(kindLabels) as ProposalKind[]).map(option => <label className="civic-radio-card" key={option}><input type="radio" name="kind" checked={draft.kind === option} onChange={() => setField("kind", option)} /><strong>{kindLabels[option]}</strong><span>{kindDescriptions[option]}</span></label>)}</div></fieldset></section>
            <section className="civic-form-section" aria-labelledby="suggestion-text-title"><h2 id="suggestion-text-title">Explique a ideia</h2><details className="civic-help-panel"><summary>Se for difícil explicar, responda a estas perguntas</summary><ul><li>O que está acontecendo ou faltando?</li><li>Onde isso acontece?</li><li>Quem ou o que é afetado?</li><li>O que você gostaria que mudasse?</li></ul><p>Você pode usar frases curtas ou pedir a alguém de confiança para registrar suas palavras. Não precisa conhecer leis nem orçamento.</p></details><div className="civic-field"><label htmlFor="field-title">Título curto</label><input id="field-title" value={draft.title} onChange={event => setField("title", event.target.value)} aria-invalid={errors.title ? "true" : undefined} aria-describedby="help-title error-title" /><small id="help-title">Exemplo: uma frase que diga o que precisa mudar.</small>{errors.title && <small id="error-title">{errors.title}</small>}</div><div className="civic-field"><label htmlFor="field-summary">Resumo</label><textarea id="field-summary" value={draft.summary} onChange={event => setField("summary", event.target.value)} aria-invalid={errors.summary ? "true" : undefined} aria-describedby="help-summary error-summary" /><small id="help-summary">Um parágrafo para quem está conhecendo o assunto.</small>{errors.summary && <small id="error-summary">{errors.summary}</small>}</div><div className="civic-field"><label htmlFor="field-description">O que aconteceu ou qual é a necessidade?</label><textarea id="field-description" value={draft.description} onChange={event => setField("description", event.target.value)} aria-invalid={errors.description ? "true" : undefined} aria-describedby="error-description" />{errors.description && <small id="error-description">{errors.description}</small>}</div><div className="civic-field"><label htmlFor="field-desired-change">Qual mudança você gostaria de ver?</label><textarea id="field-desired-change" value={draft.desiredChange} onChange={event => setField("desiredChange", event.target.value)} aria-invalid={errors.desiredChange ? "true" : undefined} aria-describedby="error-desired-change" />{errors.desiredChange && <small id="error-desired-change">{errors.desiredChange}</small>}</div></section>
          </>}
          {step === 2 && (
            <section className="civic-form-section" aria-labelledby="suggestion-place-title">
              <h2 id="suggestion-place-title">Onde isso se aplica?</h2>
              <p className="civic-help">Informe o local do projeto, não sua residência. Não usamos GPS ou localização automática.</p>
              <fieldset className="civic-fieldset" aria-describedby="help-location-choice">
                <legend>Você quer informar uma localidade?</legend>
                <p id="help-location-choice" className="civic-help">A localidade é fornecida pela comunidade e ainda não é confirmada pela plataforma.</p>
                <div className="civic-radio-grid">
                  <label className="civic-radio-card" htmlFor="field-location-included-yes">
                    <input id="field-location-included-yes" type="radio" name="location-included" checked={draft.locationIncluded} onChange={() => setLocationIncluded(true)} />
                    <strong>Informar o local</strong>
                    <span>Escolha esta opção se souber a UF e o município. O código IBGE é opcional.</span>
                  </label>
                  <label className="civic-radio-card" htmlFor="field-location-included-no">
                    <input id="field-location-included-no" type="radio" name="location-included" checked={!draft.locationIncluded} onChange={() => setLocationIncluded(false)} />
                    <strong>Ainda não sei / prefiro não informar</strong>
                    <span>Você pode avançar e procurar relações sem compartilhar uma localidade.</span>
                  </label>
                </div>
              </fieldset>
              {draft.locationIncluded && <>
                <p className="civic-help">UF e município são necessários; o código IBGE é opcional. Sem código, a localidade continua sendo uma informação da comunidade, mas não entra em filtros ou agregados que dependam do código nem em proximidade geográfica.</p>
                <LocalityPicker
                  state={draft.state}
                  municipality={draft.municipality}
                  municipalityCode={draft.municipalityCode}
                  errors={errors}
                  onChange={(field, value) => {
                    if (field === "state") setField("state", value);
                    else if (field === "municipality") setField("municipality", value);
                    else setField("municipalityCode", value);
                  }}
                />
                <div className="civic-field">
                  <label htmlFor="field-area">Bairro, área ou referência</label>
                  <input id="field-area" value={draft.areaLabel} onChange={event => setField("areaLabel", event.target.value)} aria-invalid={errors.areaLabel ? "true" : undefined} aria-describedby="help-area error-area" />
                  <small id="help-area">Prefira uma área aproximada quando o endereço exato puder expor alguém.</small>
                  {errors.areaLabel && <small id="error-area">{errors.areaLabel}</small>}
                </div>
                <div className="civic-field">
                  <label htmlFor="field-public-location">Referência pública opcional</label>
                  <input id="field-public-location" value={draft.publicLocation} onChange={event => setField("publicLocation", event.target.value)} />
                  <small>Não inclua endereço residencial, telefone ou documento.</small>
                </div>
                <div className="civic-field">
                  <label htmlFor="field-precision">Precisão a compartilhar</label>
                  <select id="field-precision" value={draft.precision} onChange={event => setField("precision", event.target.value as SuggestionDraft["precision"]) }>
                    <option value="approximate_area">Área aproximada</option>
                    <option value="municipality">Somente município</option>
                  </select>
                </div>
              </>}
            </section>
          )}
          {step === 3 && <>
            <section className="civic-form-section" aria-labelledby="suggestion-photo-title"><h2 id="suggestion-photo-title">Foto opcional</h2><p className="civic-help">JPG, PNG ou WebP, até 5 MB por foto. Esta versão mantém a foto somente como prévia no seu navegador; ela não é enviada nem publicada, pois ainda não há revisão humana de imagens. Não envie rostos de terceiros, crianças, placas, documentos ou endereços residenciais. Escreva uma descrição para acompanhar a prévia.</p><div className="civic-field"><label htmlFor="field-photo">Adicionar uma foto</label><input id="field-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={addPhoto} /><small>Você pode remover a prévia. A imagem não será transmitida nesta versão.</small></div>{photos.map((photo, index) => <div className="civic-card" key={`${photo.file.name}-${index}`}><div className="civic-preview">{photo.previewUrl && <img src={photo.previewUrl} alt="Prévia da foto escolhida" />}<label className="civic-field" htmlFor={`photo-alt-${index}`}>Descrição da foto<input id={`photo-alt-${index}`} value={photo.altText} onChange={event => updatePhotoAlt(index, event.target.value)} placeholder="Descreva o que é importante nesta foto" /></label><button className="civic-button civic-button--danger" type="button" onClick={() => removePhoto(index)}>Remover esta foto</button></div></div>)}</section>
            <section className="civic-form-section" aria-labelledby="suggestion-evidence-title">
              <h2 id="suggestion-evidence-title">Evidências opcionais</h2>
              <p className="civic-help">Você pode continuar sem adicionar nada. Se quiser, escreva um relato, uma dúvida ou uma informação que ajude a entender a proposta. Não precisa saber produzir uma evidência nem ter uma fonte.</p>
              <p className="civic-help">Os itens serão publicados como <strong>enviado pela comunidade</strong>. A plataforma não busca a URL nem confirma seu conteúdo automaticamente.</p>
              {draft.initialClaims.map((claim, index) => {
                const fieldPrefix = `initialClaim-${index}`;
                const statementId = `field-${fieldPrefix}-statement`;
                const sourceTitleId = `field-${fieldPrefix}-sourceTitle`;
                const sourceUrlId = `field-${fieldPrefix}-sourceUrl`;
                return <article className="civic-card" key={index}>
                  <h3>Evidência {index + 1}</h3>
                  <div className="civic-field"><label htmlFor={`field-${fieldPrefix}-category`}>Categoria da evidência {index + 1}</label><select id={`field-${fieldPrefix}-category`} value={claim.category} onChange={event => updateInitialClaim(index, "category", event.target.value as ClaimCategory)}>{Object.entries(claimCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="civic-field"><label htmlFor={`field-${fieldPrefix}-type`}>Natureza da evidência {index + 1}</label><select id={`field-${fieldPrefix}-type`} value={claim.type} onChange={event => updateInitialClaim(index, "type", event.target.value as ClaimType)}>{Object.entries(claimTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  {claim.type === "documented_fact" && <p className="civic-help">“Fato documentado” significa que você está apontando para um registro ou documento específico. Isso não quer dizer que a plataforma conferiu o conteúdo: para usar essa natureza, informe o título e uma URL HTTPS.</p>}
                  <div className="civic-field"><label htmlFor={`field-${fieldPrefix}-relation`}>Relação com a proposta {index + 1}</label><select id={`field-${fieldPrefix}-relation`} value={claim.relation} onChange={event => updateInitialClaim(index, "relation", event.target.value as ClaimRelation)}>{Object.entries(claimRelationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="civic-field"><label htmlFor={statementId}>Texto da evidência {index + 1}</label><textarea id={statementId} value={claim.statement} onChange={event => updateInitialClaim(index, "statement", event.target.value)} aria-invalid={errors[`${fieldPrefix}-statement`] ? "true" : undefined} aria-describedby={errors[`${fieldPrefix}-statement`] ? `${statementId}-error` : undefined} /><small>Descreva o relato, a hipótese, a estimativa ou a informação que ainda falta.</small>{errors[`${fieldPrefix}-statement`] && <small id={`${statementId}-error`}>{errors[`${fieldPrefix}-statement`]}</small>}</div>
                  <div className="civic-field"><label htmlFor={sourceTitleId}>Título da fonte {index + 1} (opcional)</label><input id={sourceTitleId} value={claim.sourceTitle ?? ""} onChange={event => updateInitialClaim(index, "sourceTitle", event.target.value)} aria-invalid={errors[`${fieldPrefix}-sourceTitle`] ? "true" : undefined} aria-describedby={errors[`${fieldPrefix}-sourceTitle`] ? `${sourceTitleId}-error` : undefined} />{errors[`${fieldPrefix}-sourceTitle`] && <small id={`${sourceTitleId}-error`}>{errors[`${fieldPrefix}-sourceTitle`]}</small>}</div>
                  <div className="civic-field"><label htmlFor={sourceUrlId}>URL da fonte {index + 1} (opcional)</label><input id={sourceUrlId} type="url" value={claim.sourceUrl ?? ""} onChange={event => updateInitialClaim(index, "sourceUrl", event.target.value)} aria-invalid={errors[`${fieldPrefix}-sourceUrl`] ? "true" : undefined} aria-describedby={errors[`${fieldPrefix}-sourceUrl`] ? `${sourceUrlId}-error` : undefined} /><small>A URL precisa começar com https:// quando informada; ela não será buscada nem validada como conteúdo.</small>{errors[`${fieldPrefix}-sourceUrl`] && <small id={`${sourceUrlId}-error`}>{errors[`${fieldPrefix}-sourceUrl`]}</small>}</div>
                  <div className="civic-field"><label htmlFor={`field-${fieldPrefix}-sourceExcerpt`}>Trecho da fonte {index + 1} (opcional)</label><textarea id={`field-${fieldPrefix}-sourceExcerpt`} value={claim.sourceExcerpt ?? ""} onChange={event => updateInitialClaim(index, "sourceExcerpt", event.target.value)} /></div>
                  <div className="civic-field"><label htmlFor={`field-${fieldPrefix}-jurisdiction`}>Jurisdição ou local da fonte {index + 1} (opcional)</label><input id={`field-${fieldPrefix}-jurisdiction`} value={claim.jurisdiction ?? ""} onChange={event => updateInitialClaim(index, "jurisdiction", event.target.value)} /></div>
                  <div className="civic-field"><label htmlFor={`field-${fieldPrefix}-sourceDate`}>Data da fonte {index + 1} (opcional)</label><input id={`field-${fieldPrefix}-sourceDate`} type="date" value={claim.sourceDate ?? ""} onChange={event => updateInitialClaim(index, "sourceDate", event.target.value)} /></div>
                  <button className="civic-button civic-button--danger" type="button" onClick={() => removeInitialClaim(index)}>Remover evidência {index + 1}</button>
                </article>;
              })}
              <div className="civic-actions"><button className="civic-button civic-button--secondary" type="button" onClick={addInitialClaim} disabled={draft.initialClaims.length >= 5}>{draft.initialClaims.length >= 5 ? "Limite de 5 evidências atingido" : "Adicionar evidência"}</button></div>
              <p className="civic-small">Você pode adicionar até 5 itens. Campos de fonte, trecho, jurisdição e data são opcionais, exceto título e URL HTTPS quando a natureza escolhida for “Fato documentado”.</p>
            </section>
            <section className="civic-form-section" aria-labelledby="suggestion-related-title"><h2 id="suggestion-related-title">Você quer procurar uma proposta relacionada?</h2><p className="civic-help">A consulta é opcional. Ela pode encontrar textos parecidos; você decide se quer abrir uma delas, complementar a ideia ou continuar com uma proposta nova. Nada é fundido automaticamente.</p><div className="civic-actions"><button className="civic-button civic-button--secondary" type="button" onClick={() => void findRelated()} disabled={relatedLoading}>{relatedLoading ? "Procurando…" : "Procurar relações"}</button></div>{related && <div className="civic-related" aria-live="polite">{related.length ? related.map(item => <div className="civic-related-item" key={item.proposal.id}><a href={`/propostas/${encodeURIComponent(item.proposal.id)}`}>Abrir esta proposta: {item.proposal.title}</a><p className="civic-small">{item.explanation} Termos compartilhados: {item.sharedTerms.join(", ") || "não informados"}.</p></div>) : <Empty title="Nenhuma relação foi encontrada.">Você pode continuar com uma proposta nova.</Empty>}</div>}</section>
          </>}
          {step === 4 && <section className="civic-form-section" aria-labelledby="suggestion-review-title"><h2 id="suggestion-review-title">Confira antes de publicar</h2><p className="civic-help">A proposta ficará visível para quem acessar o protótipo. Você pode voltar e corrigir os campos.</p><div className="civic-card"><span className="civic-tag">{kindLabels[draft.kind]}</span><h3>{draft.title || "Título ainda não preenchido"}</h3><p><strong>Resumo:</strong> {draft.summary || "Ainda não preenchido"}</p><p><strong>Problema:</strong> {draft.description || "Ainda não preenchido"}</p><p><strong>Mudança desejada:</strong> {draft.desiredChange || "Ainda não preenchido"}</p><p><strong>Local:</strong> {suggestionLocationLabel(draft)}</p><p><strong>Fotos:</strong> {photos.length ? `${photos.length} prévia(s) local(is); nenhuma foto será enviada` : "Nenhuma foto"}</p></div>{draft.initialClaims.length > 0 && <PageMessage tone="note">As evidências abaixo serão publicadas como <strong>enviado pela comunidade</strong>. No envio inicial, o status será <strong>community_submitted</strong> e <strong>checkedAt: null</strong>; nenhuma delas está rotulada como verificada.</PageMessage>}{draft.initialClaims.map((claim, index) => <article className="civic-card" key={index}><h3>Evidência {index + 1}</h3><dl><dt>Categoria</dt><dd>{claimCategoryLabels[claim.category]}</dd><dt>Natureza</dt><dd>{claimTypeLabels[claim.type]}</dd><dt>Relação</dt><dd>{claimRelationLabels[claim.relation]}</dd><dt>Texto</dt><dd className="civic-long-text">{claim.statement || "Não informado"}</dd><dt>Título da fonte</dt><dd>{claim.sourceTitle || "Não informado"}</dd><dt>URL da fonte</dt><dd>{claim.sourceUrl || "Não informado"}</dd><dt>Trecho da fonte</dt><dd className="civic-long-text">{claim.sourceExcerpt || "Não informado"}</dd><dt>Jurisdição ou local da fonte</dt><dd>{claim.jurisdiction || "Não informado"}</dd><dt>Data da fonte</dt><dd>{claim.sourceDate || "Não informado"}</dd></dl><p className="civic-small">Será exibida como enviado pela comunidade; não há conferência automática.</p></article>)}<label className="civic-radio-card" htmlFor="field-public-notice"><input id="field-public-notice" type="checkbox" checked={draft.publicNotice} onChange={event => setField("publicNotice", event.target.checked)} aria-invalid={errors.publicNotice ? "true" : undefined} aria-describedby={errors.publicNotice ? "error-public-notice" : undefined} /><strong>Entendi que o conteúdo poderá ser visto publicamente.</strong><span>O texto não será enviado até eu confirmar a ação final.</span></label>{errors.publicNotice && <small id="error-public-notice">{errors.publicNotice}</small>}</section>}
          {status && <p className="civic-status" role="status">{status}</p>}
          <div className="civic-form-actions"><div>{step > 1 && <button className="civic-button civic-button--quiet" type="button" onClick={previousStep}>Voltar e corrigir</button>}</div><button className="civic-button" type="submit" disabled={sending}>{sending ? "Enviando…" : step < 4 ? "Continuar" : "Publicar esta proposta"}</button></div>
        </form>
        <aside className="civic-sidebar" aria-label="Orientações da etapa"><div className="civic-sidebar-card"><h2>Sem pressa</h2><p>O rascunho fica nesta tela enquanto você avança. Voltar não apaga o que foi escrito.</p></div><div className="civic-sidebar-card"><h2>Sem identificação civil</h2><p>O protótipo não pede CPF, senha, acesso externo ou localização automática.</p></div><div className="civic-sidebar-card"><h2>Visibilidade</h2><p>Publicar aqui significa permitir leitura por quem acessar o Preview. Não inclua dados de outras pessoas.</p></div></aside>
      </div>
    </div>
  );
}

function ResultSummary({ result }: { result: ProposalDetail["result"] }) {
  if (!result.visible || !result.choices || result.total === null) {
    return <PageMessage tone="note">Os totais estão ocultos porque a amostra ainda não atingiu o limite de divulgação ou uma célula é pequena demais. Isso não significa ausência de opiniões.</PageMessage>;
  }
  const maximum = Math.max(1, ...Object.values(result.choices));
  return <div className="civic-result"><p className="civic-small">Total agregado: {result.total}. Voto experimental por sessão; não representa pessoas únicas.</p>{(Object.keys(voteLabels) as VoteChoice[]).map(choice => <div className="civic-result-row" key={choice}><span>{voteLabels[choice]}</span><div className="civic-result-bar" aria-hidden="true"><span style={{ width: `${(result.choices?.[choice] ?? 0) / maximum * 100}%` }} /></div><strong>{result.choices?.[choice] ?? 0}</strong></div>)}</div>;
}

function Comments({ proposalId, comments }: { proposalId: string; comments: CivicComment[] }) {
  const [stance, setStance] = useState<CivicComment["stance"]>("question");
  const [pseudonym, setPseudonym] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!pseudonym.trim() || !body.trim()) { setStatus("Informe um pseudônimo e escreva o comentário."); return; } setSending(true); setStatus(null); try { await civicApi.comment(proposalId, { stance, pseudonym: pseudonym.trim(), body: body.trim() }); setBody(""); setStatus("Comentário enviado para esta proposta."); } catch (value) { setStatus(errorText(value)); } finally { setSending(false); } }
  return <section className="civic-detail-section" aria-labelledby="comments-title"><h2 id="comments-title">Debate público</h2><p className="civic-small">O pseudônimo aparece separado do voto. Não exibimos ID de participante, escolha individual ou horário individualizado.</p><div className="civic-comment-list">{comments.length ? comments.map(comment => <article className="civic-comment" key={comment.id}><header><strong>{comment.pseudonym}</strong><span className="civic-small">{stanceLabels[comment.stance]} · {datePtBr(comment.createdAt)}</span></header><p className="civic-long-text">{comment.body}</p></article>) : <Empty title="Ainda não há comentários públicos.">Faça uma pergunta ou acrescente uma evidência sem incluir dados de outras pessoas.</Empty>}</div><form className="civic-form-section" onSubmit={submit}><h3>Acrescentar ao debate</h3><div className="civic-field"><label htmlFor="comment-stance">Tipo de contribuição</label><select id="comment-stance" value={stance} onChange={event => setStance(event.target.value as CivicComment["stance"])}>{Object.entries(stanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="civic-field"><label htmlFor="comment-pseudonym">Pseudônimo</label><input id="comment-pseudonym" value={pseudonym} onChange={event => setPseudonym(event.target.value)} /><small>Não use nome completo, telefone ou documento.</small></div><div className="civic-field"><label htmlFor="comment-body">Comentário</label><textarea id="comment-body" value={body} onChange={event => setBody(event.target.value)} /></div>{status && <p className="civic-status" role="status">{status}</p>}<button className="civic-button" type="submit" disabled={sending}>{sending ? "Enviando…" : "Publicar comentário"}</button></form></section>;
}

function Claims({ proposalId, claims }: { proposalId: string; claims: DossierClaim[] }) {
  const [form, setForm] = useState<CreateClaimInput>({ category: "other", type: "participant_report", relation: "unknown", statement: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const viewClaims = claims as DossierClaimWithSubmission[];
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.statement.trim()) { setStatus("Escreva a alegação ou a informação ausente."); return; } setSending(true); setStatus(null); try { await civicApi.addClaim(proposalId, { ...form, statement: form.statement.trim() }); setForm(current => ({ ...current, statement: "" })); setStatus("Alegação enviada com o estado de contribuição da comunidade."); } catch (value) { setStatus(errorText(value)); } finally { setSending(false); } }
  return <section className="civic-detail-section" aria-labelledby="claims-title"><h2 id="claims-title">Dossiê e fontes</h2><p className="civic-small">Uma fonte ou relato não prova sozinho a interpretação. Cada item mostra sua natureza e se foi apenas enviado ou conferido por uma fonte. A plataforma não busca URLs nem confirma seu conteúdo automaticamente.</p><div className="civic-claim-list">{viewClaims.length ? viewClaims.map(claim => <article className="civic-claim" key={claim.id}><p><strong>{claimCategoryLabels[claim.category]}</strong> · {claimTypeLabels[claim.type]} · relação {claimRelationLabels[claim.relation]}</p><p className="civic-long-text">{claim.statement}</p><p className="civic-small">Estado: {claim.status} — {claim.status === "source_checked" ? "fonte consultada" : "enviado pela comunidade"}</p><p className="civic-small">Enviado em: {datePtBr(claim.submittedAt)}</p>{claim.checkedAt !== null && claim.checkedAt !== undefined && <p className="civic-small">Conferido em: {datePtBr(claim.checkedAt)}</p>}{claim.sourceTitle && <p><strong>Título da fonte:</strong> {claim.sourceTitle}</p>}{claim.sourceUrl && <p><strong>URL da fonte:</strong> <a className="civic-text-link" href={claim.sourceUrl} rel="noreferrer">{claim.sourceUrl}</a></p>}{claim.sourceExcerpt && <p className="civic-long-text"><strong>Trecho da fonte:</strong> {claim.sourceExcerpt}</p>}{claim.jurisdiction && <p><strong>Jurisdição ou local da fonte:</strong> {claim.jurisdiction}</p>}{claim.sourceDate && <p><strong>Data da fonte:</strong> {claim.sourceDate}</p>}</article>) : <Empty title="O dossiê ainda não tem alegações públicas.">A ausência de itens não significa que a análise esteja concluída.</Empty>}</div><form className="civic-form-section" onSubmit={submit}><h3>Adicionar uma alegação ou lacuna</h3><div className="civic-field"><label htmlFor="claim-category">Categoria</label><select id="claim-category" value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value as ClaimCategory }))}>{Object.entries(claimCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="civic-field"><label htmlFor="claim-type">Natureza</label><select id="claim-type" value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as ClaimType }))}>{Object.entries(claimTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="civic-field"><label htmlFor="claim-relation">Relação com a proposta</label><select id="claim-relation" value={form.relation} onChange={event => setForm(current => ({ ...current, relation: event.target.value as ClaimRelation }))}>{Object.entries(claimRelationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="civic-field"><label htmlFor="claim-statement">Texto</label><textarea id="claim-statement" value={form.statement} onChange={event => setForm(current => ({ ...current, statement: event.target.value }))} /></div><div className="civic-field"><label htmlFor="claim-source-title">Título da fonte (opcional)</label><input id="claim-source-title" value={form.sourceTitle ?? ""} onChange={event => setForm(current => ({ ...current, sourceTitle: event.target.value }))} /></div><div className="civic-field"><label htmlFor="claim-source-url">URL da fonte (opcional)</label><input id="claim-source-url" type="url" value={form.sourceUrl ?? ""} onChange={event => setForm(current => ({ ...current, sourceUrl: event.target.value }))} /></div>{status && <p className="civic-status" role="status">{status}</p>}<button className="civic-button" type="submit" disabled={sending}>{sending ? "Enviando…" : "Adicionar ao dossiê"}</button></form></section>;
}

function LegislativeSources() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<LegislativeMatch[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) { setStatus("Digite um assunto para pesquisar."); return; }
    setSearched(true);
    setMatches([]);
    setLoading(true);
    setStatus(null);
    try { setMatches(await civicApi.legislativeSearch(query.trim())); }
    catch (value) { setStatus(errorText(value)); }
    finally { setLoading(false); }
  }
  const searchState = resolveLegislativeSearchState({ searched, loading, error: status, matches });
  return (
    <section className="civic-detail-section" aria-labelledby="legislative-title">
      <h3 id="legislative-title">Descoberta legislativa</h3>
      <p className="civic-small">A palavra-chave encontra registros oficiais para revisão humana. Ela não prova que uma norma se aplica à proposta.</p>
      <form className="civic-actions" onSubmit={search}>
        <div className="civic-field"><label htmlFor="legislative-query">Assunto para buscar na Câmara</label><input id="legislative-query" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <button className="civic-button civic-button--secondary" type="submit" disabled={loading}>{loading ? "Pesquisando…" : "Pesquisar"}</button>
      </form>
      {status && !searched && <p className="civic-status" role="alert">{status}</p>}
      {searchState.type === "loading" && <Loading label="Consultando a Câmara dos Deputados…" />}
      {searchState.type === "error" && <PageMessage>{searchState.message} A falha da consulta não significa que não existam registros.</PageMessage>}
      {searchState.type === "empty" && <Empty title="Nenhuma correspondência foi localizada nesta busca.">A consulta usa palavras-chave na Câmara dos Deputados; não prova que não existam normas ou registros relacionados.</Empty>}
      {searchState.type === "results" && <div className="civic-list">{searchState.matches.map(match => <article className="civic-card" key={`${match.type}-${match.number}-${match.year}`}><h3>{match.type} {match.number}/{match.year}</h3><p>{match.summary}</p><p className="civic-small">Correspondência por palavra-chave; requer revisão humana. Apresentado em {match.presentedAt ?? "data não informada"}.</p><a className="civic-text-link" href={match.officialUrl} rel="noreferrer">Abrir registro oficial</a></article>)}</div>}
    </section>
  );
}

export function VoteBox({ proposal }: { proposal: Pick<ProposalDetail, "id"> }) {
  const [choice, setChoice] = useState<VoteChoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [voteLoadFailed, setVoteLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setChoice(null);
    setStatus(null);
    setVoteLoadFailed(false);
    civicApi.sessionVote(proposal.id)
      .then(({ choice: currentChoice }) => {
        if (active) setChoice(currentChoice);
      })
      .catch(value => {
        if (active) {
          setVoteLoadFailed(true);
          setStatus(`Não foi possível recuperar sua escolha desta sessão. ${errorText(value)}`);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [proposal.id]);
  async function vote(nextChoice: VoteChoice) { setBusy(true); setStatus(null); try { await civicApi.vote(proposal.id, nextChoice); setChoice(nextChoice); setVoteLoadFailed(false); setStatus("Escolha registrada nesta sessão experimental. Você pode alterá-la ou retirá-la."); } catch (value) { setStatus(errorText(value)); } finally { setBusy(false); } }
  async function withdraw() { setBusy(true); setStatus(null); try { await civicApi.withdrawVote(proposal.id); setChoice(null); setVoteLoadFailed(false); setStatus("Retirada concluída para esta sessão experimental. Se havia uma escolha, ela foi removida."); } catch (value) { setStatus(errorText(value)); } finally { setBusy(false); } }
  return (
    <aside className="civic-vote-box" aria-labelledby="vote-title">
      <h2 id="vote-title">Como você quer participar?</h2>
      <p className="civic-small">Este é um voto experimental por sessão, não uma verificação de pessoa única. O resultado público mostra somente totais protegidos.</p>
      {loading && <p className="civic-small" role="status">Consultando a escolha desta sessão…</p>}
      <div className="civic-vote-options">{(Object.keys(voteLabels) as VoteChoice[]).map(option => <button className="civic-button" key={option} type="button" aria-pressed={choice === option} onClick={() => void vote(option)} disabled={busy || loading}>{choice === option ? `${voteLabels[option]} — escolhido` : voteLabels[option]}</button>)}</div>
      {!loading && !voteLoadFailed && choice === null && <p className="civic-small">Esta sessão não tem uma escolha registrada. A escolha de outras sessões não é consultada nem exibida.</p>}
      <button className="civic-button civic-button--quiet" type="button" onClick={() => void withdraw()} disabled={busy || loading}>Retirar minha escolha</button>
      {status && <p className="civic-status" role="status">{status}</p>}
    </aside>
  );
}

function MediaList({ proposalId, media }: { proposalId: string; media: CivicMediaView[] }) {
  const [items, setItems] = useState(media);
  const [status, setStatus] = useState<string | null>(null);
  async function remove(mediaId: string) { setStatus(null); try { await civicApi.deletePhoto(proposalId, mediaId); setItems(current => current.filter(item => item.id !== mediaId)); setStatus("Pedido de remoção concluído para esta mídia."); } catch (value) { setStatus(errorText(value)); } }
  return <section className="civic-detail-section" aria-labelledby="media-title"><h2 id="media-title">Fotos</h2>{items.length ? <div className="civic-media-grid">{items.map(item => <figure className="civic-media-item" key={item.id}><img src={civicApi.mediaUrl(item.id)} alt={item.altText} /><figcaption>{item.altText}<br /><button className="civic-button civic-button--danger" type="button" onClick={() => void remove(item.id)}>Pedir remoção desta foto</button></figcaption></figure>)}</div> : <Empty title="Esta proposta não tem fotos públicas.">A ausência de foto não impede a leitura da proposta.</Empty>}{status && <p className="civic-status" role="status">{status}</p>}</section>;
}

function ProposalDetailPage({ id }: { id: string }) {
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void civicApi.proposal(id).then(value => { if (active) setProposal(value); }).catch(value => { if (active) setError(errorText(value)); }); return () => { active = false; }; }, [id]);
  if (error) return <div className="civic-page"><PageMessage>{error} <a className="civic-text-link" href="/propostas">Voltar para propostas</a></PageMessage></div>;
  if (!proposal) return <div className="civic-page"><Loading label="Carregando proposta real…" /></div>;
  return <div className="civic-page"><header className="civic-detail-head"><div><p className="civic-kicker">{kindLabels[proposal.kind]} · {proposalLocationLabel(proposal)}</p><h1 id="page-title" tabIndex={-1}>{proposal.title}</h1><p className="civic-lede">Publicado em {datePtBr(proposal.createdAt)}. A proposta é conteúdo público do protótipo; leia as limitações antes de interpretar votos ou fontes.</p></div><span className="civic-tag">{proposal.commentCount} comentário(s)</span></header><div className="civic-detail-layout"><div><section className="civic-detail-section" aria-labelledby="summary-title"><h2 id="summary-title">Resumo</h2><p>{proposal.summary}</p><h3>O que aconteceu ou é necessário</h3><p className="civic-long-text">{proposal.description}</p><h3>Mudança pretendida</h3><p className="civic-long-text">{proposal.desiredChange}</p><h3>Área afetada</h3><p>{proposalRegionLabel(proposal.region)}</p>{proposal.region && !proposal.region.municipalityCode && <p className="civic-small">Sem código IBGE informado: a localidade não é usada em filtros ou agregados por código nem em proximidade geográfica.</p>}{proposal.region && proposal.region.latitude !== undefined && proposal.region.longitude !== undefined && <p className="civic-small">Coordenada fornecida pelo projeto: {proposal.region.latitude}, {proposal.region.longitude}. O mapa é opcional.</p>}</section><MediaList proposalId={proposal.id} media={proposal.media} /><Claims proposalId={proposal.id} claims={proposal.claims} /><LegislativeSources /><Comments proposalId={proposal.id} comments={proposal.comments} />{proposal.related.length > 0 && <section className="civic-detail-section" aria-labelledby="related-title"><h2 id="related-title">Propostas relacionadas</h2><div className="civic-related">{proposal.related.map(item => <div className="civic-related-item" key={item.proposal.id}><a href={`/propostas/${encodeURIComponent(item.proposal.id)}`}>{item.proposal.title}</a><p className="civic-small">{item.explanation} Termos compartilhados: {item.sharedTerms.join(", ") || "não informados"}.</p></div>)}</div></section>}</div><aside className="civic-sidebar"><VoteBox proposal={proposal} /><section className="civic-sidebar-card" aria-labelledby="result-title"><h2 id="result-title">Totais públicos</h2><ResultSummary result={proposal.result} /></section></aside></div></div>;
}

function MapPage() {
  const [items, setItems] = useState<ProposalListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void civicApi.proposals()
      .then(value => { if (active) setItems(value); })
      .catch(value => { if (active) setError(errorText(value)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);
  return (
    <div className="civic-page">
      <header className="civic-page-head"><p className="civic-kicker">Locais</p><h1 id="page-title" tabIndex={-1}>Mapa e lista textual</h1><p className="civic-lede">O mapa é uma melhoria opcional. Não usamos GPS; somente projetos que fornecerem área ou coordenadas reais podem aparecer em uma visualização espacial.</p></header>
      <div className="civic-map-panel"><p>Use a lista abaixo para compreender os locais. Nenhum marcador ou centro é criado quando a API não fornece coordenadas reais; propostas sem local continuam acessíveis na lista.</p></div>
      {error ? <PageMessage>{error} <button className="civic-button civic-button--quiet" type="button" onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</button></PageMessage> : loading ? <Loading label="Carregando propostas e locais…" /> : items.length ? <div className="civic-map-list" aria-label="Lista textual de propostas e locais">{items.map(item => <div className="civic-map-item" key={item.id}><div><a className="civic-text-link" href={`/propostas/${encodeURIComponent(item.id)}`}>{item.title}</a><div className="civic-small">{proposalLocationLabel(item)}</div></div><span>{item.publicLocation ?? "Referência pública não informada"}</span></div>)}</div> : <Empty title="Ainda não há propostas públicas para listar.">O mapa não é preenchido com pontos ou centros fictícios.</Empty>}
    </div>
  );
}

function AnalyticsPage() {
  const [data, setData] = useState<PublicAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void civicApi.analytics().then(setData).catch(value => setError(errorText(value))); }, []);
  return <div className="civic-page"><header className="civic-page-head"><p className="civic-kicker">Dados e comparações</p><h1 id="page-title" tabIndex={-1}>O que os dados permitem dizer</h1><p className="civic-lede">Métricas agregadas vêm da API. A tela mostra unidade, atualização e limitação; não transforma participação experimental em retrato da população.</p></header>{error ? <PageMessage>{error}</PageMessage> : !data ? <Loading label="Consultando métricas reais…" /> : <><div className="civic-data-grid"><div className="civic-stat"><span className="civic-small">Propostas públicas</span><strong>{data.proposalCount}</strong></div><div className="civic-stat"><span className="civic-small">Atualização</span><strong>{datePtBr(data.updatedAt)}</strong></div><div className="civic-stat"><span className="civic-small">Unidade de participação</span><strong>Sessões experimentais</strong></div></div><section className="civic-section" aria-labelledby="analytics-kind-title"><h2 id="analytics-kind-title">Propostas por tipo</h2><div className="civic-table-wrap" role="region" tabIndex={0} aria-label="Tabela de propostas por tipo; use as setas do teclado para acessar as colunas."><table className="civic-table"><caption>Contagens retornadas pela API para a atualização indicada.</caption><thead><tr><th scope="col">Tipo</th><th scope="col">Quantidade</th></tr></thead><tbody>{(Object.keys(kindLabels) as ProposalKind[]).map(kind => <tr key={kind}><th scope="row">{kindLabels[kind]}</th><td>{data.byKind[kind]}</td></tr>)}</tbody></table></div></section><section className="civic-section" aria-labelledby="analytics-region-title"><h2 id="analytics-region-title">Regiões informadas voluntariamente</h2><p className="civic-small">Células pequenas podem ser suprimidas. Isso reduz risco, mas não comprova anonimato nem representatividade.</p>{data.regions.length ? <div className="civic-table-wrap" role="region" tabIndex={0} aria-label="Tabela de regiões voluntárias; use as setas do teclado para acessar as colunas."><table className="civic-table"><caption>Município e UF fornecidos na proposta; contagem protegida conforme a metodologia.</caption><thead><tr><th scope="col">Região</th><th scope="col">Quantidade pública</th><th scope="col">Estado</th></tr></thead><tbody>{data.regions.map(region => <tr key={`${region.municipality}-${region.state}`}><th scope="row">{region.municipality} · {region.state}</th><td>{region.suppressed ? "Suprimida" : region.count ?? "Não informado"}</td><td>{region.suppressed ? "Amostra pequena" : "Disponível"}</td></tr>)}</tbody></table></div> : <Empty title="Ainda não há regiões para exibir." />}</section><p className="civic-small">Rótulo de participação fornecido pelo método: {data.participationLabel.replaceAll("_", " ")}.</p></>}</div>;
}

function GraphSvg({ graph }: { graph: PublicGraph }) {
  return <GraphView graph={graph} />;
}

function GraphPage() {
  const [graph, setGraph] = useState<PublicGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void civicApi.graph().then(setGraph).catch(value => setError(errorText(value))); }, []);
  return <div className="civic-page"><header className="civic-page-head"><p className="civic-kicker">Conexões</p><h1 id="page-title" tabIndex={-1}>Grafo de conexões</h1><p className="civic-lede">A proximidade é uma semelhança entre posições públicas documentadas. Não é ideologia, ranking ou perfil de participante.</p></header>{error ? <PageMessage>{error}</PageMessage> : !graph ? <><Loading label="Consultando perfis verificados reais…" /><section className="civic-section" aria-labelledby="graph-table-title"><h2 id="graph-table-title">Tabela equivalente</h2><Empty title="Sem perfis verificados para mostrar enquanto a consulta não retorna dados." /></section></> : graph.nodes.length === 0 || graph.profiles.length === 0 ? <><PageMessage tone="note">{graph.emptyReason === "no_verified_positions" ? "Ainda não há perfis verificados com posições públicas." : "Os dados comparáveis ainda são insuficientes para formar conexões."}</PageMessage><section className="civic-section" aria-labelledby="graph-table-title"><h2 id="graph-table-title">Tabela equivalente</h2><Empty title="Nenhum par de perfis foi retornado.">A ausência de nós não é preenchida com amostras fictícias.</Empty></section></> : <><p className="civic-small">Método {graph.methodVersion}: {graph.methodDescription} Mínimo de dimensões comuns: {graph.minimumSharedDimensions}. A projeção não substitui os valores originais.</p><GraphSvg graph={graph} /><section className="civic-section" aria-labelledby="graph-table-title"><h2 id="graph-table-title">Tabela equivalente</h2><div className="civic-table-wrap" role="region" tabIndex={0} aria-label="Tabela de perfis e fontes; use as setas do teclado para acessar as colunas."><table className="civic-table"><caption>Perfis, cobertura e fontes de posição retornados pela API.</caption><thead><tr><th scope="col">Perfil</th><th scope="col">Tipo</th><th scope="col">Cobertura</th><th scope="col">Posições e fontes</th></tr></thead><tbody>{graph.profiles.map(profile => <tr key={profile.id}><th scope="row">{profile.label}</th><td>{profile.kind === "public_authority" ? "Autoridade pública" : "Coorte voluntária"}</td><td>{profile.coverage}</td><td>{profile.positionSources.map(source => <div key={`${source.topic}-${source.sourceUrl}`}><strong>{source.topic}</strong> · <a href={source.sourceUrl} rel="noreferrer">{source.sourceTitle}</a> · {source.sourceDate}</div>)}</td></tr>)}</tbody></table></div></section></>}</div>;
}

function InfoPage({ kind }: { kind: "method" | "privacy" | "accessibility" }) {
  const content = {
    method: { kicker: "Metodologia", title: "Como os dados são tratados", lede: "A Cívica separa proposta, debate e voto experimental. Cada visão deve dizer o que foi consultado e o que continua desconhecido." },
    privacy: { kicker: "Privacidade", title: "Escolha o que compartilhar", lede: "O protótipo não pede CPF, cadastro ou localização automática. O conteúdo de uma proposta pode ser público após a confirmação." },
    accessibility: { kicker: "Acessibilidade", title: "Leitura sem mapa, cor ou movimento", lede: "A interface usa texto, headings, labels, foco visível e alternativas equivalentes para listas, dados, locais e conexões." },
  }[kind];
  return <div className="civic-page"><header className="civic-page-head"><p className="civic-kicker">{content.kicker}</p><h1 id="page-title" tabIndex={-1}>{content.title}</h1><p className="civic-lede">{content.lede}</p></header><div className="civic-prose"><section><h2>O que este protótipo não promete</h2><p>Uma sessão experimental não prova que uma pessoa corresponde a um voto, não demonstra representatividade e não cria perfil individual. Totais pequenos podem ficar ocultos.</p></section><section><h2>Alternativas equivalentes</h2><p>Propostas podem ser lidas em lista. Locais têm lista textual. Métricas têm tabela. O grafo é opcional e só usa perfis reais retornados pela API.</p></section><section><h2>Estados honestos</h2><p>Ausência de resultado, amostra insuficiente, erro de consulta e conteúdo ainda não conferido são estados diferentes. A interface os nomeia sem preencher lacunas com exemplos.</p></section>{kind === "privacy" && <section><h2>Antes de publicar</h2><p>Revise texto, local e fotos. Não inclua endereço residencial, documento, telefone, rostos de terceiros, crianças ou placas. A foto recebe descrição alternativa e pode ser removida no fluxo disponível.</p></section>}{kind === "accessibility" && <section><h2>Uso por teclado</h2><p>O primeiro foco é o link para pular ao conteúdo. Controles têm nomes, labels e mensagens associadas; a preferência por menos movimento é respeitada.</p></section>}</div></div>;
}

function routePage(path: string) {
  if (path === "/") return <HomePage />;
  if (path === "/propostas") return <ProposalsPage />;
  if (path === "/sugerir") return <SuggestPage />;
  if (path === "/mapa") return <MapPage />;
  if (path === "/dados") return <AnalyticsPage />;
  if (path === "/conexoes") return <GraphPage />;
  if (path === "/metodologia") return <InfoPage kind="method" />;
  if (path === "/privacidade") return <InfoPage kind="privacy" />;
  if (path === "/acessibilidade") return <InfoPage kind="accessibility" />;
  const match = path.match(/^\/propostas\/([^/]+)$/);
  if (match) return <ProposalDetailPage id={decodeURIComponent(match[1])} />;
  return <div className="civic-page"><PageMessage>Esta página não foi encontrada. <a className="civic-text-link" href="/">Voltar ao início</a></PageMessage></div>;
}

export default function CivicApp({ path: providedPath }: { path?: string }) {
  const [path, setPath] = useState(providedPath ?? pagePath());
  const [sessionIssue, setSessionIssue] = useState<string | null>(null);
  useEffect(() => {
    if (providedPath !== undefined) return;
    const update = () => setPath(pagePath());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [providedPath]);
  useEffect(() => { const title = document.getElementById("page-title"); title?.focus(); }, [path]);
  useEffect(() => { void civicApi.session().catch(value => setSessionIssue(errorText(value))); }, []);
  const renderedPage = useMemo(() => routePage(path), [path]);
  return <div className="civic-site"><CivicHeader path={path} />{sessionIssue && <div className="civic-page civic-page--notice"><PageMessage>{sessionIssue} A leitura pública continua disponível; tente novamente ao participar.</PageMessage></div>}<main id="conteudo-principal" className="civic-main">{renderedPage}</main><CivicFooter /></div>;
}
