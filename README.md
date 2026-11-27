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
npm start
```

Browser regression tests use Playwright and Chromium. Install the browser and system dependencies once:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright starts the development server automatically, or reuses an existing server outside CI. It checks panel dimensions and colors, shortcuts, keyboard tabs, modal focus and dismissal, zoom boundaries, mobile panel access, duplicate IDs, and browser errors. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing compatible Chromium binary instead of a Playwright-managed browser.

## Step 1: editor shell

- 48px toolbar, 256px navigation panel, flexible dotted canvas, and 288px inspector on desktop.
- Tool selection with V / F / T / S / C shortcuts. Shortcuts ignore text fields, composition, modifiers, repeated or already-handled events, and open dialogs.
- Pages, Layers, and Assets tabs with arrow-key, Home, and End navigation and unique panel IDs.
- Zustand UI state and 25–200% canvas-grid zoom, with disabled controls at the limits.
- Native modal dialogs with background interaction blocked, Escape dismissal, and trigger focus restoration.
- Inspector access below 1040px and navigation access below 760px through toolbar buttons; panels are not silently removed on smaller screens.
- Shared theme tokens, visible keyboard focus, and reduced-motion support. Export retains the requested blue with dark text for contrast.

This step does not create or manipulate elements. Inspector properties are disabled visual placeholders. Preview and Export Code explain the current limitation rather than pretending to generate a website. State is in memory, with no backend or persistence. The original hand-tool icon is retained as a disabled placeholder until canvas panning is implemented.

## Code and design

Ponytail guides coding; Unslop guides design. See `AGENTS.md` for the pinned skills and attribution. The original Step 1 visual design is restored: compact controls, ZamnCraft branding, blue page and tool selections, and the illustrated canvas empty state. Preserve this design unless the user explicitly approves visual changes. Keyboard, dialog, and state-management fixes are retained.

### Main files

- `src/components/editor/editor-shell.tsx`: layout, toolbar, canvas, and shortcut handling.
- `src/components/editor/navigation-panel.tsx`: tabs and project placeholders.
- `src/components/editor/inspector-panel.tsx`: disabled property controls.
- `src/components/editor/editor-dialog.tsx`: modal lifecycle and empty states.
- `src/components/editor/editor-controls.tsx`: shared icon button and tool definitions.
- `src/store/editor-store.ts`: UI state and zoom limits.
- `src/app/globals.css`: theme, control styles, and responsive layout.
