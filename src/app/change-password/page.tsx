import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { getCurrentUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthCard
      title="Change password"
      subtitle={user.mustChangePassword ? "Set a new password to continue" : user.email}
    >
      <ChangePasswordForm />
    </AuthCard>
  );
}
