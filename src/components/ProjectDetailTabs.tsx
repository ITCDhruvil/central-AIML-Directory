"use client";

import { useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { FileText, LayoutGrid, Link2, Sparkles } from "lucide-react";
import { FadeScroll } from "@/components/FadeScroll";
import { FluidTabs } from "@/components/ui/FluidTabs";
import { PanelCollapseRail } from "@/components/PanelCollapseRail";

const TABS = [
  { id: "overview", label: "Overview", icon: <LayoutGrid size={18} /> },
  { id: "documentation", label: "Documentation", icon: <FileText size={18} /> },
  { id: "askAi", label: "Ask AI", icon: <Sparkles size={18} /> },
  { id: "links", label: "Links", icon: <Link2 size={18} /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DETAILS_COLLAPSED_KEY = "project-details-sidebar-collapsed";
const DETAILS_COLLAPSED_EVENT = "project-details-sidebar-collapsed";
const DETAILS_WIDTH_KEY = "project-details-sidebar-width";
const DETAILS_WIDTH_EVENT = "project-details-sidebar-width";
const DEFAULT_DETAILS_WIDTH = 352;
const MIN_DETAILS_WIDTH = 240;
const MAX_DETAILS_WIDTH = 640;
const MIN_TABS_WIDTH = 280;
const DRAG_EXPAND_PX = 8;

function subscribeDetailsCollapsed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DETAILS_COLLAPSED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DETAILS_COLLAPSED_EVENT, onStoreChange);
  };
}

function getDetailsCollapsed() {
  return window.localStorage.getItem(DETAILS_COLLAPSED_KEY) === "1";
}

function setDetailsCollapsed(collapsed: boolean) {
  window.localStorage.setItem(DETAILS_COLLAPSED_KEY, collapsed ? "1" : "0");
  window.dispatchEvent(new Event(DETAILS_COLLAPSED_EVENT));
}

function subscribeDetailsWidth(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DETAILS_WIDTH_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DETAILS_WIDTH_EVENT, onStoreChange);
  };
}

function clampDetailsWidth(value: number, containerWidth?: number) {
  const maxFromRow =
    containerWidth && containerWidth > MIN_TABS_WIDTH + MIN_DETAILS_WIDTH
      ? containerWidth - MIN_TABS_WIDTH
      : MAX_DETAILS_WIDTH;
  return Math.min(MAX_DETAILS_WIDTH, maxFromRow, Math.max(MIN_DETAILS_WIDTH, value));
}

function getDetailsWidth() {
  const stored = window.localStorage.getItem(DETAILS_WIDTH_KEY);
  if (stored == null || stored === "") return DEFAULT_DETAILS_WIDTH;
  const raw = Number(stored);
  if (!Number.isFinite(raw)) return DEFAULT_DETAILS_WIDTH;
  return clampDetailsWidth(raw);
}

function persistDetailsWidth(width: number) {
  window.localStorage.setItem(DETAILS_WIDTH_KEY, String(width));
  window.dispatchEvent(new Event(DETAILS_WIDTH_EVENT));
}

/**
 * Project detail tabs. The fluid list stays put; only the active panel
 * (and the details column beside it on large screens) scrolls.
 */
export function ProjectDetailTabs({
  overview,
  documentation,
  askAi,
  links,
  sidebar,
  footer,
  actions,
}: Record<TabId, ReactNode> & { sidebar?: ReactNode; footer?: ReactNode; actions?: ReactNode }) {
  const [active, setActive] = useState<TabId>("overview");
  const detailsCollapsed = useSyncExternalStore(subscribeDetailsCollapsed, getDetailsCollapsed, () => false);
  const storedWidth = useSyncExternalStore(subscribeDetailsWidth, getDetailsWidth, () => DEFAULT_DETAILS_WIDTH);
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_DETAILS_WIDTH);
  const liveWidth = useRef(DEFAULT_DETAILS_WIDTH);
  const didDrag = useRef(false);
  const detailsWidth = draftWidth ?? storedWidth;
  const panels: Record<TabId, ReactNode> = { overview, documentation, askAi, links };

  function onDragStart(clientX: number) {
    dragStartX.current = clientX;
    dragStartWidth.current = detailsWidth;
    liveWidth.current = detailsWidth;
    didDrag.current = false;
    setDraftWidth(detailsWidth);
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onDrag(clientX: number) {
    const delta = dragStartX.current - clientX;
    if (Math.abs(delta) < 3) return;
    didDrag.current = true;
    if (getDetailsCollapsed() && delta > DRAG_EXPAND_PX) {
      setDetailsCollapsed(false);
    }
    if (getDetailsCollapsed() && delta <= DRAG_EXPAND_PX) return;
    const next = clampDetailsWidth(dragStartWidth.current + delta, rowRef.current?.clientWidth);
    liveWidth.current = next;
    setDraftWidth(next);
  }

  function onDragEnd() {
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (!didDrag.current && getDetailsCollapsed()) {
      setDetailsCollapsed(false);
    }
    if (didDrag.current) persistDetailsWidth(liveWidth.current);
    setDraftWidth(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center">
        <div className="min-w-0 w-full overflow-x-auto">
          <FluidTabs
            tabs={[...TABS]}
            defaultActive="overview"
            onChange={(id) => setActive(id as TabId)}
            trailing={actions}
          />
        </div>
      </div>

      <div ref={rowRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <FadeScroll key={active} className="min-h-0 min-w-0 flex-1 lg:h-full">
          <div className="space-y-5 lg:pr-1">
            {panels[active]}
            {footer}
          </div>
        </FadeScroll>

        {sidebar ? (
          <>
            <PanelCollapseRail
              collapsed={detailsCollapsed}
              dragging={dragging}
              onToggle={() => setDetailsCollapsed(!detailsCollapsed)}
              onDragStart={onDragStart}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
            />
            <aside
              className={
                detailsCollapsed
                  ? "mt-6 space-y-5 lg:mt-0 lg:hidden"
                  : "mt-6 flex min-h-0 w-full shrink-0 flex-col lg:mt-0 lg:w-[var(--details-width)] lg:overflow-hidden"
              }
              style={{ "--details-width": `${detailsWidth}px` } as CSSProperties}
            >
              <FadeScroll className="min-h-0 lg:h-full lg:flex-1">
                <div className="space-y-5">{sidebar}</div>
              </FadeScroll>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
