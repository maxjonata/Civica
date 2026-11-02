import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAppSession } from "@/App";
import { api, ApiError, formatDatePtBr, formatOpaqueId } from "@/lib/api";
import type { ReviewDecision, ReviewView } from "@shared/pilot";
import { canApproveManualReview } from "@/lib/review-policy";

export default function Review() {
  const { session, loading } = useAppSession();
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.account?.role !== "admin") return;
    setFetching(true);
    setError(null);
    void api.admin
      .reviews()
      .then(result => setReviews(result.reviews))
      .catch(nextError =>
        setError(
          nextError instanceof ApiError
            ? nextError.message
            : "Não foi possível carregar as revisões."
        )
      )
      .finally(() => setFetching(false));
  }, [session?.account?.role]);

  if (loading)
    return (
      <main className="page-wrap page-state">
        Carregando autorização de revisão…
      </main>
    );
  if (!session?.account)
    return (
      <main className="page-wrap narrow-page">
        <div className="eyebrow">
          <span className="rule" /> revisão
        </div>
        <h1>Entre para continuar.</h1>
        <Link className="button button--primary" href="/acesso">
          Ir para acesso
        </Link>
      </main>
    );
  if (session.account.role !== "admin")
    return (
      <main className="page-wrap narrow-page">
        <div className="eyebrow">
          <span className="rule" /> revisão restrita
        </div>
        <h1>Esta área é somente do operador.</h1>
        <p className="lede">
          O papel administrativo não é concedido no cadastro.
        </p>
      </main>
    );

  return (
    <main className="page-wrap review-page">
      <div className="eyebrow">
        <span className="rule" /> conferência manual / 03
      </div>
      <div className="page-title-row">
        <div>
          <h1>Revisões pendentes.</h1>
          <p className="lede">
            Baixe a evidência autenticada e confira no VALIDAR oficial. O
            resultado declarado pela pessoa não autoriza uma decisão.
          </p>
        </div>
        <span className="status-chip">{reviews.length} registros</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {fetching && <p className="page-state">Atualizando a fila…</p>}
      {!fetching && reviews.length === 0 && (
        <div className="empty-state">
          <strong>Nenhuma evidência disponível para revisão.</strong>
          <span>
            A fila começa vazia; este piloto não cria documentos ou aprovações
            de demonstração.
          </span>
        </div>
      )}
      <div className="review-list">
        {reviews.map(review => (
          <ReviewItem
            key={review.id}
            review={review}
            reviewerAccountId={session.account!.id}
            onDone={id =>
              setReviews(items => items.filter(item => item.id !== id))
            }
          />
        ))}
      </div>
    </main>
  );
}

