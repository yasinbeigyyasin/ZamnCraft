# ZamnCraft local Figma importer

Import `zamncraft-figma-import/manifest.json` as a development plugin in **Figma Desktop**, then run **ZamnCraft editable screen importer**. Full instructions are in [`HOW TO USE.txt`](zamncraft-figma-import/HOW%20TO%20USE.txt).

The self-contained `code.js` creates two new pages: twelve desktop/mobile screen references and a separate library of native frames, text, vector icons and UI parts. It uses no network and never intentionally replaces existing pages. Re-running duplicates its pages. These are fixed-layout design references, not a live project conversion or working prototype. This package does not modify or redeploy the website.

## Check

```sh
node --check figma/zamncraft-figma-import/code.js
npx tsx --test tests/figma-importer.test.ts
```

The mock verifies native node creation, font-loading order and fallback, page-limit errors, partial-import cleanup, repeated imports, and preservation of existing content. It does not prove compatibility or visual fidelity inside the real Figma app; run once in a disposable empty Design file first.

## Package

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
folder = Path('figma/zamncraft-figma-import')
Path('deliverables').mkdir(exist_ok=True)
with ZipFile('deliverables/zamncraft-figma-import.zip', 'w', ZIP_DEFLATED) as archive:
    for path in sorted(folder.iterdir()):
        if path.is_file():
            archive.write(path, Path(folder.name) / path.name)
PY
```

Keep `manifest.json` and `code.js` together when extracting or sharing the ZIP. There is no build step, server or credential setup for the user.
