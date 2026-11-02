import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizePhoto, PhotoNormalizationError } from "./media";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

async function solidImage(
  format: "jpeg" | "png" | "webp",
  width = 32,
  height = 16
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 28, g: 92, b: 135, alpha: 1 },
    },
  })[format]().toBuffer();
}

describe("normalizePhoto", () => {
  it("normalizes an allowed image to WebP, preserves dimensions without upscaling, and removes metadata", async () => {
    const input = await solidImage("png", 32, 16);

    const result = await normalizePhoto(input, "image/png");

    expect(result.contentType).toBe("image/webp");
    expect(result.bytes).toBeInstanceOf(Buffer);
    expect(result.bytes.length).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
    expect(result.width).toBe(32);
    expect(result.height).toBe(16);
    const outputMetadata = await sharp(result.bytes).metadata();
    expect(outputMetadata.format).toBe("webp");
    expect(outputMetadata.width).toBe(32);
    expect(outputMetadata.height).toBe(16);
    expect(outputMetadata.exif).toBeUndefined();
    expect(outputMetadata.icc).toBeUndefined();
    expect(outputMetadata.iptc).toBeUndefined();
    expect(outputMetadata.xmp).toBeUndefined();
  });

  it("applies EXIF orientation before resizing and does not carry metadata into the public copy", async () => {
    const input = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 3,
        background: { r: 220, g: 80, b: 50 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    expect((await sharp(input).metadata()).orientation).toBe(6);

    const result = await normalizePhoto(input, "image/jpeg");
    const outputMetadata = await sharp(result.bytes).metadata();

    expect(result.width).toBe(20);
    expect(result.height).toBe(40);
    expect(outputMetadata.orientation).toBeUndefined();
    expect(outputMetadata.exif).toBeUndefined();
    expect(outputMetadata.icc).toBeUndefined();
    expect(outputMetadata.iptc).toBeUndefined();
    expect(outputMetadata.xmp).toBeUndefined();
  });

  it("resizes large images down to the 1800px box without upscaling", async () => {
    const large = await solidImage("jpeg", 2400, 1200);
    const small = await solidImage("jpeg", 80, 40);

    const largeResult = await normalizePhoto(large, "image/jpeg");
    const smallResult = await normalizePhoto(small, "image/jpeg");

    expect(largeResult.width).toBe(1800);
    expect(largeResult.height).toBe(900);
    expect(smallResult.width).toBe(80);
    expect(smallResult.height).toBe(40);
  });

  it("rejects an input over 5 MiB before decoding it", async () => {
    const oversized = Buffer.alloc(MAX_INPUT_BYTES + 1, 0);

    await expect(normalizePhoto(oversized, "image/jpeg")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      code: "INPUT_TOO_LARGE",
    });
  });

  it("rejects decoded images over the 20MP pixel limit", async () => {
    const tooManyPixels = await solidImage("png", 4_500, 4_500);

    await expect(normalizePhoto(tooManyPixels, "image/png")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      message: "Não foi possível processar a imagem.",
    });
  });

  it("rejects unsupported MIME types, including SVG and GIF", async () => {
    const png = await solidImage("png");
    const gif = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      "base64"
    );
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
      "utf8"
    );

    await expect(normalizePhoto(png, "image/svg+xml")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    await expect(normalizePhoto(gif, "image/gif")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    await expect(normalizePhoto(svg, "image/svg+xml")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("rejects MIME and signature/decoder format mismatches", async () => {
    const jpeg = await solidImage("jpeg");
    const png = await solidImage("png");

    await expect(normalizePhoto(jpeg, "image/png")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      code: "MEDIA_TYPE_MISMATCH",
    });
    await expect(normalizePhoto(png, "image/webp")).rejects.toMatchObject({
      name: "PhotoNormalizationError",
      code: "MEDIA_TYPE_MISMATCH",
    });
  });

  it("rejects malformed bytes and never exposes a Sharp error to the caller", async () => {
    const malformedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const failure = await normalizePhoto(malformedJpeg, "image/jpeg").catch(
      error => error
    );

    expect(failure).toBeInstanceOf(PhotoNormalizationError);
    expect(failure.code).toBe("INVALID_IMAGE");
    expect(failure.message).toBe("Não foi possível processar a imagem.");
    expect(failure.message).not.toMatch(/sharp|vips|jpeg|input file|corrupt/i);
  });
});