function ReviewItem({
  review,
  reviewerAccountId,
  onDone,
}: {
  review: ReviewView;
  reviewerAccountId: string;
  onDone: (id: string) => void;
}) {
  const isSelf = reviewerAccountId === review.accountId;
  const [compliance, setCompliance] =
    useState<ReviewDecision["compliance"]>("indeterminate");
  const [trustAnchor, setTrustAnchor] =
    useState<ReviewDecision["trustAnchor"]>(null);
  const [signedContentConfirmed, setSignedContentConfirmed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [
    reviewerDifferentPersonConfirmed,
    setReviewerDifferentPersonConfirmed,
  ] = useState(false);
  const [cpf, setCpf] = useState("");
  const [reportReference, setReportReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeForApprove = canApproveManualReview(
    {
      compliance,
      trustAnchor,
      signedContentConfirmed,
      identityConfirmed,
      reviewerDifferentPersonConfirmed,
    },
    isSelf
  );

  const submit = async (decision: ReviewDecision["decision"]) => {
    if (busy || (decision === "approve" && !completeForApprove)) return;
    setBusy(true);
    setError(null);
    try {
      const body: ReviewDecision = {
        decision,
        expectedSha256: review.sha256 ?? "",
        compliance,
        trustAnchor,
        signedContentConfirmed,
        identityConfirmed,
        reviewerDifferentPersonConfirmed,
        ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
        ...(reportReference.trim()
          ? { reportReference: reportReference.trim() }
          : {}),
      };
      await api.admin.decide(review.id, body);
      onDone(review.id);
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível registrar a decisão."
      );
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    if (
      busy ||
      !window.confirm(
        "Descartar esta evidência pendente? Esta ação remove o arquivo do fluxo de revisão."
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.admin.discard(review.id);
      onDone(review.id);
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível descartar a evidência."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="review-card">
      <header>
        <div>
          <p className="section-index">Evidência {formatOpaqueId(review.id)}</p>
          <h2>{review.nickname}</h2>
        </div>
        <span className="status-chip">
          emitida {formatDatePtBr(review.issuedAt)}
        </span>
      </header>
      <p className="review-account">
        Conta: <code>{review.accountId}</code> · SHA esperado:{" "}
        <code>{review.sha256 ?? "não calculado"}</code>
      </p>
      <div className="blocked-panel">
        <strong>
          Referência privada para conferir o conteúdo efetivamente assinado
        </strong>
        <p>
          Desafio: <code>{review.expectedChallenge}</code>
        </p>
        <p>
          Resumo SHA-256 da chave: <code>{review.expectedKeyDigest}</code>
        </p>
        <p>
          Registro: <code>{review.id}</code> · emissão UTC:{" "}
          <code>{new Date(review.issuedAt).toISOString()}</code> · validade UTC:{" "}
          <code>{new Date(review.expiresAt).toISOString()}</code>
        </p>
        <p>
          Uma assinatura válida em outro texto não comprova este vínculo.
          Compare conta, registro, chave, desafio e datas, e confirme que esse
          conteúdo está coberto pela assinatura. Não execute scripts ou anexos
          do PDF.
        </p>
      </div>
      <a
        className="button button--secondary"
        href={api.admin.evidenceUrl(review.id)}
        download
      >
        Baixar evidência autenticada
      </a>
      <div className="review-form">
        <label>
          Conformidade
          <select
            value={compliance}
            onChange={e =>
              setCompliance(e.target.value as ReviewDecision["compliance"])
            }
          >
            <option value="indeterminate">Indeterminada</option>
            <option value="valid">Válida</option>
            <option value="invalid">Inválida</option>
          </select>
        </label>
        <label>
          Âncora reconhecida
          <select
            value={trustAnchor ?? ""}
            onChange={e =>
              setTrustAnchor(
                (e.target.value || null) as ReviewDecision["trustAnchor"]
              )
            }
          >
            <option value="">Nenhuma informada</option>
            <option value="govbr">gov.br</option>
            <option value="icpbrasil">ICP-Brasil</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={signedContentConfirmed}
            onChange={e => setSignedContentConfirmed(e.target.checked)}
          />{" "}
          <span>
            Conferi conta, registro, chave, desafio e datas no conteúdo
            efetivamente assinado.
          </span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={identityConfirmed}
            onChange={e => setIdentityConfirmed(e.target.checked)}
          />{" "}
          <span>Identidade do signatário está identificável.</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={reviewerDifferentPersonConfirmed}
            disabled={isSelf}
            onChange={e =>
              setReviewerDifferentPersonConfirmed(e.target.checked)
            }
          />{" "}
          <span>
            Sou pessoa diferente do titular e fiz revisão independente.
            {isSelf && " Esta é sua própria conta; não pode ser independente."}
          </span>
        </label>
        <label>
          Referência opcional do relatório oficial
          <input
            value={reportReference}
            onChange={e => setReportReference(e.target.value)}
          />
        </label>
        <label>
          CPF, somente se necessário ao operador
          <input
            inputMode="numeric"
            value={cpf}
            onChange={e => setCpf(e.target.value)}
          />
          <span className="field-help">
            Usado apenas para montar a decisão; não é salvo no navegador.
          </span>
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="review-actions">
        <button
          className="button button--primary"
          type="button"
          disabled={busy || !completeForApprove}
          onClick={() => void submit("approve")}
        >
          Aprovar vínculo
        </button>
        <button
          className="button button--quiet"
          type="button"
          disabled={busy}
          onClick={() => void submit("reject")}
        >
          Não aprovar
        </button>
        <button
          className="button button--text-danger"
          type="button"
          disabled={busy}
          onClick={() => void discard()}
        >
          Descartar com confirmação
        </button>
      </footer>
    </article>
  );
}
