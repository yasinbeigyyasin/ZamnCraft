/* ZamnCraft editable screen importer. Local development plugin; no network. */
(async function () {
  const originalPage = figma.currentPage;
  const createdPages = [];
  try {
    const available = (await figma.listAvailableFontsAsync()).map(
      (item) => item.fontName,
    );
    const regular =
      ["Inter", "Roboto", "Arial"]
        .map((family) =>
          available.find(
            (font) => font.family === family && font.style === "Regular",
          ),
        )
        .find(Boolean) || available.find((font) => font.style === "Regular");
    if (!regular)
      throw new Error(
        "No Regular font is available. Enable Inter or Roboto and run again.",
      );
    const bold =
      available.find(
        (font) => font.family === regular.family && font.style === "Bold",
      ) || regular;
    await figma.loadFontAsync(regular);
    if (bold !== regular) await figma.loadFontAsync(bold);

    const C = {
      panel: "#111111",
      canvas: "#0a0a0a",
      border: "#292929",
      field: "#1b1b1b",
      text: "#eeeeee",
      muted: "#888888",
      blue: "#0099ff",
      purple: "#9966ff",
    };
    function paint(hex) {
      const rgb = hex.replace("#", "");
      return {
        type: "SOLID",
        color: {
          r: parseInt(rgb.slice(0, 2), 16) / 255,
          g: parseInt(rgb.slice(2, 4), 16) / 255,
          b: parseInt(rgb.slice(4, 6), 16) / 255,
        },
      };
    }
    function place(node, parent, name, x, y, width, height) {
      parent.appendChild(node);
      node.name = name;
      node.resize(width, height);
      node.x = x;
      node.y = y;
      return node;
    }
    function frame(
      parent,
      name,
      x,
      y,
      width,
      height,
      fill = C.panel,
      radius = 0,
      clip = false,
    ) {
      const node = place(
        figma.createFrame(),
        parent,
        name,
        x,
        y,
        width,
        height,
      );
      node.fills = fill ? [paint(fill)] : [];
      node.cornerRadius = radius;
      node.clipsContent = clip;
      return node;
    }
    function rect(
      parent,
      name,
      x,
      y,
      width,
      height,
      fill = C.field,
      radius = 0,
      stroke,
    ) {
      const node = place(
        figma.createRectangle(),
        parent,
        name,
        x,
        y,
        width,
        height,
      );
      node.fills = fill ? [paint(fill)] : [];
      node.cornerRadius = radius;
      node.strokes = stroke ? [paint(stroke)] : [];
      node.strokeWeight = 1;
      return node;
    }
    function text(
      parent,
      name,
      value,
      x,
      y,
      width = 240,
      size = 11,
      color = C.text,
      strong = false,
    ) {
      const node = figma.createText();
      parent.appendChild(node);
      node.name = name;
      node.fontName = strong ? bold : regular;
      node.fontSize = size;
      node.lineHeight = { value: 150, unit: "PERCENT" };
      node.fills = [paint(color)];
      node.characters = value;
      node.textAutoResize = "HEIGHT";
      node.resize(width, size * 1.5);
      node.x = x;
      node.y = y;
      return node;
    }
    const paths = {
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
      help: "M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
      download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
      copy: "M9 9h12v12H9ZM5 15H3V3h12v2",
      edit: "m15 3 6 6L8 22H2v-6Z",
      trash: "M3 6h18M8 6V3h8v3M5 6l1 16h12l1-16M10 10v8m4-8v8",
      fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
      hand: "M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v9-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-4l-4-5a2 2 0 0 1 3-3l2 2Z",
      check: "m5 12 4 4L19 6",
    };
    function icon(
      parent,
      name,
      x,
      y,
      kind = "frame",
      color = C.muted,
      size = 16,
    ) {
      const node = figma.createNodeFromSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="' +
          (paths[kind] || paths.frame) +
          '" fill="none" stroke="' +
          color +
          '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      );
      parent.appendChild(node);
      node.name = name;
      node.rescale(size / 24);
      node.x = x;
      node.y = y;
      return node;
    }
    function button(parent, label, x, y, width, primary = false, kind) {
      const node = frame(
        parent,
        "Button / " + label,
        x,
        y,
        width,
        32,
        primary ? C.blue : "#242424",
        5,
      );
      if (kind) icon(node, "Icon / " + kind, 9, 8, kind, C.text, 14);
      text(node, "Label", label, kind ? 30 : 10, 7, width - (kind ? 36 : 16));
      return node;
    }
    function input(parent, label, value, x, y, width = 122, select = false) {
      const node = frame(
        parent,
        (select ? "Select / " : "Input / ") + label,
        x,
        y,
        width,
        30,
        C.field,
        4,
      );
      text(node, "Label", label, 8, 7, width * 0.43, 10, C.muted);
      text(
        node,
        "Value",
        value,
        width * 0.47,
        7,
        width * 0.48 - (select ? 14 : 0),
        10,
      );
      if (select) icon(node, "Dropdown", width - 16, 9, "chevron", C.muted, 10);
      return node;
    }
    function toggle(parent, label, y) {
      const row = frame(parent, "Toggle / " + label, 16, y, 256, 28, null);
      text(row, "Label", label, 0, 5, 216);
      rect(row, "Track", 226, 5, 28, 16, C.blue, 8);
      rect(row, "Thumb", 240, 7, 12, 12, "#ffffff", 6);
    }
    function slider(parent, label, y) {
      const row = frame(parent, "Slider / " + label, 16, y, 256, 30, null);
      text(row, "Label", label, 0, 6, 60, 10, C.muted);
      rect(row, "Track", 69, 14, 126, 3, "#444444", 1);
      rect(row, "Progress", 69, 14, 104, 3, C.blue, 1);
      rect(row, "Thumb", 170, 11, 8, 8, "#ffffff", 4);
      text(row, "Value", "100%", 212, 6, 44, 10);
    }
    function toolbar(parent, width = 1440) {
      const bar = frame(parent, "Top Toolbar", 0, 0, width, 48);
      rect(bar, "Bottom border", 0, 47, width, 1, C.border);
      if (width < 700) {
        icon(bar, "Overview", 14, 16, "back");
        [
          "select",
          "frame",
          "text",
          "component",
          "undo",
          "redo",
          "play",
          "code",
        ].forEach((kind, index) =>
          icon(
            bar,
            kind,
            64 + index * 38,
            16,
            kind,
            index === 0 ? C.blue : C.muted,
          ),
        );
        return bar;
      }
      text(bar, "Brand", "Z", 17, 8, 30, 22, "#bbbbbb", true);
      icon(bar, "Project overview", 75, 16, "back");
      text(bar, "Project title", "Untitled", 111, 15, 140, 12);
      icon(bar, "Project menu", 245, 18, "chevron", C.muted, 12);
      icon(bar, "Saved", 281, 18, "check", "#6eaf91", 12);
      text(
        bar,
        "Workspace status",
        "Local workspace",
        299,
        16,
        140,
        10,
        C.muted,
      );
      rect(bar, "Active tool", 631, 9, 31, 30, "#0b2d42", 4);
      ["select", "frame", "text", "stack", "component"].forEach((kind, index) =>
        icon(
          bar,
          "Tool / " + kind,
          640 + index * 37,
          16,
          kind,
          index === 0 ? C.blue : kind === "component" ? C.purple : C.muted,
          18,
        ),
      );
      icon(bar, "Undo", 1150, 16, "undo");
      icon(bar, "Redo", 1185, 16, "redo");
      rect(bar, "Avatar", 1221, 14, 20, 20, "#b8c9b5", 10);
      text(bar, "Avatar initial", "Y", 1226, 15, 12, 11, "#263324", true);
      icon(bar, "Preview", 1270, 16, "play");
      button(bar, "Export Code", 1306, 8, 122, true, "code");
      return bar;
    }
    function navigation(parent, tab, x = 0, y = 48) {
      const panel = frame(parent, "Left Navigation / " + tab, x, y, 256, 852);
      ["Pages", "Layers", "Assets"].forEach((label, index) =>
        text(
          panel,
          "Tab / " + label,
          label,
          20 + index * 61,
          16,
          55,
          11,
          label === tab ? C.text : C.muted,
        ),
      );
      rect(
        panel,
        "Active tab underline",
        20 + ["Pages", "Layers", "Assets"].indexOf(tab) * 61,
        46,
        35,
        2,
        "#ffffff",
      );
      text(
        panel,
        "Section title",
        tab === "Pages"
          ? "SITE PAGES"
          : tab === "Layers"
            ? "PAGE LAYERS"
            : "YOUR LIBRARY",
        18,
        67,
        220,
        10,
        C.muted,
      );
      const rows =
        tab === "Pages"
          ? [
              ["Home", "home", 0],
              ["/about", "home", 0],
            ]
          : tab === "Layers"
            ? [
                ["Desktop", "frame", 0],
                ["Hero", "frame", 16],
                ["Heading", "text", 32],
                ["CTA button", "frame", 32],
                ["Tablet", "frame", 0],
                ["Mobile", "frame", 0],
              ]
            : [
                ["Button", "component", 0],
                ["Feature card", "component", 0],
              ];
      rows.forEach(([label, kind, indent], index) => {
        const row = frame(
          panel,
          "Row / " + label,
          12,
          96 + index * 34,
          230,
          32,
          index === (tab === "Layers" ? 1 : 0) ? "#142432" : C.panel,
          5,
        );
        icon(
          row,
          "Type icon",
          12 + indent,
          9,
          kind,
          kind === "component" ? C.purple : C.muted,
          14,
        );
        text(row, "Name", label, 35 + indent, 8, 130 - indent);
        icon(row, "Rename", 187, 10, "edit", C.muted, 12);
        icon(row, "Delete", 209, 10, "trash", C.muted, 12);
      });
      if (tab === "Pages") {
        button(panel, "Add page", 12, 174, 230, false, "plus");
        text(
          panel,
          "Page helper",
          "Your site starts here.\nA little blank space. A lot of possibility.",
          20,
          264,
          215,
          11,
          C.muted,
        );
      }
      if (tab === "Assets") {
        button(panel, "Insert instance", 12, 180, 230, false, "plus");
        button(panel, "Create Component", 12, 222, 230, false, "component");
        button(panel, "Edit master", 12, 264, 230, false, "edit");
        button(panel, "Detach instance", 12, 306, 230);
        text(
          panel,
          "Component help",
          "Master edits update linked instances across pages. Detach to edit independently.",
          20,
          370,
          216,
          11,
          C.muted,
        );
      }
      rect(panel, "Footer border", 0, 808, 256, 1, C.border);
      rect(panel, "Status dot", 16, 828, 6, 6, "#68b291", 3);
      text(panel, "Status", "Editor ready", 30, 820, 150, 10, C.muted);
      icon(panel, "Editor help", 220, 820, "help", C.muted, 15);
      return panel;
    }

    const sections = [
      {
        name: "Position",
        rows: [
          ["Type", "Relative"],
          [
            ["X", "50"],
            ["Y", "146"],
          ],
        ],
      },
      {
        name: "Size",
        rows: [
          [
            ["W", "1098"],
            ["H", "446"],
          ],
          [
            ["Width", "Fixed"],
            ["Height", "Fit"],
          ],
        ],
      },
      {
        name: "Layout",
        rows: [
          { buttons: ["Free", "Stack", "Grid"] },
          ["Direction", "Vertical"],
          [
            ["Gap", "24"],
            ["Padding", "48"],
          ],
          { buttons: ["←", "↔", "→", "↑", "↕", "↓"] },
          ["Columns", "3 (Grid)"],
        ],
      },
      {
        name: "Styles",
        rows: [
          ["Fill", "#ffffff"],
          { buttons: ["Color picker", "Remove fill"] },
          { slider: "Opacity" },
          [
            ["Radius", "8"],
            ["Border", "Solid"],
          ],
          [
            ["Width", "1"],
            ["Color", "#222222"],
          ],
        ],
      },
      {
        name: "Typography",
        rows: [
          ["Content", "Your next big idea."],
          [
            ["Font size", "56"],
            ["Weight", "700"],
          ],
          ["Text color", "#142132"],
          { buttons: ["Left", "Center", "Right", "Justify"] },
        ],
      },
      {
        name: "Effects & Animations",
        rows: [
          { toggle: "Appear" },
          [
            ["Opacity %", "0"],
            ["Scale", "1"],
          ],
          [
            ["Offset X", "0"],
            ["Offset Y", "20"],
          ],
          { buttons: ["Replay animation"] },
          { toggle: "Hover" },
          [
            ["Scale", "1.04"],
            ["Rotate °", "0"],
          ],
          { toggle: "Fill override" },
          ["Hover fill", "#0099ff"],
          { toggle: "Opacity override" },
          ["Hover opacity", "100%"],
          { toggle: "Press" },
          ["Press scale", "0.96"],
          ["Transition", "Spring / Ease"],
          ["Duration (s)", "0.3 (Ease)"],
          [
            ["Stiffness", "400"],
            ["Damping", "30"],
          ],
          ["Blur (px)", "0"],
          ["Shadow preset", "Custom"],
          ["Shadow CSS", "0 4px 12px #00000026"],
        ],
      },
    ];
    function inspectorSection(parent, section, x, y) {
      const panel = frame(
        parent,
        "Inspector section / " + section.name,
        x,
        y,
        288,
        48 + section.rows.length * 38,
      );
      rect(panel, "Top divider", 0, 0, 288, 1, C.border);
      text(panel, "Section heading", section.name, 16, 13, 240);
      icon(panel, "Disclosure", 260, 16, "chevron", C.muted, 12);
      section.rows.forEach((row, index) => {
        const top = 43 + index * 38;
        if (row.toggle) toggle(panel, row.toggle, top);
        else if (row.slider) slider(panel, row.slider, top);
        else if (row.buttons) {
          const w = (256 - (row.buttons.length - 1) * 4) / row.buttons.length;
          row.buttons.forEach((label, i) =>
            button(panel, label, 16 + i * (w + 4), top, w),
          );
        } else if (Array.isArray(row[0])) {
          row.forEach(([label, value], i) =>
            input(panel, label, value, 16 + i * 132, top),
          );
        } else input(panel, row[0], row[1], 16, top, 256);
      });
      return panel;
    }
    function inspector(parent, x = 1152, y = 48, height = 852, all = false) {
      const panel = frame(
        parent,
        "Right Inspector Panel",
        x,
        y,
        288,
        height,
        C.panel,
        0,
        !all,
      );
      text(panel, "Panel heading", "Inspector", 18, 16, 235);
      rect(panel, "Heading divider", 0, 47, 288, 1, C.border);
      icon(panel, "Selection icon", 20, 70, "select", C.muted, 20);
      text(panel, "Selection name", "Hero", 55, 63, 210);
      text(panel, "Live hint", "Changes apply live", 55, 84, 210, 10, C.muted);
      let top = 116;
      sections.forEach((section) => {
        const node = inspectorSection(panel, section, 0, top);
        top += node.height;
      });
      if (all) panel.resize(288, top + 16);
      return panel;
    }
    function landing(parent, width, height = 800) {
      const root = frame(
        parent,
        "Desktop design / sample content",
        0,
        0,
        width,
        height,
        "#ffffff",
        0,
        true,
      );
      text(root, "Brand", "Forma", 40, 30, width - 80, 26, "#142132", true);
      if (width >= 700)
        text(
          root,
          "Navbar links",
          "Product      About      Get in touch",
          width - 335,
          39,
          300,
          14,
          "#64748b",
        );
      rect(root, "Navbar divider", 0, 88, width, 1, "#e7edf3");
      const hero = frame(root, "Hero", 40, 130, width - 80, 400, "#f8fafc", 8);
      text(
        hero,
        "Eyebrow",
        "YOUR NEXT IDEA STARTS HERE",
        28,
        30,
        width - 140,
        12,
        "#0077cc",
        true,
      );
      text(
        hero,
        "Heading",
        "Make room for\nyour next big idea.",
        28,
        76,
        width - 140,
        width < 500 ? 30 : 56,
        "#142132",
        true,
      );
      text(
        hero,
        "Description",
        "Design, refine, and ship something worth sharing.",
        28,
        260,
        width - 140,
        16,
        "#64748b",
      );
      button(hero, "Start building →", 28, 326, 170, true);
      const labels = [
        "Start with structure",
        "Design for every screen",
        "Bring it to life",
      ];
      const mobile = width < 700;
      labels.forEach((label, index) => {
        const w = mobile ? width - 80 : (width - 120) / 3;
        const card = frame(
          root,
          "Feature / " + label,
          40 + (mobile ? 0 : index * (w + 20)),
          568 + (mobile ? index * 142 : 0),
          w,
          122,
          "#f5f8fb",
          8,
        );
        text(card, "Number", "0" + (index + 1), 18, 15, w - 36, 12, "#0077cc");
        text(card, "Title", label, 18, 43, w - 36, 16, "#142132", true);
        text(
          card,
          "Body",
          "Make every detail your own.",
          18,
          83,
          w - 36,
          12,
          "#64748b",
        );
      });
      return root;
    }
    function canvas(parent, mode = "selected") {
      const panel = frame(
        parent,
        "Center Canvas",
        256,
        48,
        896,
        852,
        C.canvas,
        0,
        true,
      );
      text(
        panel,
        "Breadcrumbs",
        "⌂  Home  ›  Canvas",
        20,
        17,
        300,
        11,
        "#666666",
      );
      const controls = frame(
        panel,
        "Breakpoint controls",
        568,
        17,
        308,
        32,
        C.panel,
        5,
      );
      ["Desktop 1200", "+ Tablet 810", "+ Mobile 390"].forEach((label, i) =>
        text(controls, label, label, 10 + i * 101, 9, 100, 10, C.muted),
      );
      if (mode === "breakpoints") {
        [1200, 810, 390].forEach((width, i) => {
          const design = landing(panel, width, 1100);
          design.name = ["Desktop / 1200", "Tablet / 810", "Mobile / 390"][i];
          design.rescale(0.3);
          design.x = [40, 424, 691][i];
          design.y = 180;
          text(
            panel,
            "Breakpoint label",
            design.name,
            design.x,
            152,
            design.width,
            10,
            C.muted,
          );
        });
      } else {
        const design = landing(panel, 1200);
        design.rescale(0.62);
        design.x = 76;
        design.y = 145;
        text(
          panel,
          "Artboard label",
          "Desktop  ·  1200 × 800",
          76,
          119,
          300,
          11,
          C.muted,
        );
        const selection = frame(
          panel,
          "Selection Box / Hero",
          100,
          226,
          695,
          248,
          null,
        );
        rect(selection, "Outline", 0, 0, 695, 248, null, 0, C.blue);
        const badge = frame(selection, "Size badge", 0, -21, 154, 21, C.blue);
        text(badge, "Label", "Hero  1120 × 400", 6, 3, 145, 10, "#ffffff");
        [
          [0, 0],
          [347, 0],
          [695, 0],
          [0, 124],
          [695, 124],
          [0, 248],
          [347, 248],
          [695, 248],
        ].forEach(([x, y], i) =>
          rect(
            selection,
            "Resize handle " + (i + 1),
            x - 3,
            y - 3,
            6,
            6,
            "#ffffff",
            0,
            C.blue,
          ),
        );
      }
      text(
        panel,
        "Canvas hints",
        "Space + drag to pan · Ctrl / ⌘ + scroll to zoom",
        20,
        809,
        500,
        10,
        C.muted,
      );
      const zoom = frame(panel, "Zoom controls", 679, 797, 197, 36, C.panel, 6);
      icon(zoom, "Pan tool", 12, 10, "hand", C.muted, 16);
      text(zoom, "Controls", "−     62%     +", 48, 9, 112, 11, C.muted);
      icon(zoom, "Fit view", 169, 10, "fit", C.muted, 16);
      return panel;
    }
    function desktop(page, name, index, tab = "Layers", mode = "selected") {
      const root = frame(
        page,
        name,
        (index % 3) * 1540,
        Math.floor(index / 3) * 1020,
        1440,
        900,
        C.canvas,
        0,
        true,
      );
      toolbar(root);
      navigation(root, tab);
      canvas(root, mode);
      inspector(root);
      return root;
    }
    function dialog(parent, title, type) {
      const overlay = frame(
        parent,
        "Dialog backdrop",
        0,
        48,
        parent.width,
        parent.height - 48,
        "#000000",
      );
      overlay.opacity = 0.65;
      const width =
        parent.width < 700 ? parent.width - 32 : type === "export" ? 800 : 440;
      const height = type === "export" ? 650 : type === "workspace" ? 620 : 530;
      const box = frame(
        parent,
        "Dialog / " + title,
        (parent.width - width) / 2,
        Math.max(64, (parent.height - height) / 2),
        width,
        height,
        "#161616",
        12,
        true,
      );
      text(box, "Title", title, 20, 18, width - 65, 14);
      icon(box, "Close dialog", width - 35, 21, "close");
      rect(box, "Header divider", 0, 58, width, 1, C.border);
      if (type === "export") {
        ["React", "Vue", "Svelte", "HTML/CSS"].forEach((label, i) =>
          text(
            box,
            "Framework / " + label,
            label,
            20 + (i * (width - 40)) / 4,
            78,
            (width - 40) / 4,
            11,
            i ? C.muted : C.text,
          ),
        );
        rect(box, "Active tab", 20, 104, 40, 2, C.blue);
        text(
          box,
          "Framework setup",
          "React / Next.js · Tailwind CSS · Framer Motion",
          20,
          122,
          width - 40,
          11,
          C.muted,
        );
        text(
          box,
          "Filename",
          "Page.tsx     ·     Current page: /",
          20,
          164,
          width - 40,
          11,
        );
        const code = frame(
          box,
          "Code viewer",
          20,
          195,
          width - 40,
          330,
          "#0c0c0c",
          5,
          true,
        );
        text(
          code,
          "Editable code text",
          '"use client";\n\nimport { motion } from "framer-motion";\n\nexport default function Page() {\n  return (\n    <main className="zc-design">\n      <motion.section>\n        <h1>Your next big idea.</h1>\n      </motion.section>\n    </main>\n  );\n}',
          16,
          16,
          width - 72,
          11,
          "#bda5e8",
        );
        button(box, "Copy Code", 20, 548, 120, false, "copy");
        button(
          box,
          "Download File",
          width < 500 ? 20 : width - 175,
          width < 500 ? 592 : 548,
          155,
          false,
          "download",
        );
      } else if (type === "workspace") {
        text(
          box,
          "Project title label",
          "Project title",
          20,
          78,
          width - 40,
          12,
          C.muted,
        );
        input(box, "Title", "Untitled", 20, 108, width - 40);
        button(box, "Rename project", 20, 153, 150);
        text(
          box,
          "Save status",
          "Automatically saved in this browser. Pages, components and project title stay here when you refresh. History lasts for this session only.",
          20,
          208,
          width - 40,
          12,
          C.muted,
        );
        button(box, "Load Landing Page Starter", 20, 304, width - 40);
        text(
          box,
          "Starter description",
          "Editable Navbar, Hero, CTA and Feature cards.",
          20,
          349,
          width - 40,
          11,
          C.muted,
        );
        button(box, "Reset to clean canvas", 20, 392, width - 40);
        text(
          box,
          "Confirmation message",
          "Replace this workspace? This replaces all current pages and components. You can undo before refreshing.",
          20,
          448,
          width - 40,
          12,
        );
        button(box, "Confirm replacement", 20, 538, 180);
        button(box, "Cancel", 212, 538, 100);
      } else {
        button(box, "Copy UI to Figma", 20, 78, width - 40, false, "copy");
        text(
          box,
          "Shortcuts",
          "V — Select\nF — Frame\nT — Text\nC — Create Component\nCtrl/Cmd+Z — Undo\nCtrl/Cmd+Shift+Z / Ctrl+Y — Redo\nSpace + drag — Pan\nCtrl/Cmd + scroll — Zoom\nDelete / Backspace — Delete selection\nEscape — Cancel or exit preview",
          20,
          135,
          width - 40,
          12,
          C.muted,
        );
      }
      return box;
    }

    figma.notify("Creating ZamnCraft screens and editable UI parts…");
    const screens = figma.createPage();
    createdPages.push(screens);
    screens.name = "ZamnCraft · 01 Screens";
    const parts = figma.createPage();
    createdPages.push(parts);
    parts.name = "ZamnCraft · 02 UI Parts";
    await figma.setCurrentPageAsync(screens);
    const first = desktop(screens, "01 / Desktop · Pages", 0, "Pages");
    desktop(screens, "02 / Desktop · Layers & Selection", 1);
    desktop(screens, "03 / Desktop · Assets", 2, "Assets");
    desktop(screens, "04 / Responsive Breakpoints", 3, "Layers", "breakpoints");
    const exportScreen = desktop(screens, "05 / Export Code Modal", 4);
    dialog(exportScreen, "Export Code", "export");
    const workspace = desktop(
      screens,
      "06 / Local Workspace & Confirmation",
      5,
      "Pages",
    );
    dialog(workspace, "Local workspace", "workspace");
    const help = desktop(screens, "07 / Editor Help", 6);
    dialog(help, "Editor shortcuts", "help");
    const preview = frame(
      screens,
      "08 / Desktop Preview",
      1540,
      2040,
      1440,
      900,
      C.canvas,
      0,
      true,
    );
    button(preview, "Exit preview", 1260, 8, 160);
    const previewDesign = landing(preview, 1200);
    previewDesign.x = 120;
    previewDesign.y = 70;
    const mobile = frame(
      screens,
      "09 / Mobile Editor",
      3080,
      2040,
      390,
      844,
      C.canvas,
      0,
      true,
    );
    toolbar(mobile, 390);
    text(mobile, "Breadcrumb", "Home › Canvas", 20, 65, 250, 10, C.muted);
    const mobileDesign = landing(mobile, 390, 1100);
    mobileDesign.rescale(0.88);
    mobileDesign.x = 23;
    mobileDesign.y = 110;
    const mobileNav = frame(
      screens,
      "10 / Mobile Navigation",
      0,
      3060,
      390,
      844,
      C.canvas,
      0,
      true,
    );
    toolbar(mobileNav, 390);
    navigation(mobileNav, "Layers", 16, 64);
    const mobileInspector = frame(
      screens,
      "11 / Mobile Inspector",
      520,
      3060,
      390,
      844,
      C.canvas,
      0,
      true,
    );
    toolbar(mobileInspector, 390);
    inspector(mobileInspector, 51, 64, 760);
    const mobileExport = frame(
      screens,
      "12 / Mobile Export",
      1040,
      3060,
      390,
      844,
      C.canvas,
      0,
      true,
    );
    toolbar(mobileExport, 390);
    dialog(mobileExport, "Export Code", "export");

    await figma.setCurrentPageAsync(parts);
    text(
      parts,
      "Library guide",
      "ZamnCraft / Editable UI Parts",
      0,
      -100,
      1000,
      32,
      C.text,
      true,
    );
    text(
      parts,
      "Library description",
      "Native frames, text, shapes and vector icons. Fixed-layout reference of the current editor, not a live DOM capture or a working prototype. All Inspector controls are expanded below.",
      0,
      -40,
      1300,
      16,
      C.muted,
    );
    const top = frame(parts, "01 / Top Toolbar", 0, 0, 1440, 48, null);
    toolbar(top);
    navigation(parts, "Pages", 0, 130);
    navigation(parts, "Layers", 340, 130);
    navigation(parts, "Assets", 680, 130);
    const fullInspector = inspector(parts, 1060, 130, 1600, true);
    fullInspector.name = "05 / Full Inspector · All Sections";
    let sectionTop = 130;
    sections.forEach((section, index) => {
      const node = inspectorSection(parts, section, 1430, sectionTop);
      node.name = "06." + (index + 1) + " / " + section.name;
      sectionTop += node.height + 32;
    });
    const controls = frame(parts, "07 / Controls & States", 0, 1080, 970, 440);
    text(
      controls,
      "Heading",
      "Buttons, fields, toggles, slider and icons",
      24,
      20,
      920,
      20,
    );
    button(controls, "Export Code", 24, 70, 150, true, "code");
    button(controls, "Download File", 190, 70, 160, false, "download");
    const disabled = button(controls, "Disabled", 370, 70, 120);
    disabled.opacity = 0.4;
    input(controls, "Width", "1200", 24, 126, 200);
    input(controls, "Sizing", "Fixed", 246, 126, 200, true);
    toggle(controls, "Appear enabled", 184);
    slider(controls, "Opacity", 226);
    Object.keys(paths).forEach((kind, index) => {
      const x = 24 + (index % 12) * 76;
      const y = 290 + Math.floor(index / 12) * 66;
      icon(controls, "Icon / " + kind, x, y, kind, C.muted, 20);
      text(controls, "Icon label", kind, x, y + 25, 72, 9, C.muted);
    });
    const palette = frame(parts, "08 / Color & Typography", 0, 1600, 970, 370);
    text(palette, "Heading", "Foundations", 24, 20, 900, 20);
    Object.entries(C).forEach(([name, color], i) => {
      const x = 24 + i * 115;
      rect(palette, "Color / " + name, x, 72, 90, 54, color, 5, C.border);
      text(
        palette,
        "Color token",
        name + "\n" + color,
        x,
        138,
        108,
        11,
        C.muted,
      );
    });
    text(
      palette,
      "Heading sample",
      "A little space for your next big idea.",
      24,
      216,
      900,
      26,
      C.text,
      true,
    );
    text(
      palette,
      "Body sample",
      "Editor UI · 11px body · 10px metadata · blue selection · dark panels",
      24,
      278,
      900,
      11,
      C.muted,
    );
    const modalBoard = frame(
      parts,
      "09 / Export Modal · Isolated",
      0,
      2080,
      1000,
      780,
      C.canvas,
    );
    dialog(modalBoard, "Export Code", "export");
    const workspaceBoard = frame(
      parts,
      "10 / Workspace Dialog · Isolated",
      1820,
      130,
      600,
      800,
      C.canvas,
    );
    dialog(workspaceBoard, "Local workspace", "workspace");
    await figma.setCurrentPageAsync(screens);
    screens.selection = [first];
    figma.viewport.scrollAndZoomIntoView([first]);
    figma.closePlugin(
      "Created 2 ZamnCraft pages: 12 screens plus editable UI parts. Existing pages were kept.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let cleaned = true;
    try {
      await figma.setCurrentPageAsync(originalPage);
      for (const page of createdPages) if (!page.removed) page.remove();
    } catch (_) {
      cleaned = false;
    }
    figma.closePlugin(
      "ZamnCraft import failed: " +
        message +
        (cleaned
          ? ". Generated pages were removed; existing content was kept."
          : ". Some generated pages may remain. Delete only pages named ZamnCraft · 01 Screens and ZamnCraft · 02 UI Parts from this run."),
    );
  }
})();
