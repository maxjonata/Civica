import sharp, { type Metadata } from "sharp";

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 20_000_000;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 1_800;

const SAFE_ERROR_MESSAGE = "Não foi possível processar a imagem.";

const mimeToFormat = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AllowedFormat = (typeof mimeToFormat)[keyof typeof mimeToFormat];

export type PhotoNormalizationErrorCode =
  | "INVALID_INPUT"
  | "INPUT_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "MEDIA_TYPE_MISMATCH"
  | "INVALID_IMAGE"
  | "OUTPUT_TOO_LARGE";

export class PhotoNormalizationError extends Error {
  constructor(public readonly code: PhotoNormalizationErrorCode) {
    super(SAFE_ERROR_MESSAGE);
    this.name = "PhotoNormalizationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface NormalizedPhoto {
  bytes: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
}

function fail(code: PhotoNormalizationErrorCode): never {
  throw new PhotoNormalizationError(code);
}

function inputFormatFromSignature(input: Buffer): AllowedFormat | null {
  if (
    input.length >= 3 &&
    input[0] === 0xff &&
    input[1] === 0xd8 &&
    input[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    input.length >= 8 &&
    input[0] === 0x89 &&
    input[1] === 0x50 &&
    input[2] === 0x4e &&
    input[3] === 0x47 &&
    input[4] === 0x0d &&
    input[5] === 0x0a &&
    input[6] === 0x1a &&
    input[7] === 0x0a
  ) {
    return "png";
  }

  if (
    input.length >= 12 &&
    input.subarray(0, 4).toString("ascii") === "RIFF" &&
    input.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

function dimensionsWithinBox(
  width: number,
  height: number,
  box: number
): { width: number; height: number } {
  const scale = Math.min(1, box / width, box / height);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

async function encodeWebp(
  input: Buffer,
  dimensions: { width: number; height: number },
  quality: number
): Promise<NormalizedPhoto> {
  try {
    const encoded = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: dimensions.width,
        height: dimensions.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (
      encoded.info.format !== "webp" ||
      encoded.info.width < 1 ||
      encoded.info.height < 1
    ) {
      fail("INVALID_IMAGE");
    }

    return {
      bytes: encoded.data,
      contentType: "image/webp",
      width: encoded.info.width,
      height: encoded.info.height,
    };
  } catch (error) {
    if (error instanceof PhotoNormalizationError) throw error;
    fail("INVALID_IMAGE");
  }
}

function fitsOutput(photo: NormalizedPhoto): boolean {
  return photo.bytes.length <= MAX_OUTPUT_BYTES;
}

export async function normalizePhoto(
  input: Buffer,
  declaredContentType: string
): Promise<NormalizedPhoto> {
  if (!Buffer.isBuffer(input)) fail("INVALID_INPUT");
  if (input.length > MAX_INPUT_BYTES) fail("INPUT_TOO_LARGE");
  if (typeof declaredContentType !== "string") fail("INVALID_INPUT");

  const normalizedMime = declaredContentType.trim().toLowerCase();
  const expectedFormat = mimeToFormat[normalizedMime as keyof typeof mimeToFormat];
  if (!expectedFormat) fail("UNSUPPORTED_MEDIA_TYPE");

  const signatureFormat = inputFormatFromSignature(input);
  if (!signatureFormat || signatureFormat !== expectedFormat) {
    fail("MEDIA_TYPE_MISMATCH");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    }).metadata();
  } catch {
    fail("INVALID_IMAGE");
  }

  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < 1 ||
    metadata.height < 1 ||
    metadata.width * metadata.height > MAX_INPUT_PIXELS
  ) {
    fail("MEDIA_TYPE_MISMATCH");
  }

  const initialDimensions = dimensionsWithinBox(
    metadata.autoOrient.width,
    metadata.autoOrient.height,
    MAX_PHOTO_DIMENSION
  );

  const qualities = [82, 72, 62, 52, 42, 32, 22, 12];
  let candidate: NormalizedPhoto | null = null;
  for (const quality of qualities) {
    candidate = await encodeWebp(input, initialDimensions, quality);
    if (fitsOutput(candidate)) return candidate;
  }

  let dimensions = initialDimensions;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const currentSize = candidate?.bytes.length ?? MAX_OUTPUT_BYTES * 2;
    const sizeScale = Math.min(
      0.85,
      Math.sqrt(MAX_OUTPUT_BYTES / currentSize) * 0.9
    );
    const nextDimensions = {
      width: Math.max(1, Math.floor(dimensions.width * sizeScale)),
      height: Math.max(1, Math.floor(dimensions.height * sizeScale)),
    };

    if (
      nextDimensions.width === dimensions.width &&
      nextDimensions.height === dimensions.height
    ) {
      break;
    }

    dimensions = nextDimensions;
    for (const quality of [72, 52, 32, 12]) {
      candidate = await encodeWebp(input, dimensions, quality);
      if (fitsOutput(candidate)) return candidate;
    }
  }

  fail("OUTPUT_TOO_LARGE");
}
