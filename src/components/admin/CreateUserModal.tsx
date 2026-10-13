"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { ROLE_OPTIONS } from "@/components/admin/roleOptions";
import { PermissionToggles, type OverrideMap } from "@/components/admin/PermissionToggles";
import { Button } from "@/components/ui/Button";
import { useSecurityPolicy } from "@/components/PolicyProvider";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import type { AdminUserDto } from "@/lib/auth/adminUsers";
import { generatePassword, passwordStrength, suggestUsername } from "@/lib/auth/passwordStrength";
import type { PermissionSet, Role } from "@/lib/auth/permissions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissionLabels";

const STEPS = [
  { id: "account", label: "Account", hint: "Who is this person?" },
  { id: "password", label: "Password", hint: "How will they sign in?" },
  { id: "role", label: "Role", hint: "What is their job here?" },
  { id: "access", label: "Access", hint: "Fine-tune what they can do." },
] as const;

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:disabled:bg-zinc-900";

const BAR_COLORS = ["bg-zinc-200 dark:bg-zinc-700", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-green-600"];
const LABEL_COLORS = ["text-zinc-400", "text-red-600", "text-amber-600", "text-lime-600", "text-green-600"];

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stepper({ current, onJump, maxReached }: { current: number; onJump: (index: number) => void; maxReached: number }) {
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const reachable = index <= maxReached;
        return (
          <li key={step.id} className={cn("flex items-center", index < STEPS.length - 1 && "flex-1")}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump(index)}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  active && "bg-orange-600 text-white",
                  done && "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
                  !active && !done && "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
                )}
              >
                {done ? <Check size={14} strokeWidth={2.75} /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400",
                )}
              >
                {step.label}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <span aria-hidden className={cn("mx-3 h-px flex-1", done ? "bg-orange-300" : "bg-zinc-200 dark:bg-zinc-700")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function CreateUserModal({
  open,
  onClose,
  emailDomain,
  roleDefaults,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** The sign-in domain; usernames are the part before it. */
  emailDomain: string;
  roleDefaults: Record<Role, PermissionSet>;
  onCreated: (user: AdminUserDto, password: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [autoUsername, setAutoUsername] = useState(true);
  const [manualUsername, setManualUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requireChange, setRequireChange] = useState(true);
  const [role, setRole] = useState<Role>("MEMBER");
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The username is only the part before the fixed domain; the full address is built from it.
  const autoLocal = suggestUsername(firstName, lastName, emailDomain).split("@")[0];
  const localPart = autoUsername ? autoLocal : manualUsername.trim().toLowerCase().replace(/@.*$/, "");
  const username = localPart ? `${localPart}@${emailDomain}` : "";
  const strength = passwordStrength(password, useSecurityPolicy());
  const customised = Object.keys(overrides).length;
  const accountValid = firstName.trim() !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
  const stepValid = [accountValid, strength.meetsRequirements, true, true][step];
  const isLast = step === STEPS.length - 1;

  function reset() {
    setStep(0);
    setMaxReached(0);
    setFirstName("");
    setLastName("");
    setAutoUsername(true);
    setManualUsername("");
    setPassword("");
    setShowPassword(false);
    setRequireChange(true);
    setRole("MEMBER");
    setOverrides({});
    setError(null);
  }

  function close() {
    if (creating) return;
    reset();
    onClose();
  }

  function goTo(index: number) {
    setError(null);
    setStep(index);
    setMaxReached((m) => Math.max(m, index));
  }

  function onAutoToggle(checked: boolean) {
    // Switching to manual keeps whatever was auto-filled so it can be edited rather than retyped.
    if (!checked) setManualUsername(localPart);
    setAutoUsername(checked);
  }

  function generate() {
    setPassword(generatePassword());
    setShowPassword(true);
    setCopied(false);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the password is visible to copy by hand
    }
  }

  function changeRole(next: Role) {
    if (next === role) return;
    setRole(next);
    // Overrides are relative to a role's defaults, so a new role starts clean.
    setOverrides({});
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: username,
          role,
          password,
          mustChangePassword: requireChange,
          overrides: role === "ADMIN" ? undefined : overrides,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; user?: AdminUserDto };
      if (!res.ok || !body.user) {
        setError(body.error ?? "Failed to create user");
        // A duplicate username is fixed on the first step.
        if (res.status === 409) goTo(0);
        return;
      }
      onCreated(body.user, password);
      reset();
    } catch {
      setError("Network error — please try again");
    } finally {
      setCreating(false);
    }
  }

  function next() {
    if (!stepValid) return;
    if (isLast) void create();
    else goTo(step + 1);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add user"
      description={STEPS[step].hint}
      className="max-w-2xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-red-600">
              {error}
            </p>
          )}
          {step === 0 ? (
            <Button variant="secondary" onClick={close} disabled={creating}>
              Cancel
            </Button>
          ) : (
            <Button variant="secondary" icon={ArrowLeft} onClick={() => goTo(step - 1)} disabled={creating}>
              Back
            </Button>
          )}
          <Button variant="primary" loading={creating} disabled={!stepValid} onClick={next}>
            {isLast ? "Create user" : "Continue"}
            {!isLast && <ArrowRight size={16} />}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <Stepper current={step} onJump={goTo} maxReached={maxReached} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
          noValidate
          className="min-h-[19rem]"
        >
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="cu-first">
                  <input
                    id="cu-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className={inputClass}
                  />
                </Field>
                <Field label="Last name" htmlFor="cu-last">
                  <input
                    id="cu-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="off"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Username" htmlFor="cu-username">
                <div
                  className={cn(
                    "flex h-11 w-full items-center overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm transition-colors focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950",
                    autoUsername && "bg-zinc-50 dark:bg-zinc-900",
                  )}
                >
                  <input
                    id="cu-username"
                    type="text"
                    value={localPart}
                    disabled={autoUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                    placeholder="first.last"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="autofill-clean h-full min-w-0 flex-1 bg-transparent px-3.5 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:text-zinc-500 dark:text-zinc-50"
                  />
                  <span className="flex h-full shrink-0 select-none items-center border-l border-zinc-200 bg-zinc-50 px-3.5 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    @{emailDomain}
                  </span>
                </div>
              </Field>
              <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                <Switch id="cu-auto-username" checked={autoUsername} onChange={onAutoToggle} label="Fill in the username automatically from the name" />
                <label htmlFor="cu-auto-username" className="cursor-pointer">
                  Fill in automatically from the name
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Field label="Password" htmlFor="cu-password">
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      id="cu-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setCopied(false);
                      }}
                      autoFocus
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className={cn(inputClass, "pr-11")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={copyPassword}
                    disabled={!password}
                    aria-label="Copy password"
                    title="Copy password"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    {copied ? <Check size={17} className="text-green-600" /> : <Copy size={17} />}
                  </button>
                </div>
              </Field>

              <button
                type="button"
                onClick={generate}
                className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                <RefreshCw size={15} />
                Generate a strong password
              </button>

              <div aria-live="polite" className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((segment) => (
                    <span
                      key={segment}
                      className={cn("h-1.5 flex-1 rounded-full transition-colors", segment <= strength.score ? BAR_COLORS[strength.score] : BAR_COLORS[0])}
                    />
                  ))}
                  <span className={cn("ml-2 w-16 text-right text-xs font-semibold", LABEL_COLORS[strength.score])}>
                    {password ? strength.label : "—"}
                  </span>
                </div>
                <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                  {strength.rules.map((rule) => (
                    <li
                      key={rule.id}
                      className={cn(
                        "flex items-center gap-1.5",
                        rule.met ? "text-green-700 dark:text-green-400" : "text-zinc-500 dark:text-zinc-400",
                      )}
                    >
                      {rule.met ? <Check size={13} strokeWidth={2.5} /> : <X size={13} className="text-zinc-300 dark:text-zinc-600" />}
                      <span>
                        {rule.label}
                        {rule.required && !rule.met && <span className="text-red-500"> *</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[11px] text-zinc-400">* required. The rest make it stronger.</p>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <Switch
                  id="cu-require-change"
                  checked={requireChange}
                  onChange={setRequireChange}
                  label="Ask for a new password at first sign-in"
                  className="mt-0.5"
                />
                <label htmlFor="cu-require-change" className="cursor-pointer">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">Ask for a new password at first sign-in</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">Recommended, since you will know this one.</span>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div role="radiogroup" aria-label="Role" className="grid gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => changeRole(option.value as Role)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                      selected
                        ? "border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20 dark:bg-orange-500/10"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50",
                    )}
                  >
                    {Icon && <Icon size={20} className={cn(option.iconClassName)} />}
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{option.label}</span>
                    <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {ROLE_DESCRIPTIONS[option.value as Role]}
                    </span>
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {role === "ADMIN"
                    ? "Admins always have full access, so there is nothing to customise."
                    : `Starts from the ${ROLE_LABELS[role]} role. Change only what this person needs differently.`}
                </p>
                {customised > 0 && (
                  <button
                    type="button"
                    onClick={() => setOverrides({})}
                    className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-700"
                  >
                    Reset {customised}
                  </button>
                )}
              </div>
              {role !== "ADMIN" && (
                <PermissionToggles roleDefaults={roleDefaults[role]} overrides={overrides} onChange={setOverrides} />
              )}
              <p className="rounded-lg bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {firstName.trim() || "New user"} · {username || "no username yet"} · {ROLE_LABELS[role]}
                </span>
                {customised > 0 && ` · ${customised} custom ${customised === 1 ? "setting" : "settings"}`}
              </p>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
}

