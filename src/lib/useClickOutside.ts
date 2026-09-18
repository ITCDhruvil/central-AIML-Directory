import { useEffect, type RefObject } from "react";

/** Calls `onOutside` on any pointerdown outside `ref`'s element, and on Escape — the standard way to close a menu/popover. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    function handlePointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOutside();
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ref, onOutside, enabled]);
}
