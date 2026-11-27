# ZamnCraft

A Framer-inspired dark visual web editor, built with Next.js App Router, TypeScript, Tailwind CSS, Zustand, and Lucide React.

## Run locally

Requires Node.js 20.9 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The development server binds to `0.0.0.0` and allows Arena preview origins.

## Checks and production

```sh
npm test
npm run typecheck
npm run build
```

The production build exports static HTML, CSS, and JavaScript to `out/`. Serve that directory with any static web server; `next start` does not support static exports. For a local root-path preview, run `npx serve@14 out`.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds and deploys `out/` on every branch push, including branch names containing `/`. It also supports manual runs from the Actions tab. All branches deploy to the same Pages site, not separate branch previews; the latest completed deployment replaces the live site.

The workflow uses Node.js 22 and `npm ci`. Project repositories build with `NEXT_PUBLIC_BASE_PATH=/<repository-name>`; user and organization repositories named `<owner>.github.io` use an empty base path. For this repository the public URL is https://yasinbeigyyasin.github.io/ZamnCraft/.

In repository **Settings → Pages**, the deployment source must be **GitHub Actions**. The `github-pages` environment must also allow the branches you want to deploy. The deploy job requests `pages: write` and `id-token: write` permissions.

To reproduce the project-path build locally:

```sh
NEXT_PUBLIC_BASE_PATH=/ZamnCraft npm run build
```

The base path is embedded at build time. Rebuild without the variable to serve the app at `/`. Exported images are unoptimized because Pages has no Next.js server.

Browser regression tests use Playwright and Chromium. Install the browser and system dependencies once:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright starts the development server automatically, or reuses an existing server outside CI. It checks panel dimensions and colors, shortcuts, keyboard tabs, modal focus and dismissal, zoom boundaries, mobile panel access, duplicate IDs, and browser errors. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing compatible Chromium binary instead of a Playwright-managed browser.

## Steps 3–9: canvas, components, pages, and code export

The original dark editor chrome is preserved: a 48px toolbar, 256px navigation panel, and 288px inspector on desktop. The former empty canvas now contains a white **1200 × 800 Desktop frame**, with the Step 2 pan/zoom controls preserved.

### State and data

`EditorElement` describes a recursive tree with `id`, `name`, `type` (`frame`, `text`, or `button`), `children`, React `CSSProperties`, an optional `content` string, and typed `effects` (appear, hover, press, transition, blur, and shadow). Older trees without effects receive defaults when edited; new elements own independent defaults. The legacy `animations` record is retained for compatibility. The default tree contains one Desktop root frame.

`useEditorStore` owns `elements`, `selectedElementId`, `activeTool` (`select`, `frame`, or `text`), `canvasConfig`, and the existing navigation tab. Canvas zoom is a **scale factor** (`1 = 100%`), bounded to 0.25–2. Pan uses viewport pixels and has no positional boundary. `addElement` immutably appends a child to a frame, or a root element when its parent is null, selects it, and returns to Select. `updateText` stores plain text without changing the element name. Invalid numeric values are ignored. Changing or replacing the tree clears selections that no longer exist.

### Canvas controls

- **Pan:** hold Space and left-drag on the canvas, or middle-mouse drag with any tool. Pointer capture keeps the drag working outside the canvas; release, cancellation, window blur, or opening a dialog ends the gesture.
- **Zoom:** Ctrl/Cmd + mouse wheel, anchored under the pointer. The non-passive wheel handler prevents browser zoom. Plain scrolling does not zoom.
- **Zoom display:** bottom-right controls show the current percentage, zoom in/out, and reset to 100%. Button zoom is anchored at the viewport center.
- **Fit view:** fits the Desktop frame on first load; the fit-view button recenters it for the current viewport. Resizing the viewport does not automatically discard the user's pan/zoom.
- **Select:** click an element in Select mode or its Layers entry. Click empty canvas space to clear the selection. Panning does not change selection.
- **Add a Frame:** choose Frame (or press F), then click on the blank canvas or inside any existing frame. A gray 200 × 200 frame is inserted at the clicked world or parent-local position, accounting for pan and zoom.
- **Add Text:** choose Text (or press T), then click on the blank canvas or inside a frame. Root text is white against the dark canvas; text inside frames is dark. The new text is `Double click to edit`. Insertion selects the new child and returns to Select.
- **Edit Text:** double-click it, then type. Enter or clicking away saves; Shift+Enter inserts a line break; Escape discards the draft. Pasted content is inserted as plain text, never HTML. Empty text remains selectable.
- **Tools:** V / F / T select the supported tools. C creates a reusable component from the selection. Stack creation remains disabled in the toolbar; use the Inspector’s Stack layout.

