"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Chatbot } from "@/components/Chatbot";
import { ChatbotProvider } from "@/components/ChatbotContext";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { cn } from "@/lib/cn";

const COLLAPSED_KEY = "sidebar-collapsed";
const COLLAPSED_EVENT = "sidebar-collapsed";

function subscribeCollapsed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COLLAPSED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COLLAPSED_EVENT, onStoreChange);
  };
}

function getCollapsed() {
  return window.localStorage.getItem(COLLAPSED_KEY) === "1";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    function closeOnDesktop() {
      if (media.matches) setMobileOpen(false);
    }
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  function toggleCollapsed() {
    window.localStorage.setItem(COLLAPSED_KEY, getCollapsed() ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
  }

  return (
    <ChatbotProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-100 font-sans dark:bg-zinc-950">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <div className="relative flex min-h-0 flex-1 gap-2 p-0 sm:p-2.5">
          {mobileOpen && (
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-zinc-950/20 sm:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}

          <div
            className={cn(
              "z-50 h-full",
              mobileOpen ? "fixed inset-y-2 left-2 sm:static sm:inset-auto" : "hidden sm:flex",
            )}
          >
            <Sidebar
              collapsed={mobileOpen ? false : collapsed}
              onToggle={mobileOpen ? () => setMobileOpen(false) : toggleCollapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>

          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-7 has-[.page-lock]:flex has-[.page-lock]:min-h-0 has-[.page-lock]:flex-col has-[.page-lock]:overflow-hidden">
            {children}
          </main>
        </div>
        <Chatbot />
      </div>
    </ChatbotProvider>
  );
}
