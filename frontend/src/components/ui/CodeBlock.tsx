import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({
  code,
  language = "python"
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-slate-950/60">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-slate-900/80 px-2 py-1 text-xs font-medium text-slate-400 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem 1.25rem",
          background: "transparent",
          fontSize: "0.8125rem",
          lineHeight: "1.6"
        }}
        codeTagProps={{
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          }
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