`CanvasRenderer.tsx` walks the frame/text/button tree recursively. Each element stops click propagation so its parent is not selected accidentally. A selected element gets a screen-sized 2px blue border and a small blue name/dimensions label. ResizeObserver keeps the dimensions accurate as text changes. Chrome, zoom controls, and breadcrumbs stay outside the transformed world. Grid spacing and origin follow the world transform. Text and button nodes use `content` when present, falling back to their name.

Keyboard shortcuts ignore text fields, composition, modifiers, already-handled events, and open dialogs. Tabs retain arrow-key, Home, and End navigation. Narrow viewports retain toolbar access to navigation and inspector dialogs.

Play opens a live interactive preview. Export Code generates a file for the current page. The workspace is saved automatically in this browser; document edits support undo/redo. No backend is required. Position and size can be changed through the Inspector or directly on the canvas.

## Interactive Layers panel

Open the **Layers** tab to see the store's recursive element tree. Rows are 32px tall, indent 16px per level, and use Frame/Text/Button icons. Selected rows use `#0099FF` and stay in sync with canvas selection.

- **Expand/collapse:** use the disclosure arrow on layers with children. This only changes the outline, not the canvas or selection. Expansion stays local to each sidebar instance; switching tabs preserves it.
- **Rename:** double-click a layer name, or focus its name button and press F2. Enter or blur saves; Escape cancels. Names are trimmed; blank names are ignored. Renaming a text layer does not change its text content.
- **Delete:** use the trash button (shown on hover, keyboard focus, or touch devices), or press Delete/Backspace with a layer selected. Deleting a parent also removes all descendants. Unrelated selections are preserved; selections in a deleted subtree are cleared. The final root can be deleted; new elements can still be inserted onto the blank canvas.
- **Safe shortcuts:** deletion ignores text inputs, contentEditable text, composition, held-key repeats, Ctrl/Cmd/Alt combinations, handled events, and open dialogs. The navigation dialog still supports its explicit rename/trash controls on narrow screens.

Store actions are `renameElement(id: string, name: string): void` and `deleteElement(id: string): void`. Both update nested trees immutably and ignore unknown IDs. Removal preserves unrelated element references. Deletion is undoable during the session, and the resulting workspace is automatically saved locally.

## Live Inspector

Select an element on the canvas or in Layers. The existing Inspector updates immediately and enables its property controls; clearing/deleting the selection disables them. The narrow-screen Inspector dialog uses the same live bindings.

- **Position:** Absolute/Relative, X and Y (CSS `left`/`top`, in unscaled parent-local pixels). Root offsets use canvas world coordinates. Negative offsets are supported.
- **Size:** W/H numeric edits make that axis Fixed. Fill uses 100% of the parent; in a Stack's main axis, Fill children share the remaining space. Fit uses CSS intrinsic `fit-content`; absolutely positioned children do not contribute to intrinsic sizing. Switching to Fixed captures the rendered dimension. Percentage height needs a definite parent height; root Fill uses the canvas's 1200 × 800 reference size.
- **Layout:** Free, Stack, or Grid. Stack supports horizontal/vertical direction, gap, padding, and main/cross alignment. Grid supports 1–12 columns, gap, padding, and alignment. Switching to Stack/Grid puts immediate children in relative flow; returning to Free restores their saved positions. New children in Stack/Grid join its flow. A child's Position control can explicitly override flow positioning.
- **Styles:** native fill color picker and hex input (3/6/8-digit hex), Remove fill, 0–100% opacity, corner radius, border style/width/color. Invalid color or numeric drafts revert on blur without corrupting the element. Empty numeric input is a temporary draft, not an accidental zero.
- **Typography:** text content, font size, numeric weight, text color, and alignment. Inspector text edits update the canvas immediately; saving inline canvas text updates the Inspector. Content remains plain text, not HTML.

