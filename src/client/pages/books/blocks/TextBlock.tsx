import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

interface TextBlockProps {
  content: Record<string, unknown>;
}

export function TextBlock({ content }: TextBlockProps) {
  const title = typeof content.title === "string" ? content.title : "";
  const body = typeof content.body === "string" ? content.body : "";

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {title && <h3 className="mb-3 text-lg font-semibold">{title}</h3>}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
