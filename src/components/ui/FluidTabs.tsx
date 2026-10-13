"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export const FLUID_TAB_TRACK =
  "relative flex items-center gap-1 rounded-full border-[1.6px] border-[#f5f1ebf4] bg-[#F5F1EB] px-1 py-1 transition-colors sm:gap-2 dark:border-neutral-800 dark:bg-neutral-900";

export const FLUID_TAB_ITEM =
  "group relative rounded-full px-3 py-2.5 outline-none sm:px-4 sm:py-3.5";

// The compact bar has its own strings: cn() joins classes without resolving conflicts, so overriding the sizes above
// would depend on stylesheet order.
const TRACK_SM =
  "relative flex items-center gap-0.5 rounded-full border-[1.6px] border-[#f5f1ebf4] bg-[#F5F1EB] p-0.5 transition-colors dark:border-neutral-800 dark:bg-neutral-900";
const ITEM_SM = "group relative rounded-full px-3 py-1.5 outline-none";

export interface TabItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface FluidTabsProps {
  tabs: TabItem[];
  defaultActive?: string;
  /** Makes the tabs controlled: whichever id is passed is the active one. */
  active?: string;
  onChange?: (id: string) => void;
  trailing?: ReactNode;
  /** "sm" is a compact bar for tight spaces such as the chat panel. */
  size?: "md" | "sm";
  /**
   * Identifies the sliding pill. Two tab bars on one screen must not share it, or the pill would glide from one bar
   * into the other.
   */
  layoutId?: string;
}

export function FluidTabs({
  tabs,
  defaultActive = tabs[0]?.id,
  active: controlledActive,
  onChange,
  trailing,
  size = "md",
  layoutId = "fluid-tabs-active-pill",
}: FluidTabsProps) {
  const [internalActive, setInternalActive] = useState<string>(defaultActive);
  const active = controlledActive ?? internalActive;
  const small = size === "sm";

  function handleChange(id: string) {
    setInternalActive(id);
    onChange?.(id);
  }

  return (
    <div
      className={cn(
        small ? TRACK_SM : FLUID_TAB_TRACK,
        trailing ? "w-full" : undefined,
      )}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleChange(tab.id)}
            className={small ? ITEM_SM : FLUID_TAB_ITEM}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 25,
                  mass: 0.8,
                }}
                className="absolute inset-0 rounded-full border border-[#fefefe]/90 bg-gradient-to-b from-[#fefefe] to-gray-50/80 shadow-xs dark:border-neutral-600/50 dark:from-neutral-700 dark:to-neutral-800/90"
              />
            )}

            <motion.div
              transition={{ duration: 0.3, ease: "easeOut" }}
              animate={{
                filter: isActive
                  ? ["blur(0px)", "blur(4px)", "blur(0px)"]
                  : "blur(0px)",
              }}
              className={cn(
                "relative z-10 flex items-center transition-colors duration-200",
                small ? "gap-1.5" : "gap-1.5 sm:gap-3",
                isActive
                  ? "font-bold text-[#292926] dark:text-white"
                  : "font-semibold text-[#585652] group-hover:dark:text-neutral-300 dark:text-neutral-500",
              )}
            >
              <motion.div
                animate={{ scale: isActive ? 1.03 : 1 }}
                transition={{
                  scale: { type: "spring", stiffness: 300, damping: 15 },
                }}
                className="flex shrink-0 items-center justify-center"
              >
                {tab.icon}
              </motion.div>

              <span
                className={cn(
                  "tracking-tight whitespace-nowrap",
                  small ? "text-[13px]" : "text-sm sm:text-base",
                )}
              >
                {tab.label}
              </span>
            </motion.div>
          </button>
        );
      })}
      {trailing ? (
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