`updateStyles(id, patch)` merges CSS properties immutably. `updatePosition(id, patch)`, `updateSize(id, axis, number | "fill" | "fit")`, and `updateLayout(id, "free" | "stack" | "grid")` provide property-specific actions. `updateText(id, content)` remains the shared text action. Unknown IDs, non-finite numbers, negative dimensions/spacing, and out-of-range opacity are ignored. Unrelated branches and selection are preserved. Both store import paths reference a single instance.

Live Inspector input edits are grouped into one undo step per focus session and saved locally after commitment.

## Direct canvas manipulation

- **Move:** choose Select (V), then drag a frame, text, or button. Clicking an unselected element selects it first. Pointer movement is divided by the current zoom and updates parent-local X/Y live; root elements use world offsets. The parent and unrelated siblings are not moved. Negative/off-frame positions are allowed.
- **Resize:** the selected element shows eight screen-sized 8px square handles on its 2px blue border, including on bordered elements and at different zoom levels. Side handles change one axis; corners change both. North/west handles also update position to hold the opposite edge still in Free layout. Width/height cannot flip; the minimum is 8 world pixels or the element's combined border thickness, whichever is larger. Resized axes become Fixed; untouched sizing modes remain unchanged. Stack/Grid elements retain CSS flow positioning and can reflow their siblings normally.
- **Snap:** edges and centers snap to the parent frame and immediate siblings within **6 screen pixels**, independent of zoom. Resizing snaps only active edges. Subtle 1px blue guides appear during the gesture and clear on completion. Hold **Alt/Option** to bypass snapping. Snap references are measured at gesture start; there is no grid snapping or reparenting.
- **Commit/cancel:** release to commit, including outside the canvas through pointer capture. Escape, pointer cancellation, capture loss, window blur, hidden tabs, selection/tool changes, or opening a modal cancel and restore the starting geometry/sizing modes. A 3px movement threshold keeps clicks and double-click text editing intact.
- **Pan and text:** Space + drag and middle-button pan remain separate from manipulation. Ctrl/Cmd-wheel zoom is suspended during an element gesture. Text editing and Inspector inputs cannot initiate a drag. Primary touch/pen use the same pointer path; the Inspector remains the keyboard-accessible alternative to mouse/touch handles.

Direct manipulation uses the existing atomic `updateStyles` action; guides and gesture snapshots stay transient rather than becoming document state. No new dependency is required. Each completed drag or resize is a single undo step; cancellation restores its starting document without adding history. Committed changes are saved locally.

## Effects & Animations and live preview

Select any element and scroll to **Effects & Animations** in the Inspector. Enable each interaction independently:

- **Appear:** initial opacity (0–100%), X/Y offset in pixels, and scale. **Replay animation** runs it directly on the editing canvas without writing transforms to document styles. A new replay restarts it; interacting with the canvas clears it before manipulation.
- **Hover:** scale, rotation in degrees, optional fill and opacity overrides. Disabling an override restores the element's own style.
- **Press:** scale while a primary pointer is held. Release, pointer cancellation, leaving the element, or window blur resets it. Rendered button elements also respond to Enter/Space.
- **Transition:** Ease uses duration in seconds (0–10). Spring uses stiffness (1–1000) and damping (1–100), with a sampled, unit-mass damped spring curve and native CSS `linear()` easing. Spring settling is capped at 10 seconds; browsers without `linear()` use ease-out instead.
- **Blur and shadow:** pixel blur plus None/Soft/Strong shadow presets or a custom CSS box-shadow. Invalid drafts leave the last valid value unchanged.

**Play** toggles a full-width live view of the same recursive document. Appear runs on entry; hover and press work only in preview. Selection labels, handles, sidebars, and insertion tools are hidden, and editing shortcuts and double-click editing are suspended. Pan/zoom and fit controls remain available. **Exit preview** or Escape restores the exact editing camera and selection; no document geometry is changed. Narrow screens can configure effects through the existing Inspector dialog.

Animations use the browser's Web Animations API with no animation dependency. Reduced-motion preference skips appear offsets/fades and hover/press transforms, retaining immediate color/opacity feedback. Active animations are cancelled on exit and unmount.

