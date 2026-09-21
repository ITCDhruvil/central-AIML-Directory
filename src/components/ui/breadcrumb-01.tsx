import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type BreadcrumbSegment =
  | {
      label: string;
      href: string;
      current?: false;
    }
  | {
      label: string;
      current: true;
      href?: never;
    };

export function Breadcrumb1({ segments }: { segments: readonly BreadcrumbSegment[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="w-full max-w-full justify-center rounded-2xl border border-zinc-200/70 bg-white px-2 py-1.5 shadow-sm sm:w-fit sm:justify-start sm:rounded-full sm:px-3 dark:border-zinc-700/70 dark:bg-zinc-900">
        {segments.map((segment, index) => (
          <BreadcrumbItem key={`${segment.label}-${index}`}>
            {"href" in segment && segment.href ? (
              <BreadcrumbLink href={segment.href}>{segment.label}</BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="max-w-[10rem] truncate sm:max-w-xs">{segment.label}</BreadcrumbPage>
            )}
            {index < segments.length - 1 ? <BreadcrumbSeparator /> : null}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumb1;
