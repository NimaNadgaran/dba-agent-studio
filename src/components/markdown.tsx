"use client";

import { useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Diagram({ source }: { source: string }) {
  const id = `diagram${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSvg(""); setError("");
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: { primaryColor: "#f3f7ee", primaryTextColor: "#263b2a", primaryBorderColor: "#a3b596", lineColor: "#82917d", fontFamily: "Arial, sans-serif", fontSize: "13px" }, er: { useMaxWidth: true } });
      const result = await mermaid.render(id, source);
      if (active) setSvg(result.svg);
    }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, [id, source]);
  return <div className="diagram-view" aria-label="Entity relationship diagram">{svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : error ? <><p>Diagram could not render. Source is available:</p><pre>{source}</pre><small>{error}</small></> : <div className="diagram-loading"><span className="spinner" /> Rendering relationship map…</div>}</div>;
}

export default function Markdown({ content }: { content: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    pre: ({ children }) => <div className="code-container">{children}</div>,
    code: ({ className, children }) => className?.includes("language-mermaid") ? <Diagram source={String(children).trim()} /> : className ? <pre><code className={className}>{children}</code></pre> : <code>{children}</code>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
  }}>{content}</ReactMarkdown></div>;
}