## Reusable components and Assets

Select a Frame (including Stack/Grid layouts) or Text, then click the diamond **Component (C)** tool, press **C**, or choose **Create Component** in Assets. The selected subtree becomes the master, and Assets opens with a saved library entry. Masters, instances, and their descendant layers use component purple (`#8B5CF6`) for layer highlights, selection borders, labels, and handles; ordinary elements stay blue.

- **Insert** creates a linked instance with unique IDs. It goes inside a selected independent frame, otherwise the first independent root frame, or onto the root canvas if there is no such frame. Stack/Grid parents keep instances in flow.
- **Edit master** opens the master's page and selects it. Changes to its styles, sizing, layout, text, effects, name, and child structure automatically propagate to instances on every page. Surviving descendants keep stable instance IDs. Each instance keeps its own root position.
- **Detach instance** in Assets removes the link from the selected instance (or from the owner of a selected instance descendant). Its current appearance and structure become ordinary editable elements, unaffected by future master changes.
- Linked instances can be edited, but subsequent master updates replace their styles and structure, except root placement. Detach first for permanent independent edits; there is no per-property override system.
- Nested reusable component definitions are not supported: conversion is disabled when the subtree is already linked or contains another component. Detach linked subtrees first. Saved components survive master or master-page deletion and remain insertable as their last saved snapshot; Edit master is disabled if its source was deleted.

The project-wide `components` registry stores master snapshots. `componentId`/`componentRole` identify roots and `componentSourceId` maps instance nodes to master nodes. The store reconciles master updates and all page snapshots atomically, preserving the existing active `elements` API. No new dependencies were added.

## Multi-page management

In **Pages**, click **Add page**, enter a unique path such as `/about` or `/contact`, and save. Paths are normalized to lowercase with a leading slash; letters, numbers, hyphens, and nested path segments are supported. The path also names the page (`/` is Home). Use the pencil button (or double-click/F2 on a page name) to rename it. Invalid or duplicate paths show an inline error without modifying the page.

Each page owns an independent root element tree and editing camera; new pages begin with a 1200 × 800 Desktop. Switching pages clears stale selection and replay state and restores that page's camera. Breadcrumbs and Layers follow the active page, and Play previews only that page. The trash button asks for confirmation before deleting a page and its canvas. At least one page is retained. Components are shared across pages, not duplicated into separate registries.

Pages and Assets remain accessible through the navigation dialog on narrow screens. Page/component management is suspended in preview. This is editor-only page management, not published routes or cross-page link navigation. Pages and components are persisted locally across refresh; page and component document edits participate in session undo/redo.

## Multi-framework code export

Click **Export Code** to open the current page's generated source. Framework tabs support arrow keys, Home, and End. The read-only syntax-styled viewer supports text selection (Ctrl/Cmd+A selects its code), **Copy Code** with Copied! feedback, and **Download File**. If clipboard access is blocked, use text selection or download. Escape closes the modal and restores toolbar focus; editor gestures/shortcuts stay suspended while it is open.

| Target          | Download      | Setup                                                                                                                                                                                                                                     |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React / Next.js | `Page.tsx`    | Existing React/Next project with Tailwind CSS; `npm install framer-motion` for effects. Includes `"use client"`, Tailwind layout utilities, embedded exact-value CSS, reusable functions, and Framer Motion appear/hover/tap transitions. |
| Vue 3           | `Page.vue`    | Vue SFC tooling. Includes template, TypeScript script setup, style block, and reusable local render components.                                                                                                                           |
| Svelte          | `Page.svelte` | Svelte 5 with TypeScript support. Uses reusable snippets and an embedded style block.                                                                                                                                                     |
| HTML/CSS        | `index.html`  | Open directly in a browser. Standalone HTML with embedded CSS; component instances become ordinary markup.                                                                                                                                |

`generateCode(elements, framework)` in `src/lib/code-generator.ts` is a pure, deterministic compiler: stable names and sorted style properties, no UUIDs, timestamps, canvas camera, selection handles, or editor runtime. It preserves Free/Stack/Grid, root and parent-local positions, fixed/Fill/Fit sizing, typography, borders, fills, opacity, blur, shadow, and current instance content. Equivalent linked component trees share definitions in framework exports; local overrides produce separate variants rather than silently being discarded. Only components present on the active page are emitted.

