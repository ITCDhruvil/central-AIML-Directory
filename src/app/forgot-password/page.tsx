import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { LoginShell } from "@/components/auth/LoginShell";
import { getCurrentUser } from "@/lib/auth/dal";
import { getEmailDomain } from "@/lib/emailDomainSettings";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const [user, domain] = await Promise.all([getCurrentUser(), getEmailDomain()]);
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/");

  return (
    <LoginShell>
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Forgot password?</h2>
      <p className="mb-8 mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">
        Enter your username and an administrator will send you a temporary password.
      </p>
      <ForgotPasswordForm domain={domain} />
    </LoginShell>
  );
}
