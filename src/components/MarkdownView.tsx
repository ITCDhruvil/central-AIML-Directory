import Link from "next/link";
import { Children, isValidElement } from "react";
import { ChatTable } from "@/components/ChatTable";
import { chartToSvg, CHART_LANG, parseChartSpec } from "@/lib/chartSpec";
import { ImageFigure } from "@/components/ImageFigure";
import { parseMediaAlt } from "@/lib/media";
import { MermaidView } from "@/components/MermaidView";
import { Info, Lightbulb, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { headingId, markdownHeadings, parseAlertMarker, TOC_MARKER, type CalloutType } from "@/lib/alerts";
import { embedSource, EMBED_ALT } from "@/lib/embed";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const BASE_CLASS_LIST = [
  "text-sm leading-relaxed text-zinc-700 dark:text-zinc-300",
  "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-zinc-900 dark:[&_h1]:text-zinc-100",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100",
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100",
  "[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-zinc-900 dark:[&_h4]:text-zinc-100",
  "[&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-medium [&_h5]:text-zinc-900 dark:[&_h5]:text-zinc-100",
  "[&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-xs [&_h6]:font-medium [&_h6]:text-zinc-900 dark:[&_h6]:text-zinc-100",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_b]:font-semibold",
  "[&_a]:text-zinc-900 [&_a]:underline dark:[&_a]:text-zinc-100",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-zinc-800",
  "[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-xs dark:[&_pre]:bg-zinc-800",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 dark:[&_blockquote]:border-zinc-700",
  "[&_img]:max-w-full [&_hr]:my-4 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800",
  "[&_del]:text-zinc-400",
  "[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0 [&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2 [&_li.task-list-item>input]:mt-1",
];

// Chat replies style their own links (see CHAT_COMPONENTS), so the shared link rules are left out of their wrapper.
const CHAT_BASE = BASE_CLASS_LIST.filter((c) => !c.startsWith("[&_a]")).join(
  " ",
);

// Page markdown keeps its bordered-cell tables.
const WRAPPER_CLASSES = [
  ...BASE_CLASS_LIST,
  "[&_table]:my-2 [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-200 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-1 dark:[&_th]:border-zinc-800 dark:[&_td]:border-zinc-800",
].join(" ");

// In the chat the cells are laid out by the table wrapper below instead of with a border on every cell.
const CHAT_TABLE_CLASSES =
  "[&_td]:break-words [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:bg-zinc-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-zinc-500 dark:[&_th]:bg-zinc-800/60 dark:[&_th]:text-zinc-400 [&_tbody_tr]:border-t [&_tbody_tr]:border-zinc-100 dark:[&_tbody_tr]:border-zinc-800 [&_tbody_tr:hover]:bg-orange-50/50 dark:[&_tbody_tr:hover]:bg-orange-500/5";

const CALLOUT_TONES: Record<CalloutType, string> = {
  info: "border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10",
  tip: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
  danger: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
};

const CALLOUT_ICONS: Record<CalloutType, { icon: LucideIcon; color: string }> = {
  info: { icon: Info, color: "text-sky-500" },
  tip: { icon: Lightbulb, color: "text-emerald-500" },
  warning: { icon: TriangleAlert, color: "text-amber-500" },
  danger: { icon: OctagonAlert, color: "text-red-500" },
};

function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

