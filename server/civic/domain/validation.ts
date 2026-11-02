import { z } from "zod";
import type { CreateProposalInput, CreateClaimInput, CreateCommentInput } from "@shared/civic/contracts";

function hasForbiddenControls(value: string): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) || code === 0x7f;
  });
}

function replaceControls(value: string): string {
  return [...value]
    .map(character => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f ? " " : character;
    })
    .join("");
}

const plainText = (max: number, min = 1) =>
  z.string().trim().min(min).max(max).refine(
    value => !/<\/?[a-z][^>]*>|<!--[\s\S]*?-->/i.test(value),
    "Markup não é permitido neste campo."
  ).refine(
    value => !hasForbiddenControls(value),
    "Caracteres de controle não são permitidos."
  );

const regionSchema = z.object({
  municipalityCode: z.string().regex(/^\d{7}$/).nullable().optional(),
  municipality: plainText(120, 2),
  state: z.string().regex(/^[A-Z]{2}$/),
  areaLabel: plainText(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  precision: z.enum(["municipality", "approximate_area"]).optional(),
}).strict().refine(value => (value.latitude === undefined) === (value.longitude === undefined), {
  message: "Latitude e longitude devem ser informadas juntas.",
});

const optionalHttpsUrl = z.string().url().max(1000).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "A fonte deve usar HTTPS e não pode conter credenciais.");

const claimSchema = z.object({
  category: z.enum(["authority", "contact", "cost", "timeline", "legislation", "jurisprudence", "other"]),
  type: z.enum(["participant_report", "documented_fact", "hypothesis", "estimate", "projection", "missing_information"]),
  relation: z.enum(["supports", "challenges", "context", "unknown"]),
  statement: plainText(2000, 5),
  sourceTitle: plainText(300).optional(),
  sourceUrl: optionalHttpsUrl.optional(),
  sourceExcerpt: plainText(3000).optional(),
  jurisdiction: plainText(160).optional(),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict().refine(value => value.type !== "documented_fact" || Boolean(value.sourceUrl && value.sourceTitle), {
  message: "Um fato documentado precisa de título e URL da fonte.",
});

const proposalSchema = z.object({
  kind: z.enum(["public_work", "legislative_change", "public_service"]),
  title: plainText(140, 8),
  summary: plainText(320, 20),
  description: plainText(6000, 20),
  desiredChange: plainText(2000, 10),
  region: regionSchema.nullable().optional(),
  initialClaims: z.array(claimSchema).max(5).optional(),
  publicLocation: plainText(220).optional(),
  pseudonym: plainText(40, 2).optional(),
  acceptPublicPreview: z.literal(true),
}).strict().refine(value => value.region !== undefined && value.region !== null || value.publicLocation === undefined, {
  message: "Uma referência pública depende de uma região informada.",
  path: ["publicLocation"],
});

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .join(" ");
}

const STOP_WORDS = new Set([
  "a", "as", "ao", "aos", "com", "como", "da", "das", "de", "do", "dos",
  "e", "em", "entre", "essa", "esse", "esta", "este", "eu", "mais", "mas",
  "na", "nas", "no", "nos", "o", "os", "ou", "para", "pela", "pelas", "pelo",
  "pelos", "por", "que", "se", "sem", "ser", "sua", "suas", "seu", "seus",
  "uma", "umas", "um", "uns", "bairro", "cidade", "municipal", "municipio",
]);

export function validateProposalInput(value: unknown): CreateProposalInput {
  return proposalSchema.parse(value) as CreateProposalInput;
}

const commentSchema = z.object({
  stance: z.enum(["supporting_evidence", "challenging_evidence", "question", "other"]),
  pseudonym: plainText(40, 2),
  body: plainText(3000, 10),
}).strict();

export function validateCommentInput(value: unknown): CreateCommentInput {
  return commentSchema.parse(value) as CreateCommentInput;
}

export function validateClaimInput(value: unknown): CreateClaimInput {
  return claimSchema.parse(value) as CreateClaimInput;
}

export function limitQuery(value: unknown, max = 120): string {
  if (typeof value !== "string") return "";
  return replaceControls(value.trim().slice(0, max));
}