Generated CSS is scoped under a deterministic design-specific class. React uses Tailwind utilities for layout plus CSS declarations for exact editor values. Vue, Svelte, and HTML use native CSS appear keyframes, hover/active selectors, and sampled spring easing (with ease-out fallback). All targets respect reduced-motion preferences. Content remains literal text; markup/template/script delimiters and CSS boundary characters are escaped, never evaluated by the viewer.

Exports represent the current page at its original 1200 × 800 canvas reference size; responsive Fill/Stack/Grid values are preserved, but the compiler does not invent breakpoints. This is a page/component source file, not a complete project, ZIP, multi-page router, or backend. Browser-native CSS and Framer Motion use their respective interaction/physics engines. Web fonts/assets not stored in the document must be supplied by the consuming app. Session data still clears on refresh; exporting source is not an editable project save format.

Tests include deterministic/escaping fixtures, strict generated React typechecking, Vue/Svelte compiler validation, and real browser mounts of React/Vue/Svelte output plus standalone HTML interaction checks. Framework compilers/runtimes and esbuild are **development-only test dependencies**; none are bundled into the editor's export engine.

## Code and design

Ponytail guides coding; Unslop guides design. See `AGENTS.md` for the pinned skills and attribution. The original Step 1 visual design is restored: compact controls, ZamnCraft branding, and blue page and tool selections. Steps 2–9 replace the canvas empty state with the Desktop frame, navigation controls, and the requested selection labels. Preserve this design unless the user explicitly approves visual changes. Keyboard, dialog, and state-management fixes are retained.

### Main files

- `src/components/editor/editor-shell.tsx`: layout, toolbar, tool shortcuts, and guarded deletion shortcuts.
- `src/components/editor/canvas.tsx`: world transform, gesture guards, pan, zoom, and fit view.
- `src/components/editor/CanvasRenderer.tsx`: recursive nodes, insertion, selection labels, eight resize handles, and inline text editing.
- `src/components/editor/use-canvas-manipulation.ts`: pointer capture, movement, resizing, snap targets, and cancellation.
- `src/lib/code-generator.ts`: deterministic four-target page compiler and output metadata.
- `src/components/editor/code-export.tsx`: framework tabs, safe code highlighting, clipboard, and downloads.
- `src/lib/editor-components.ts`: component ownership, instance cloning, detachment, and propagation.
- `src/components/editor/sidebar-library.tsx`: Pages CRUD and Assets management.
- `src/lib/element-effects.ts`: independent effect defaults, validated patches, and spring sampling.
- `src/components/editor/use-element-effects.ts`: native appear/hover/press lifecycle and reduced-motion behavior.
- `src/lib/canvas-geometry.ts`: pure resize geometry and alignment snapping.
- `src/types/editor.ts`: element, tool, and canvas data types.
- `src/components/editor/navigation-panel.tsx`: tabs, recursive disclosures, selection, inline renaming, and trash controls.
- `src/components/editor/inspector-panel.tsx`: live position, size, layout, style, and typography controls.
- `src/components/editor/editor-dialog.tsx`: modal lifecycle and empty states.
- `src/components/editor/editor-controls.tsx`: shared icon button and tool definitions.
- `src/store/editor-store.ts`: canonical element tree, selection, tool state, canvas actions, and property actions.
- `src/store/useEditorStore.ts`: compatibility re-export of the same Zustand store.
- `src/app/globals.css`: theme, control styles, and responsive layout.

## Responsive breakpoints, history, and local workspace

