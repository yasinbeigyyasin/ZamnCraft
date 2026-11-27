"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Copy, Download } from "lucide-react";
import { FIGMA_KIT_FILENAME, generateFigmaUiKit } from "@/lib/figma-ui-kit";
import { useEditorStore } from "@/store/editor-store";

export function FigmaExport() {
  const projectTitle = useEditorStore((state) => state.projectTitle);
  const [includeModal, setIncludeModal] = useState(true);
  const [feedback, setFeedback] = useState("");
  const request = useRef(0);
  const svg = useMemo(
    () => generateFigmaUiKit({ projectTitle, includeModal }),
    [projectTitle, includeModal],
  );
  useEffect(() => {
    request.current++;
    setFeedback("");
    return () => {
      request.current++;
    };
  }, [svg]);
  async function copy() {
    const current = ++request.current;
    try {
      // Keep SVG source on the text clipboard; never flatten it to a PNG.
      await navigator.clipboard.writeText(svg);
      if (current === request.current)
        setFeedback(
          "SVG copied. Paste onto your Figma canvas. If it pastes as text, download and import the SVG instead.",
        );
    } catch {
      if (current === request.current)
        setFeedback(
          "Clipboard unavailable. Download the SVG and drag it into Figma instead.",
        );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = FIGMA_KIT_FILENAME;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("SVG downloaded. Drag it onto your Figma canvas to import.");
  }
  return (
    <div className="figma-export">
      <p className="dialog-description">
        A 1440 × 900 vector reference of the current editor design. Named groups
        include the toolbar, navigation, selected canvas, expanded Inspector
        controls, and Export Code Modal. This is a UI kit, not a capture of your
        live project.
      </p>
      <label className="figma-export-option">
        <input
          type="checkbox"
          checked={includeModal}
          onChange={(event) => setIncludeModal(event.target.checked)}
        />
        Include Export Code Modal (remove its group in Figma to reveal the
        canvas)
      </label>
      <div className="figma-export-actions">
        <button type="button" className="secondary-button" onClick={copy}>
          <Copy size={14} aria-hidden="true" />
          Copy UI for Figma
        </button>
        <button type="button" className="secondary-button" onClick={download}>
          <Download size={14} aria-hidden="true" />
          Download .svg for Figma
        </button>
      </div>
      <p role="status" className="figma-export-feedback">
        {feedback}
      </p>
      {/* Only our escaped, generated SVG is rendered; project HTML is never used. */}
      <div
        className="figma-export-preview"
        role="img"
        aria-label="1440 by 900 editable editor UI kit preview"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="dialog-description">
        Copy, then press Ctrl+V or Cmd+V on your Figma canvas, or download and
        drag in the SVG. Text stays as SVG text; icons and controls are separate
        vectors. Figma may change layer names or text on import. SVG groups are
        not native Auto Layout frames, components, or working controls; text
        also depends on installed fonts. No plugin or account access is
        required.
      </p>
    </div>
  );
}
