import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { fallbackPlan } from "@/lib/ai/fallback";
import { normalizePlan, sanitizeGoals } from "@/lib/ai/quest";
import { XP_RANGE } from "@/lib/game/domains";
import { normalizePhoto } from "@/lib/images/process";
import { checkUpload, sniffImageType } from "@/lib/images/validate";
import { safeNextPath } from "@/lib/urls";

describe("upload validation", () => {
  it("identifies real image types from magic bytes, not the declared type", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("rejects empty and oversized files", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(checkUpload(0, jpeg).ok).toBe(false);
    expect(checkUpload(6 * 1024 * 1024, jpeg).ok).toBe(false);
    expect(checkUpload(1000, jpeg).ok).toBe(true);
  });

  it("re-encodes photos and strips metadata (EXIF/GPS)", async () => {
    const input = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#806040" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret-location" } } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await normalizePhoto(input);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1024);
  });

  it("rejects tiny images and non-images that claim to be JPEG", async () => {
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).png().toBuffer();
    await expect(normalizePhoto(tiny)).rejects.toThrow();
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
    await expect(normalizePhoto(fake)).rejects.toThrow();
  });
});

describe("redirect safety", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/admin/users/1")).toBe("/admin/users/1");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });
});

describe("AI output is clamped before it reaches the database", () => {
  it("sanitizes goals", () => {
    const goals = sanitizeGoals([
      { domain: "health", custom_label: "ignored", title: "  לרוץ  ", baseline: "0", target: "10 קמ" },
      { domain: "hacking", custom_label: null, title: "x", baseline: "", target: "" },
      { domain: "personal", custom_label: "גיטרה", title: "", baseline: "", target: "" },
      { domain: "personal", custom_label: "גיטרה", title: "לנגן", baseline: "", target: "" },
      { domain: "discipline", custom_label: null, title: "3", baseline: "", target: "" },
      { domain: "direction", custom_label: null, title: "4", baseline: "", target: "" },
      { domain: "subconscious", custom_label: null, title: "5", baseline: "", target: "" },
    ]);
    expect(goals).toHaveLength(4);
    expect(goals[0]).toEqual({ domain: "health", custom_label: null, title: "לרוץ", baseline: "0", target: "10 קמ" });
    expect(goals[1].custom_label).toBe("גיטרה");
  });

  it("clamps XP and drops tasks for unknown goals", () => {
    const plan = normalizePlan(
      {
        goals: [
          { goal_index: 0, daily: [{ title: "a", description: "", xp: 500 }], weekly: [{ title: "w", description: "", xp: 1, target_count: 99 }], bonus: [{ title: "b", description: "", xp: 9000 }] },
          { goal_index: 7, daily: [{ title: "ghost", description: "", xp: 5 }], weekly: [], bonus: [] },
        ],
      },
      1,
    );
    expect(plan).toHaveLength(3);
    expect(plan.find((t) => t.kind === "daily")!.xp).toBe(10);
    expect(plan.find((t) => t.kind === "weekly")).toMatchObject({ xp: 15, target_count: 7 });
    expect(plan.find((t) => t.kind === "bonus")!.xp).toBe(50);
  });

  it("fallback plan satisfies the database XP constraints", () => {
    const plan = fallbackPlan(
      (["health", "direction", "subconscious", "discipline", "personal"] as const).map((domain) => ({ domain, custom_label: null, title: "t", baseline: "", target: "" })),
    );
    for (const t of plan) {
      expect(t.xp).toBeGreaterThanOrEqual(XP_RANGE[t.kind].min);
      expect(t.xp).toBeLessThanOrEqual(XP_RANGE[t.kind].max);
      expect(t.title.length).toBeLessThanOrEqual(140);
    }
    expect(new Set(plan.map((t) => t.goal_index)).size).toBe(5);
  });
});