- **Breakpoints:** use the compact canvas controls to add **Tablet (810px)** and **Mobile (390px)** beside **Desktop (1200px)**. Each starts as a deep copy of Desktop with fresh IDs. Click a breakpoint control to focus it; Reset canvas view fits all roots. Frames are independent designs, not automatic reflow or synchronized overrides (linked components still follow their masters). Adjust narrow layouts in the Inspector. Preview's selector shows one breakpoint at a time and restores the editing camera on exit.
- **Responsive export:** when multiple breakpoint roots exist, all four export targets overlay the variants and switch them using media queries: Desktop at 1200px+, Tablet at 810–1199px, Mobile at 809px and below. Missing variants fall back to the next available larger design. Editor side-by-side offsets are omitted for these roots. Child layouts remain exactly as authored; fixed-width children may require narrow-screen adjustments.
- **Undo/redo:** toolbar controls or **Ctrl/Cmd+Z** undo; **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** redo. Creation, deletion, text/style/layout/effect changes, pages, components, project renaming, and workspace replacement are recorded in a bounded 100-step history. A drag/resize or focused Inspector input session is one step, not one per pointer move/keystroke. Escape or a history shortcut during a gesture cancels that gesture first. Camera/selection-only changes do not create history entries. Shortcuts leave text inputs, dialogs, and preview alone. History is not retained across refresh.
- **Local workspace:** open the project title, **Local workspace**, or the back/overview button (also available on mobile). Rename the project, load **Landing Page Starter**, or reset to a clean Desktop. Starter/reset require explicit confirmation and can be undone before refresh. The starter contains editable Navbar, Hero, CTA with hover/press effects, and three Feature cards.
- **Storage:** versioned key `zamncraft.workspace.v1` stores every page/tree/camera, the active page, component registry, and project title. Saves debounce by 200ms, flush when leaving/hiding the tab, and exclude unfinished transactions, history, preview, and transient UI. Hydration runs only on the client. Invalid/incompatible data is not overwritten until an explicit reset/template replacement; storage failures appear in the workspace menu. Validation caps loaded data at 8 million characters, 100 pages, 500 components, 20,000 tree nodes and depth 40. This is browser-local, not account/cloud sync or multi-tab collaboration: clearing site data removes it, and another tab may overwrite it. Export important work before leaving if storage reports a failure.

## Copy UI to Figma

Open **Editor help** (the question mark at the bottom-left), then **Copy UI to Figma**. On mobile, open project navigation first to reach Help. **Copy UI for Figma** puts SVG source on the clipboard; paste onto your Figma canvas with Ctrl/Cmd+V. If your browser/Figma combination pastes text instead, use **Download .svg for Figma** and drag the file into Figma.

The generated `ZamnCraft-Editor-UI-Kit.svg` is a self-contained **1440 × 900** vector reference kit of the existing editor design, not a screenshot or a live-project export. It contains named `<g id="…">` layers for the toolbar, Pages/Layers/Assets inventory, sample canvas and eight-handle selection, expanded Inspector inputs/toggles/slider/sections, and Export Code Modal. Text uses real `<text>` nodes and icons use vector paths; backgrounds, fields, buttons, strokes and radii remain separate shapes. No raster images, external fonts, scripts, or `foreignObject` are used. The project title is escaped XML text; private page content is not included.

Uncheck **Include Export Code Modal** for the unobscured editor, or remove the modal's group after import. Navigation/Inspector combine alternate states into a compact reference inventory so all controls fit on the artboard. This does not write to your Figma file or require a plugin. SVG groups are not native Figma frames, Auto Layout, components or interactive controls. Figma controls the final layer naming/text conversion and font substitution; a 100% identical editable-layer import cannot be guaranteed. Import/paste inside Figma itself is not covered by the automated browser tests.

## Approved Figma importer UI

The website editor chrome now follows the original reference in `figma/zamncraft-figma-import/code.js`: self-hosted Inter typography, the Z brand initial, 48px toolbar, 256px navigation, 288px Inspector, `#111111` panels, `#292929` dividers, `#1b1b1b` fields, subdued `#142432` selected navigation rows, and `#0099ff` canvas selection/active controls. Linked-component accents use `#9966ff`. Effects use accessible native checkboxes styled as switches; Styles includes an opacity slider alongside the numeric input. The 800px code export dialog uses underlined framework tabs and an inset code viewer.

This changes the editor's presentation, not saved project data. Canvas content retains its previous Arial fallback so authored text and code exports do not silently reflow when the editor font changes. The importer’s sample pages/layers are not automatically inserted; use **Local workspace → Load Landing Page Starter** if you want example content. On small screens navigation and Inspector remain accessible through dialogs rather than squeezing desktop panels into the viewport. Inter's bundled Latin variable font is licensed under the SIL Open Font License (`src/app/fonts/OFL.txt`); the site makes no external font request.
