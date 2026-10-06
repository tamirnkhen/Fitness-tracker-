import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormError } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/urls";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";

export const metadata: Metadata = { title: "כניסה" };

const ERRORS: Record<string, string> = {
  oauth: "ההתחברות עם Google נכשלה. נסה שוב.",
  link: "הקישור לא תקף או שפג תוקפו. נסה להתחבר שוב.",
  age: "The Quest מיועדת לבני 18 ומעלה, ולכן החשבון נמחק ולא נשמר עליך מידע.",
  deleted: "החשבון וכל המידע שלך נמחקו. תודה ששיחקת.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getUser()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <AuthShell
      title="ממשיכים במסע"
      footer={
        <>
          עוד אין לך חשבון?{" "}
          <Link href="/signup" className="font-medium text-amber">
            הרשמה
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