// Chart, Mermaid, callout, toggle, embed and [TOC] blocks are all plain Markdown underneath (see lib/chartSpec.ts and
// lib/alerts.ts); here they get drawn. Anything that doesn't parse falls back to the ordinary element.
function pageComponents(content: string): Components {
  const used = new Map<string, number>();
  const heading = (Tag: "h1" | "h2" | "h3") => {
    const H = ({ children }: { children?: React.ReactNode }) => <Tag id={headingId(textOf(children), used)}>{children}</Tag>;
    return H;
  };
  const toc = markdownHeadings(content);

  return {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    pre: ({ children }) => {
      const child = Children.toArray(children)[0];
      if (isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
        const classes = child.props.className?.split(" ") ?? [];
        if (classes.includes(`language-${CHART_LANG}`)) {
          const spec = parseChartSpec(String(child.props.children ?? ""));
          if (spec) return <div className="my-3 text-zinc-500 dark:text-zinc-400" dangerouslySetInnerHTML={{ __html: chartToSvg(spec) }} />;
        }
        if (classes.includes("language-mermaid")) return <MermaidView code={String(child.props.children ?? "")} />;
      }
      return <pre>{children}</pre>;
    },
    // Video, audio and embeds are stored as images whose description names the kind (see lib/media.ts, lib/embed.ts).
    img: ({ src, alt }) => {
      if (typeof src !== "string") return null;
      if (alt === EMBED_ALT) {
        const info = embedSource(src);
        if (info) {
          return (
            <div className="my-3 max-w-2xl overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700" style={{ aspectRatio: info.ratio }}>
              <iframe src={info.src} title="Embedded content" className="h-full w-full" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
            </div>
          );
        }
      }
      const media = parseMediaAlt(alt);
      if (media?.kind === "video") return <video src={src} controls preload="metadata" className="my-3 w-full max-w-2xl rounded-xl bg-black" />;
      if (media?.kind === "audio") return <audio src={src} controls preload="metadata" className="my-3 w-full max-w-xl" />;
      return <ImageFigure src={src} alt={alt ?? ""} />;
    },
    p: ({ children }) => {
      if (textOf(children).trim().toUpperCase() === TOC_MARKER) {
        if (toc.length === 0) return null;
        return (
          <nav className="my-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-700" aria-label="Table of contents">
            {toc.map((h) => (
              <a key={h.id} href={`#${h.id}`} className="block py-0.5 text-zinc-600 no-underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100" style={{ paddingLeft: (h.level - 1) * 16 }}>
                {h.text}
              </a>
            ))}
          </nav>
        );
      }
      return <p>{children}</p>;
    },
    blockquote: ({ children }) => {
      const kids = Children.toArray(children).filter((c) => !(typeof c === "string" && !c.trim()));
      const first = kids[0];
      if (isValidElement<{ children?: React.ReactNode }>(first)) {
        const parts = Children.toArray(first.props.children);
        const info = typeof parts[0] === "string" ? parseAlertMarker(parts[0]) : null;
        if (info) {
          const lead = [info.rest, ...parts.slice(1)];
          const leadText = lead.map(textOf).join("").trim();
          const rest = kids.slice(1);
          if (info.kind === "toggle") {
            return (
              <details className="my-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <summary className="cursor-pointer font-medium text-zinc-900 dark:text-zinc-100">{leadText || "Details"}</summary>
                <div className="mt-2">{rest}</div>
              </details>
            );
          }
          return (
            <div className={`my-3 flex gap-3 rounded-lg border px-4 py-3 ${CALLOUT_TONES[info.type]}`}>
              {(() => {
                const { icon: CalloutIcon, color } = CALLOUT_ICONS[info.type];
                return <CalloutIcon aria-hidden size={18} className={`mt-0.5 shrink-0 ${color}`} />;
              })()}
              <div className="min-w-0 flex-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                {leadText && <p>{lead}</p>}
                {rest}
              </div>
            </div>
          );
        }
      }
      return <blockquote>{children}</blockquote>;
    },
  };
}

const chatComponents = (content: string): Components => ({
  ...pageComponents(content),
  // Scrolls sideways inside its own frame, and gets a search box and pages once it is long (see ChatTable).
  table: ({ children }) => <ChatTable>{children}</ChatTable>,
  // Links to pages in this app navigate without a reload; anything else opens in a new tab.
  a: ({ href, children }) =>
    href && href.startsWith("/") ? (
      <Link
        href={href}
        className="font-medium text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
      >
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
      >
        {children}
      </a>
    ),
});

export function MarkdownView({
  content,
  variant = "page",
}: {
  content: string;
  variant?: "page" | "chat";
}) {
  if (variant === "chat") {
    return (
      <div className={`${CHAT_BASE} ${CHAT_TABLE_CLASSES}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatComponents(content)}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }
  return (
    <div className={WRAPPER_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={pageComponents(content)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
