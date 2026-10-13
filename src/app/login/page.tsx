import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginShell } from "@/components/auth/LoginShell";
import { safeRedirectTarget } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/dal";
import { getEmailDomain } from "@/lib/emailDomainSettings";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeRedirectTarget(next);

  const [user, domain] = await Promise.all([getCurrentUser(), getEmailDomain()]);
  if (user) redirect(user.mustChangePassword ? "/change-password" : target);

  return (
    <LoginShell>
      <LoginForm next={target} domain={domain} />
      <p className="mt-8 text-center text-xs text-zinc-400">Need help? Contact your administrator.</p>
    </LoginShell>
  );
}
