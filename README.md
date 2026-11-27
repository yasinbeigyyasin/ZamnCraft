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

## Step 3: rendering, element insertion, and selection

The original dark editor chrome is preserved: a 48px toolbar, 256px navigation panel, and 288px inspector on desktop. The former empty canvas now contains a white **1200 × 800 Desktop frame**, with the Step 2 pan/zoom controls preserved.

### State and data

`EditorElement` describes a recursive tree with `id`, `name`, `type` (`frame`, `text`, or `button`), `children`, React `CSSProperties`, an optional `content` string, and an open `animations` payload. The default tree contains one Desktop root frame.

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
- **Tools:** V / F / T select the supported tools. Stack and Component stay visible but disabled.

`CanvasRenderer.tsx` walks the frame/text/button tree recursively. Each element stops click propagation so its parent is not selected accidentally. A selected element gets a screen-sized 2px blue border and a small blue name/dimensions label. ResizeObserver keeps the dimensions accurate as text changes. Chrome, zoom controls, and breadcrumbs stay outside the transformed world. Grid spacing and origin follow the world transform. Text and button nodes use `content` when present, falling back to their name.

Keyboard shortcuts ignore text fields, composition, modifiers, already-handled events, and open dialogs. Tabs retain arrow-key, Home, and End navigation. Narrow viewports retain toolbar access to navigation and inspector dialogs.

Property controls, preview, and code generation are still unavailable. State is session-only, with no backend, undo history, animation editing, or persistence. Moving, resizing, element deletion, and property editing are not implemented yet.

## Code and design

Ponytail guides coding; Unslop guides design. See `AGENTS.md` for the pinned skills and attribution. The original Step 1 visual design is restored: compact controls, ZamnCraft branding, and blue page and tool selections. Steps 2–3 replace the canvas empty state with the Desktop frame, navigation controls, and the requested selection labels. Preserve this design unless the user explicitly approves visual changes. Keyboard, dialog, and state-management fixes are retained.

### Main files

- `src/components/editor/editor-shell.tsx`: layout, toolbar, and tool shortcuts.
- `src/components/editor/canvas.tsx`: world transform, gesture guards, pan, zoom, and fit view.
- `src/components/editor/CanvasRenderer.tsx`: recursive nodes, insertion, selection labels, and inline text editing.
- `src/types/editor.ts`: element, tool, and canvas data types.
- `src/components/editor/navigation-panel.tsx`: tabs, recursive layer list, and selection.
- `src/components/editor/inspector-panel.tsx`: disabled property controls.
- `src/components/editor/editor-dialog.tsx`: modal lifecycle and empty states.
- `src/components/editor/editor-controls.tsx`: shared icon button and tool definitions.
- `src/store/useEditorStore.ts`: element tree, selection, tool state, and canvas actions.
- `src/app/globals.css`: theme, control styles, and responsive layout.
