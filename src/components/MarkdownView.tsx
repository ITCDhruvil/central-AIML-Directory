import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const WRAPPER_CLASSES = [
  "text-sm leading-relaxed text-zinc-700 dark:text-zinc-300",
  "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-zinc-900 dark:[&_h1]:text-zinc-100",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100",
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_b]:font-semibold",
  "[&_a]:text-zinc-900 [&_a]:underline dark:[&_a]:text-zinc-100",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-zinc-800",
  "[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-xs dark:[&_pre]:bg-zinc-800",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 dark:[&_blockquote]:border-zinc-700",
  "[&_img]:max-w-full [&_hr]:my-4 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800",
  "[&_del]:text-zinc-400 [&_table]:my-2 [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-200 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-1 dark:[&_th]:border-zinc-800 dark:[&_td]:border-zinc-800",
  "[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0 [&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2 [&_li.task-list-item>input]:mt-1",
].join(" ");

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className={WRAPPER_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
