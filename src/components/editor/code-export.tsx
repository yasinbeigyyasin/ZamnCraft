"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import {
  EXPORT_TARGETS,
  generateCode,
  type ExportFramework,
} from "@/lib/code-generator";
import { useEditorStore } from "@/store/editor-store";

function HighlightedCode({ code }: { code: string }) {
  // Tokens remain React text; generated code is never evaluated or injected as HTML.
  const tokens = code.split(
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:import|from|export|default|function|return|const|false|true|undefined|setup|type|String)\b|<\/?[\w.-]+|\b\d+(?:\.\d+)?\b)/g,
  );
  return tokens.map((token, index) => {
    const kind = /^(?:\/\*|\/\/|<!--)/.test(token)
      ? "comment"
      : /^["']/.test(token)
        ? "string"
        : token.startsWith("<")
          ? "tag"
          : /^\d/.test(token)
            ? "number"
            : /^(?:import|from|export|default|function|return|const|false|true|undefined|setup|type|String)$/.test(
                  token,
                )
              ? "keyword"
              : "plain";
    return kind === "plain" ? (
      token
    ) : (
      <span key={index} className={`code-${kind}`}>
        {token}
      </span>
    );
  });
}

export function CodeExport() {
  const elements = useEditorStore((state) => state.elements);
  const pageName = useEditorStore(
    (state) =>
      state.pages.find((page) => page.id === state.activePageId)?.path ?? "/",
  );
  const [framework, setFramework] = useState<ExportFramework>("react");
  const code = useMemo(
    () => generateCode(elements, framework),
    [elements, framework],
  );
  const target = EXPORT_TARGETS.find((item) => item.id === framework)!;
  const [feedback, setFeedback] = useState("");
  const request = useRef(0);
  const id = useId();
  useEffect(() => {
    request.current++;
    setFeedback("");
    return () => {
      request.current++;
    };
  }, [code]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function copy() {
    const current = ++request.current;
    try {
      await navigator.clipboard.writeText(code);
      if (current === request.current) setFeedback("Copied!");
    } catch {
      if (current === request.current)
        setFeedback(
          "Clipboard unavailable. Select the code to copy, or download the file.",
        );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([code], { type: `${target.mime};charset=utf-8` }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = target.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="code-export">
      <div role="tablist" aria-label="Export framework" className="export-tabs">
        {EXPORT_TARGETS.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            id={`${id}-tab-${item.id}`}
            aria-controls={`${id}-code`}
            aria-selected={framework === item.id}
            tabIndex={framework === item.id ? 0 : -1}
            onClick={() => setFramework(item.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight")
                next = (index + 1) % EXPORT_TARGETS.length;
              else if (event.key === "ArrowLeft")
                next =
                  (index + EXPORT_TARGETS.length - 1) % EXPORT_TARGETS.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = EXPORT_TARGETS.length - 1;
              else return;
              event.preventDefault();
              setFramework(EXPORT_TARGETS[next].id);
              document
                .getElementById(`${id}-tab-${EXPORT_TARGETS[next].id}`)
                ?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="export-note">{target.note}</p>
      <div className="export-file">
        <span>{target.filename}</span>
        <span>Current page: {pageName}</span>
      </div>
      <div
        role="tabpanel"
        id={`${id}-code`}
        aria-labelledby={`${id}-tab-${framework}`}
        className="export-code-panel"
      >
        <pre
          tabIndex={0}
          aria-label="Generated code"
          aria-readonly="true"
          role="textbox"
          aria-multiline="true"
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "a"
            ) {
              event.preventDefault();
              const range = document.createRange();
              range.selectNodeContents(event.currentTarget);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }}
        >
          <code>
            <HighlightedCode code={code} />
          </code>
        </pre>
      </div>
      <div className="export-footer">
        <span role="status" className="export-feedback">
          {feedback}
        </span>
        <button type="button" className="secondary-button" onClick={copy}>
          {feedback === "Copied!" ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          {feedback === "Copied!" ? "Copied!" : "Copy Code"}
        </button>
        <button type="button" className="secondary-button" onClick={download}>
          <Download size={14} aria-hidden="true" />
          Download File
        </button>
      </div>
    </div>
  );
}
