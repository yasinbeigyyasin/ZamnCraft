// A vector reference kit, not a DOM screenshot or a serialization of project content.
export const FIGMA_KIT_FILENAME = "ZamnCraft-Editor-UI-Kit.svg";

export function escapeSvg(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[character]!,
    );
}

export function generateFigmaUiKit({
  projectTitle = "Untitled",
  includeModal = true,
}: { projectTitle?: string; includeModal?: boolean } = {}): string {
  let sequence = 0;
  const id = (name: string) =>
    `${name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "Layer"}-${++sequence}`;
  const group = (name: string, content: string, transform = "") =>
    `<g id="${id(name)}"${transform ? ` transform="${transform}"` : ""}>${content}</g>`;
  const rect = (
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill = "#1b1b1b",
    radius = 0,
    stroke = "none",
  ) =>
    `<rect id="${id(name)}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
  const text = (
    name: string,
    value: string,
    x: number,
    y: number,
    size = 11,
    fill = "#bbbbbb",
    weight = 400,
  ) =>
    `<text id="${id(name)}" x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" xml:space="preserve">${escapeSvg(value)}</text>`;
  const path = (name: string, d: string, stroke = "#888888") =>
    `<path id="${id(name)}" d="${d}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  const paths: Record<string, string> = {
    select: "M4 3 20 11 12 13 9 21Z",
    frame: "M7 3v18M17 3v18M3 7h18M3 17h18",
    text: "M4 5V3h16v2M12 3v18M8 21h8",
    stack: "m3 7 9-5 9 5-9 5ZM3 12l9 5 9-5M3 17l9 5 9-5",
    component:
      "m12 2 4 4-4 4-4-4ZM6 8l4 4-4 4-4-4Zm12 0 4 4-4 4-4-4Zm-6 6 4 4-4 4-4-4Z",
    back: "M19 12H5m6-6-6 6 6 6",
    chevron: "m8 10 4 4 4-4",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    play: "m7 3 14 9-14 9Z",
    undo: "M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5",
    redo: "M21 10H10a6 6 0 0 0 0 12M21 10l-5-5M21 10l-5 5",
    code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
    home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3Z",
    settings: "M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-8 0v6",
    check: "m5 12 4 4L19 6",
    help: "M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    copy: "M9 9h12v12H9ZM5 15H3V3h12v2",
    download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
    hand: "M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v9-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-4l-4-5a2 2 0 0 1 3-3l2 2Z",
    fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
    edit: "m15 3 6 6L8 22H2v-6Z",
    trash: "M3 6h18M8 6V3h8v3M5 6l1 16h12l1-16M10 10v8m4-8v8",
  };
  const icon = (
    name: string,
    x: number,
    y: number,
    kind: string,
    color = "#888888",
    size = 15,
  ) =>
    group(
      name,
      path(`${name}-vector`, paths[kind] ?? paths.frame, color),
      `translate(${x} ${y}) scale(${size / 24})`,
    );
  const button = (
    name: string,
    label: string,
    x: number,
    y: number,
    width: number,
    primary = false,
    kind?: string,
  ) =>
    group(
      name,
      rect(
        "Button background",
        x,
        y,
        width,
        28,
        primary ? "#0099ff" : "#1b1b1b",
        5,
        primary ? "none" : "#333333",
      ) +
        (kind
          ? icon(
              `${name} icon`,
              x + 9,
              y + 7,
              kind,
              primary ? "#ffffff" : "#aaaaaa",
              14,
            )
          : "") +
        text(
          "Button label",
          label,
          x + (kind ? 30 : 10),
          y + 18,
          11,
          "#ffffff",
        ),
    );
  const field = (
    label: string,
    value: string,
    x: number,
    y: number,
    width = 136,
    dropdown = false,
  ) =>
    group(
      `${label} input`,
      rect("Input background", x, y, width, 23, "#1b1b1b", 4) +
        text("Input label", label, x + 8, y + 15, 10, "#999999") +
        text(
          "Input value",
          value,
          x + Math.min(66, width * 0.45),
          y + 15,
          10,
          "#eeeeee",
        ) +
        (dropdown
          ? icon(
              "Dropdown chevron",
              x + width - 18,
              y + 6,
              "chevron",
              "#aaaaaa",
              11,
            )
          : ""),
    );
  const toggle = (label: string, x: number, y: number) =>
    group(
      `${label} toggle`,
      text("Toggle label", label, x, y + 14) +
        rect("Toggle track", x + 244, y + 1, 28, 16, "#0099ff", 8) +
        `<circle id="${id("Toggle thumb")}" cx="${x + 264}" cy="${y + 9}" r="6" fill="#ffffff"/>`,
    );
  const slider = (label: string, value: string, y: number) =>
    group(
      `${label} slider`,
      text("Slider label", label, 0, y + 14) +
        rect("Slider track", 76, y + 8, 127, 3, "#333333", 1.5) +
        rect("Slider progress", 76, y + 8, 100, 3, "#0099ff", 1.5) +
        `<circle id="${id("Slider thumb")}" cx="176" cy="${y + 9}" r="4" fill="#ffffff"/>` +
        text("Slider value", value, 225, y + 14),
    );
  const section = (name: string, y: number, content: string) =>
    group(
      `${name} section`,
      rect("Section divider", 0, 0, 280, 1, "#282828") +
        text("Section heading", name, 0, 19, 11, "#ffffff", 500) +
        icon("Section disclosure", 261, 7, "chevron", "#777777", 12) +
        content,
      `translate(0 ${y})`,
    );

  const toolbar = group(
    "Top Toolbar",
    rect("Toolbar frame", 0, 0, 1440, 48, "#111111") +
      rect("Toolbar bottom border", 0, 47, 1440, 1, "#222222") +
      group(
        "ZamnCraft brand",
        `<path id="${id("Brand top vector")}" d="M18 20 34 12v7l-10 5v7l-6 3Z" fill="#bbbbbb"/><path id="${id("Brand bottom vector")}" d="m24 24 10-5v7l-10 5Z" fill="#777777"/>`,
      ) +
      icon("Project overview", 75, 17, "back") +
      text("Project title", projectTitle.slice(0, 30), 111, 28, 12, "#ffffff") +
      icon("Project menu", 300, 18, "chevron", "#777777", 12) +
      icon("Saved status", 330, 18, "check", "#6eaf91", 12) +
      text("Workspace label", "Local workspace", 349, 28, 10, "#777777") +
      group(
        "Editor tools",
        rect(
          "Selected tool background",
          631,
          9,
          31,
          30,
          "#0b2d42",
          4,
          "#154663",
        ) +
          ["select", "frame", "text", "stack", "component"]
            .map((kind, index) =>
              icon(
                `${kind} tool`,
                640 + index * 37,
                16,
                kind,
                index === 0 ? "#0099ff" : index === 4 ? "#9966ff" : "#999999",
                18,
              ),
            )
            .join(""),
      ) +
      icon("Undo", 1090, 17, "undo") +
      icon("Redo", 1122, 17, "redo") +
      icon("Copy UI to Figma", 1154, 17, "copy") +
      `<circle id="${id("Avatar background")}" cx="1203" cy="24" r="10" fill="#b8c9b5"/>` +
      text("Avatar initial", "Y", 1199, 28, 11, "#263324", 700) +
      icon("Preview site", 1240, 16, "play", "#aaaaaa", 16) +
      button("Export Code button", "Export Code", 1285, 10, 143, true, "code"),
  );

  const navRow = (
    label: string,
    y: number,
    kind: string,
    indent = 0,
    selected = false,
  ) =>
    group(
      `${label} navigation row`,
      rect(
        "Row background",
        12,
        y,
        230,
        30,
        selected ? "#102535" : "#111111",
        5,
        selected ? "#164462" : "none",
      ) +
        icon(
          "Layer type",
          24 + indent,
          y + 8,
          kind,
          selected ? "#0099ff" : "#888888",
          14,
        ) +
        text("Row label", label, 47 + indent, y + 20, 11, "#dddddd") +
        icon("Rename", 199, y + 9, "edit", "#777777", 12) +
        icon("Delete", 221, y + 9, "trash", "#777777", 12),
    );
  const navigation = group(
    "Left Navigation Panel",
    rect("Navigation frame", 0, 48, 256, 852, "#111111", 0, "#222222") +
      group(
        "Pages Layers Assets tabs",
        ["Pages", "Layers", "Assets"]
          .map((label, index) =>
            text(
              `${label} tab`,
              label,
              20 + index * 60,
              75,
              11,
              index === 1 ? "#ffffff" : "#777777",
            ),
          )
          .join("") + rect("Active tab underline", 80, 94, 36, 2, "#ffffff"),
      ) +
      group(
        "Pages panel",
        text("Pages heading", "SITE PAGES", 18, 122, 10, "#777777") +
          navRow("Home", 136, "home") +
          navRow("/about", 169, "home") +
          button("Add page", "Add page", 12, 206, 230, false, "plus"),
      ) +
      group(
        "Layers panel",
        text("Layers heading", "PAGE LAYERS", 18, 279, 10, "#777777") +
          navRow("Desktop", 294, "frame") +
          navRow("Hero", 327, "frame", 16, true) +
          navRow("Heading", 360, "text", 32) +
          navRow("CTA button", 393, "frame", 32) +
          navRow("Tablet", 426, "frame") +
          navRow("Mobile", 459, "frame"),
      ) +
      group(
        "Assets panel",
        text("Assets heading", "YOUR LIBRARY", 18, 532, 10, "#777777") +
          navRow("Button", 549, "component") +
          button(
            "Insert instance",
            "Insert instance",
            24,
            587,
            206,
            false,
            "plus",
          ) +
          button(
            "Create Component",
            "Create Component",
            12,
            631,
            230,
            false,
            "component",
          ) +
          text(
            "Component help",
            "Linked across all your pages.",
            20,
            685,
            10,
            "#777777",
          ),
      ) +
      group(
        "Navigation footer",
        rect("Footer divider", 0, 856, 256, 1, "#222222") +
          `<circle id="${id("Ready status dot")}" cx="19" cy="879" r="3" fill="#68b291"/>` +
          text("Ready label", "Editor ready", 30, 883, 10, "#777777") +
          icon("Editor help", 220, 872, "help", "#888888", 14),
      ),
  );

  const canvas = group(
    "Center Canvas with Selection Box",
    rect("Canvas frame", 256, 48, 896, 852, "#0a0a0a") +
      group(
        "Canvas dot grid",
        Array.from({ length: 28 }, (_, row) =>
          Array.from(
            { length: 35 },
            (_, column) =>
              `<circle id="${id("Grid dot")}" cx="${270 + column * 25}" cy="${110 + row * 25}" r="0.6" fill="#292929"/>`,
          ).join(""),
        ).join(""),
      ) +
      group(
        "Canvas breadcrumbs",
        icon("Home icon", 277, 65, "home", "#666666", 12) +
          text("Breadcrumb", "Home  ›  Canvas", 296, 75, 11, "#666666"),
      ) +
      group(
        "Breakpoint controls",
        rect(
          "Breakpoint control frame",
          822,
          65,
          308,
          30,
          "#111111",
          5,
          "#292929",
        ) +
          text("Desktop breakpoint", "Desktop 1200", 833, 84, 10) +
          text("Tablet breakpoint", "+ Tablet 810", 936, 84, 10) +
          text("Mobile breakpoint", "+ Mobile 390", 1036, 84, 10),
      ) +
      group(
        "Desktop artboard",
        text(
          "Artboard label",
          "Desktop · 1200 × 800",
          330,
          176,
          11,
          "#999999",
        ) +
          rect("Artboard background", 330, 188, 742, 495, "#ffffff") +
          group(
            "Navbar example",
            text("Brand", "Forma", 362, 229, 17, "#142132", 700) +
              text(
                "Navigation links",
                "Product      About      Get in touch",
                827,
                229,
                10,
                "#64748b",
              ) +
              rect("Navbar divider", 330, 246, 742, 1, "#e7edf3"),
          ) +
          group(
            "Selected Hero example",
            rect("Hero frame", 361, 278, 679, 276, "#f8fafc", 8) +
              text(
                "Hero eyebrow",
                "YOUR NEXT IDEA STARTS HERE",
                391,
                322,
                10,
                "#0077cc",
                700,
              ) +
              text(
                "Hero heading line 1",
                "Make room for",
                391,
                367,
                35,
                "#142132",
                700,
              ) +
              text(
                "Hero heading line 2",
                "your next big idea.",
                391,
                410,
                35,
                "#142132",
                700,
              ) +
              text(
                "Hero description",
                "Design, refine, and ship something worth sharing.",
                391,
                447,
                12,
                "#64748b",
              ) +
              button("Canvas CTA", "Start building →", 391, 478, 146, true),
          ) +
          group(
            "Feature cards example",
            [
              "Start with structure",
              "Design for every screen",
              "Bring it to life",
            ]
              .map((label, index) =>
                group(
                  label,
                  rect(
                    "Feature card",
                    361 + index * 230,
                    581,
                    217,
                    70,
                    "#f5f8fb",
                    6,
                  ) +
                    text(
                      "Feature number",
                      `0${index + 1}`,
                      375 + index * 230,
                      605,
                      10,
                      "#0077cc",
                    ) +
                    text(
                      "Feature title",
                      label,
                      375 + index * 230,
                      632,
                      11,
                      "#142132",
                      600,
                    ),
                ),
              )
              .join(""),
          ),
      ) +
      group(
        "Selection Box",
        rect("Selection outline", 361, 278, 679, 276, "none", 0, "#0099ff") +
          rect("Selection name badge", 361, 257, 133, 21, "#0099ff") +
          text(
            "Selection label",
            "Hero   1098 × 446",
            368,
            271,
            10,
            "#ffffff",
          ) +
          [
            [361, 278],
            [700, 278],
            [1040, 278],
            [361, 416],
            [1040, 416],
            [361, 554],
            [700, 554],
            [1040, 554],
          ]
            .map(([x, y]) =>
              rect(
                "Resize handle",
                x - 3,
                y - 3,
                6,
                6,
                "#ffffff",
                0,
                "#0099ff",
              ),
            )
            .join(""),
      ) +
      group(
        "Canvas hints",
        text("Selected tool", "•  Select selected", 276, 826, 10, "#555555") +
          text(
            "Pan and zoom hint",
            "Space + drag to pan · Ctrl / ⌘ + scroll to zoom",
            276,
            868,
            10,
            "#777777",
          ),
      ) +
      group(
        "Zoom controls",
        rect("Zoom control frame", 933, 845, 197, 36, "#111111", 7, "#292929") +
          icon("Pan tool", 946, 855, "hand", "#999999", 16) +
          text("Zoom out", "−", 981, 869, 16) +
          text("Zoom percentage", "62%", 1008, 868, 11) +
          text("Zoom in", "+", 1058, 869, 16) +
          icon("Fit view", 1101, 855, "fit", "#999999", 16),
      ),
  );

  const pair = (a: string, av: string, b: string, bv: string, y: number) =>
    field(a, av, 0, y) + field(b, bv, 144, y);
  const inspectorControls =
    section(
      "Position",
      0,
      field("Type", "Relative", 0, 28, 280, true) +
        pair("X", "50", "Y", "146", 56),
    ) +
    section(
      "Size",
      90,
      pair("W", "1098", "H", "446", 28) +
        pair("Width", "Fixed", "Height", "Fit", 56),
    ) +
    section(
      "Layout",
      180,
      group(
        "Layout mode segmented control",
        ["Free", "Stack", "Grid"]
          .map(
            (label, index) =>
              rect(
                `${label} background`,
                index * 95,
                28,
                90,
                23,
                index === 1 ? "#333333" : "#1b1b1b",
                4,
              ) + text(`${label} label`, label, index * 95 + 24, 43, 10),
          )
          .join(""),
      ) +
        pair("Direction", "Vertical", "Columns", "3", 56) +
        pair("Gap", "24", "Padding", "48", 84) +
        group(
          "Layout alignment controls",
          [
            "Main start",
            "Main center",
            "Main end",
            "Cross start",
            "Cross center",
            "Cross end",
          ]
            .map((label, index) =>
              group(
                label,
                rect(
                  "Alignment button",
                  index * 47,
                  112,
                  42,
                  23,
                  "#1b1b1b",
                  3,
                ) +
                  icon(
                    "Alignment vector",
                    index * 47 + 13,
                    117,
                    index % 3 === 1 ? "fit" : "back",
                    "#aaaaaa",
                    13,
                  ),
              ),
            )
            .join(""),
        ),
    ) +
    section(
      "Styles",
      326,
      group(
        "Fill control",
        field("Fill", "#f8fafc", 0, 28, 280) +
          rect("Fill swatch", 221, 32, 15, 15, "#f8fafc", 2, "#777777") +
          icon("Remove fill", 253, 34, "close", "#999999", 12),
      ) +
        slider("Opacity", "100%", 58) +
        pair("Radius", "8", "Border", "Solid", 84) +
        pair("Width", "0", "Color", "#222", 112),
    ) +
    section(
      "Typography",
      472,
      field("Content", "Your next big idea.", 0, 28, 280) +
        pair("Size", "56", "Weight", "700", 56) +
        pair("Color", "#142132", "Align", "Left", 84),
    ) +
    section(
      "Effects & Animations",
      590,
      toggle("Appear", 0, 28) +
        pair("Opacity", "0", "Scale", "1", 51) +
        pair("Offset X", "0", "Offset Y", "20", 79) +
        toggle("Hover", 0, 110) +
        pair("Scale", "1.04", "Rotate", "0°", 133) +
        pair("Fill", "#0099ff", "Opacity", "100%", 161) +
        toggle("Fill override", 0, 192) +
        toggle("Opacity override", 0, 215) +
        toggle("Press", 0, 243) +
        field("Press scale", "0.96", 0, 266, 280) +
        field("Transition", "Spring", 0, 294, 280, true) +
        pair("Duration", "0.3s", "Stiffness", "400", 322) +
        pair("Damping", "30", "Blur", "0", 350) +
        field("Shadow preset", "Custom", 0, 378, 280, true) +
        field("Shadow CSS", "0 4px 12px #00000026", 0, 406, 280) +
        button(
          "Replay animation",
          "Replay animation",
          0,
          438,
          280,
          false,
          "play",
        ),
    );
  const inspector = group(
    "Right Inspector Panel",
    rect("Inspector frame", 1152, 48, 288, 852, "#111111", 0, "#222222") +
      text("Inspector title", "Inspector", 1170, 75, 11, "#ffffff") +
      icon("Inspector settings", 1411, 64, "settings", "#888888", 14) +
      rect("Inspector heading divider", 1152, 95, 288, 1, "#222222") +
      icon("Selected element icon", 1171, 114, "select", "#888888", 20) +
      text("Selected element name", "Hero", 1206, 122, 11) +
      text(
        "Inspector subtitle",
        "Expanded control inventory",
        1206,
        141,
        10,
        "#777777",
      ) +
      group(
        "All Inspector inputs and sections",
        inspectorControls,
        "translate(1204 162) scale(0.66)",
      ) +
      group(
        "Inspector footer",
        rect("Footer divider", 1152, 856, 288, 1, "#222222") +
          text("Product footer", "Z  ZamnCraft", 1171, 883, 11, "#666666") +
          text("Editor badge", "EDITOR", 1383, 883, 9, "#666666"),
      ),
  );

  const modal = group(
    "Export Code Modal",
    group(
      "Modal backdrop",
      `<rect id="${id("Backdrop tint")}" x="256" y="96" width="896" height="748" fill="#000000" opacity="0.5"/>`,
    ) +
      rect("Modal frame", 397, 205, 650, 508, "#151515", 10, "#333333") +
      text("Modal title", "Export Code", 419, 238, 14, "#ffffff") +
      icon("Close modal", 1011, 225, "close", "#999999", 16) +
      rect("Header divider", 397, 258, 650, 1, "#333333") +
      group(
        "Framework tabs",
        ["React", "Vue", "Svelte", "HTML/CSS"]
          .map((label, index) =>
            text(
              `${label} framework tab`,
              label,
              420 + index * 110,
              289,
              12,
              index === 0 ? "#ffffff" : "#888888",
            ),
          )
          .join("") +
          rect("Active framework underline", 419, 303, 61, 2, "#0099ff"),
      ) +
      text(
        "Framework setup note",
        "React / Next.js · Tailwind CSS · Framer Motion for effects",
        419,
        330,
        11,
        "#999999",
      ) +
      text("Export filename", "Page.tsx", 419, 359, 11) +
      text("Current page", "Current page: /", 934, 359, 10, "#888888") +
      group(
        "Editable code viewer",
        rect("Code background", 419, 373, 606, 265, "#0c0c0c", 5, "#292929") +
          [
            '"use client";',
            "",
            'import { motion } from "framer-motion";',
            "",
            "export default function Page() {",
            "  return (",
            '    <main className="zc-design">',
            '      <motion.section className="hero">',
            "        <h1>Your next big idea.</h1>",
            "      </motion.section>",
            "    </main>",
            "  );",
            "}",
          ]
            .map((line, index) =>
              text(
                `Code line ${index + 1}`,
                line,
                436,
                395 + index * 18,
                11,
                index < 5 ? "#bda5e8" : "#a5c8e8",
              ),
            )
            .join(""),
      ) +
      group(
        "Export actions",
        text("Copy status", "Ready to export", 419, 682, 10, "#777777") +
          button("Copy Code", "Copy Code", 748, 660, 118, false, "copy") +
          button(
            "Download File",
            "Download File",
            881,
            660,
            144,
            false,
            "download",
          ),
      ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" fill="none"><title>ZamnCraft Editor UI Kit</title><desc>Editable vector reference, 1440 by 900. Named panel, control, text and icon groups. Navigation and Inspector show a compact inventory of alternate states. ${includeModal ? "Remove the Export Code Modal group to reveal the canvas." : "Export modal omitted."} SVG groups are not native Figma Auto Layout frames or components. No project contents are included.</desc>${group("ZamnCraft Editor Artboard 1440x900", rect("Artboard frame", 0, 0, 1440, 900, "#0a0a0a") + toolbar + navigation + canvas + inspector + (includeModal ? modal : ""))}</svg>\n`;
}
