import { useEditorStore } from "@/store/editor-store";
import { parseWorkspace, serializeWorkspace, WORKSPACE_KEY } from "./workspace";

/** Mount in the client shell, never at module evaluation during static rendering. */
export function startWorkspacePersistence(
  storage?: Pick<Storage, "getItem" | "setItem">,
) {
  const store = useEditorStore;
  let target = storage;
  if (!store.getState().hasHydrated) {
    try {
      target ??= window.localStorage;
      const saved = target.getItem(WORKSPACE_KEY);
      store.getState().hydrateWorkspace(saved ? parseWorkspace(saved) : null);
    } catch {
      store
        .getState()
        .hydrateWorkspace(
          null,
          "Local workspace could not be loaded. Saved data was kept untouched. Reset the workspace to replace it, or reload to try again.",
        );
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSaved = "";
  const flush = () => {
    clearTimeout(timer);
    const state = store.getState();
    if (!state.hasHydrated || state.persistenceBlocked) return;
    try {
      target ??= window.localStorage;
      // Only committed gestures/drafts are saved if the tab closes mid-edit.
      const document = state.historyTransaction ?? state;
      const serialized = serializeWorkspace(document);
      if (serialized === lastSaved) return;
      target.setItem(WORKSPACE_KEY, serialized);
      lastSaved = serialized;
      if (state.persistenceError) store.setState({ persistenceError: null });
    } catch {
      store.setState({
        persistenceError:
          "Local save failed. Browser storage may be full or unavailable. Keep this tab open and export your work before leaving.",
      });
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(flush, 200);
  };
  const unsubscribe = store.subscribe((state, previous) => {
    if (
      state.pages !== previous.pages ||
      state.components !== previous.components ||
      state.projectTitle !== previous.projectTitle ||
      state.activePageId !== previous.activePageId ||
      state.historyTransaction !== previous.historyTransaction ||
      state.persistenceBlocked !== previous.persistenceBlocked
    )
      schedule();
  });
  schedule();
  const visibility = () => {
    if (document.hidden) flush();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
  }
  return () => {
    unsubscribe();
    flush();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    }
  };
}
