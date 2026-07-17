import { Lightbulb, AlertTriangle, Info, BookMarked } from "lucide-react";

interface CalloutBlockProps {
  content: Record<string, unknown>;
}

export function CalloutBlock({ content }: CalloutBlockProps) {
  const type = typeof content.type === "string" ? content.type : "info";
  const body = typeof content.body === "string" ? content.body : "";

  const styles: Record<
    string,
    { icon: typeof Info; className: string; label: string }
  > = {
    tip: {
      icon: Lightbulb,
      className:
        "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300",
      label: "Tip",
    },
    warning: {
      icon: AlertTriangle,
      className:
        "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300",
      label: "Warning",
    },
    definition: {
      icon: BookMarked,
      className:
        "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300",
      label: "Definition",
    },
    info: {
      icon: Info,
      className:
        "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
      label: "Info",
    },
  };

  const style = styles[type] ?? styles.info;
  const { icon: Icon, className, label } = style!;

  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </span>
          <p className="mt-1 text-sm leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
