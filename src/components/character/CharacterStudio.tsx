"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chevrons } from "@/components/brand/Logo";
import { Button, FormError } from "@/components/ui";
import { grantPhotoConsent } from "@/app/(app)/character/actions";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoConsent() {
  return (
    <form action={grantPhotoConsent} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg font-bold">לפני שמעלים תמונה</h2>
      <ul className="list-disc space-y-1.5 ps-5 text-sm leading-6 text-body">
        <li>התמונה שלך תישלח לספק AI חיצוני (OpenAI) רק כדי ליצור ממנה את הדמות.</li>
        <li>התמונה והדמות נשמרות באחסון פרטי ומוצפן, ורק לך יש גישה אליהן.</li>
        <li>מנהלי המערכת לא רואים את התמונות.</li>
        <li>אפשר למחוק את התמונה ואת הדמות בכל רגע, וזה מבטל את ההסכמה.</li>
      </ul>
      <label className="flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" name="photo_consent" required className="mt-1 size-5 shrink-0 accent-amber" />
        <span>אני מסכים/ה במפורש לעיבוד תמונת הפנים שלי לצורך יצירת דמות, כמתואר כאן ובמדיניות הפרטיות.</span>
      </label>
      <Button type="submit">אישור והמשך</Button>
    </form>
  );
}

export function CharacterStudio(props: { avatarUrl: string | null; hasSource: boolean; status: string; generationAvailable: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "generating">(props.status === "generating" ? "generating" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState(props.avatarUrl);

  async function generate() {
    setStage("generating");
    setError(null);
    const res = await fetch("/api/character/generate", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setStage("idle");
    if (!res?.ok) {
      setError(data?.error ?? "יצירת הדמות נכשלה. נסה/י שוב.");
      return;
    }
    setAvatar(data.url);
    router.refresh();
  }

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) return setError("אפשר להעלות רק JPG, PNG או WEBP");
    if (file.size > MAX_BYTES) return setError("הקובץ גדול מ-5MB");
    setPreview(URL.createObjectURL(file));
    setStage("uploading");
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch("/api/character/upload", { method: "POST", body: form }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setStage("idle");
      setError(data?.error ?? "ההעלאה נכשלה. בדוק/י את החיבור.");
      return;
    }
    if (props.generationAvailable) await generate();
    else {
      setStage("idle");
      router.refresh();
    }
  }

  const image = stage === "idle" ? avatar : preview ?? avatar;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_50%_30%,#1f2533,#0b0b12_75%)]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed / blob URLs
          <img src={image} alt={stage === "idle" ? "הדמות שלך" : "התמונה שהעלית"} className={`size-full object-cover ${stage !== "idle" ? "opacity-40 blur-[2px]" : ""}`} />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-muted">
            <Chevrons size={48} />
            <span className="text-sm">עוד אין דמות</span>
          </div>
        )}
        {stage !== "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center" role="status">
            <Chevrons size={56} animated />
            <p className="font-medium">{stage === "uploading" ? "בודקים את התמונה..." : "יוצרים את הדמות שלך..."}</p>
            {stage === "generating" && <p className="text-xs text-muted">זה לוקח בערך דקה</p>}
          </div>
        )}
      </div>

      <FormError message={error} />

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="בחירת תמונה"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={stage !== "idle"} variant={avatar ? "secondary" : "primary"}>
        {props.hasSource ? "העלאת תמונה אחרת" : "העלאת תמונה"}
      </Button>
      {props.hasSource && props.generationAvailable && (
        <Button onClick={generate} disabled={stage !== "idle"} variant={avatar ? "primary" : "secondary"}>
          {avatar ? "עדכון הדמות עם הציוד שנבחר" : "יצירת הדמות"}
        </Button>
      )}
      {!props.generationAvailable && <p className="text-center text-xs text-muted">יצירת דמויות עדיין לא הופעלה בשרת הזה.</p>}
      <p className="text-center text-xs leading-5 text-muted">תמונת פנים ברורה, לבד, באור טוב. עד 5MB. מוגבל ל-3 יצירות ביום.</p>
    </div>
  );
}
