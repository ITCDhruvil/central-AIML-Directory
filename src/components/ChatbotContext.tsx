"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ChatbotContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const ChatbotContext = createContext<ChatbotContextValue | null>(null);

const fallback: ChatbotContextValue = {
  open: false,
  setOpen: () => {},
  toggle: () => {},
};

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((current) => !current),
    }),
    [open],
  );

  return <ChatbotContext.Provider value={value}>{children}</ChatbotContext.Provider>;
}

export function useChatbot() {
  return useContext(ChatbotContext) ?? fallback;
}
