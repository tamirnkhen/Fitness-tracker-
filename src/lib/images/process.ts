import "server-only";
import sharp from "sharp";
import OpenAI from "openai";
import { hasServerEnv } from "@/lib/env";

/**
 * Decode and re-encode the photo. Anything that isn't a real image fails to decode;
 * re-encoding drops EXIF (incl. GPS location), ICC payloads and any trailing data.
 */
export async function normalizePhoto(input: Uint8Array): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
  const meta = await image.metadata();
  if (!meta.width || !meta.height || meta.width < 256 || meta.height < 256) {
    throw new Error("התמונה קטנה מדי — נדרשים לפחות 256×256 פיקסלים");
  }
  return image
    .rotate() // honour EXIF orientation before it is stripped
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** Basic content scan with OpenAI's moderation model. Returns true when allowed. */
export async function moderatePhoto(jpeg: Buffer): Promise<boolean> {
  if (!hasServerEnv("OPENAI_API_KEY")) return true;
  const openai = new OpenAI();
  const result = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }],
  });
  return !result.results.some((r) => r.flagged);
}
