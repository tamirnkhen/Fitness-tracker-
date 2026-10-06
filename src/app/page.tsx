import Link from "next/link";
import { redirect } from "next/navigation";
import { Chevrons } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui";
import { getUser } from "@/lib/auth";

export default async function Landing() {
  if (await getUser()) redirect("/dashboard");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(217,164,65,0.08),transparent_60%)]" />
      <Chevrons size={72} animated className="relative mb-7" />
      <h1 className="relative animate-fade-up font-display text-5xl font-extrabold tracking-wide text-cream sm:text-6xl" dir="ltr">
        THE QUEST
      </h1>
      <p className="relative mt-3 animate-fade-up text-muted [animation-delay:0.2s]" dir="ltr">
        Life is a game. Are you going to play?
      </p>
      <div className="relative mt-9 h-2.5 w-[min(70vw,320px)] animate-fade-up overflow-hidden rounded-md border-[1.5px] border-line-strong [animation-delay:0.35s]" aria-hidden="true" dir="ltr">
        <div className="h-full w-[55%] rounded bg-amber" />
      </div>
      <p className="relative mt-2.5 animate-fade-up font-display text-xs font-bold tracking-[0.2em] text-amber [animation-delay:0.45s]" dir="ltr">
        LVL 01
      </p>

      <p className="relative mx-auto mt-10 max-w-sm animate-fade-up leading-7 text-body [animation-delay:0.55s]">
        הופכים מטרות חיים למשימות יומיות, צוברים XP, עולים רמות — ובונים דמות שמתפתחת יחד איתך.
      </p>

      <div className="relative mt-8 flex w-full max-w-xs animate-fade-up flex-col gap-3 [animation-delay:0.65s]">
        <ButtonLink href="/signup">אני משחק/ת — בוא נתחיל</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          כבר יש לי חשבון
        </ButtonLink>
      </div>

      <footer className="relative mt-14 flex gap-5 text-xs text-muted">
        <Link href="/privacy" className="hover:text-cream">
          מדיניות פרטיות
        </Link>
        <Link href="/terms" className="hover:text-cream">
          תנאי שימוש
        </Link>
      </footer>
    </main>
  );
}
