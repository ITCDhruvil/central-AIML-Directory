"use client";

import { useState } from "react";
import {
  Bot,
  Database,
  Lock,
  Palette,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  User as UserIcon,
} from "lucide-react";
import { AccessSummary } from "@/components/settings/AccessSummary";
import { AiControls } from "@/components/settings/AiControls";
import { AiUsage } from "@/components/settings/AiUsage";
import { AuditLog } from "@/components/settings/AuditLog";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { EmailDomainSetting } from "@/components/settings/EmailDomainSetting";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { SecurityPolicySettings } from "@/components/settings/SecurityPolicySettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { FluidTabs } from "@/components/ui/FluidTabs";
import type { AuthUser } from "@/lib/auth/types";

type TabId =
  | "profile"
  | "security"
  | "appearance"
  | "access"
  | "workspace"
  | "ai"
  | "audit"
  | "general";

// One icon and one word each, so the whole row stays on a single line.
const PERSONAL_TABS = [
  { id: "profile", label: "Profile", icon: <UserIcon size={18} /> },
  { id: "security", label: "Security", icon: <Lock size={18} /> },
  { id: "appearance", label: "Appearance", icon: <Palette size={18} /> },
  { id: "access", label: "Access", icon: <ShieldCheck size={18} /> },
];

// Only people who can edit settings see these.
const ADMIN_TABS = [
  { id: "workspace", label: "Sign-in", icon: <SlidersHorizontal size={18} /> },
  { id: "ai", label: "AI", icon: <Bot size={18} /> },
  { id: "audit", label: "Audit", icon: <ScrollText size={18} /> },
  { id: "general", label: "General", icon: <Database size={18} /> },
];

export function SettingsView({
  user,
  createdAt,
  lastLoginAt,
  canEditWorkspace,
}: {
  user: AuthUser;
  createdAt: string | null;
  lastLoginAt: string | null;
  canEditWorkspace: boolean;
}) {
  const [tab, setTab] = useState<TabId>("profile");
  const tabs = canEditWorkspace
    ? [...PERSONAL_TABS, ...ADMIN_TABS]
    : PERSONAL_TABS;

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>

      {/* Same tabs as the project page. If they don't fit the width, the row scrolls sideways with no scrollbar. */}
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        {/* w-max lets the pill track grow with its tabs instead of ending where the screen does. */}
        <div className="w-max min-w-full">
          <FluidTabs
            tabs={tabs}
            defaultActive="profile"
            onChange={(id) => setTab(id as TabId)}
          />
        </div>
      </div>

      <div key={tab} className="view-fade min-w-0">
        {tab === "profile" && (
          <ProfileSettings
            user={user}
            createdAt={createdAt}
            lastLoginAt={lastLoginAt}
          />
        )}
        {tab === "security" && <SecuritySettings />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "access" && <AccessSummary user={user} />}
        {tab === "workspace" && canEditWorkspace && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SecurityPolicySettings />
            <EmailDomainSetting />
          </div>
        )}
        {tab === "ai" && canEditWorkspace && (
          <div className="space-y-8">
            <AiControls />
            <AiUsage />
          </div>
        )}
        {tab === "audit" && canEditWorkspace && <AuditLog />}
        {tab === "general" && canEditWorkspace && <GeneralSettings />}
      </div>
    </div>
  );
}
