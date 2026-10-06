import "server-only";
import OpenAI, { toFile } from "openai";
import { requireServerEnv } from "@/lib/env";
import type { GearItem } from "@/lib/game/gear";

export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

// Matches the brand book's character reference: stylized semi-realistic 3D,
// full body, confident pose, uniform default outfit, dark slate studio backdrop.
const BASE_PROMPT = `Create a stylized, semi-realistic 3D animated character portrait of the person in the reference photo, keeping their recognizable facial features, skin tone, hair and facial hair.
Full body, standing, front-facing, confident and friendly smile, hands on hips.
Default outfit: plain black tank top, charcoal grey straight trousers, brown leather boots.
Soft studio lighting, plain dark slate-blue gradient background, no text, no logos.
Keep it tasteful and non-sexualized; adult proportions; same style for every character.`;

export function buildAvatarPrompt(gear: GearItem[]): string {
  if (gear.length === 0) return BASE_PROMPT;
  return `${BASE_PROMPT}\nEquipment unlocked in the game (replace the matching default item): ${gear.map((g) => g.prompt).join("; ")}.`;
}

export async function generateAvatar(sourceJpeg: Buffer, gear: GearItem[]): Promise<Buffer> {
  const openai = new OpenAI({ apiKey: requireServerEnv("OPENAI_API_KEY"), timeout: 120_000 });
  const result = await openai.images.edit({
    model: IMAGE_MODEL,
    image: await toFile(sourceJpeg, "source.jpg", { type: "image/jpeg" }),
    prompt: buildAvatarPrompt(gear),
    size: "1024x1024",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("image generation returned no image");
  return Buffer.from(b64, "base64");
}
