import Link from "next/link";
import { ChatTable } from "@/components/ChatTable";
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

const CHAT_COMPONENTS: Components = {
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
};

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
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={CHAT_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }
  return (
    <div className={WRAPPER_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
