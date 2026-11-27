import type { EditorElement } from "@/types/editor";

/** Selected descendants follow their selected ancestor, rather than moving twice. */
export function selectedRoots(
  elements: EditorElement[],
  ids: readonly string[],
): EditorElement[] {
  const selected = new Set(ids);
  const visit = (nodes: EditorElement[]): EditorElement[] =>
    nodes.flatMap((node) =>
      selected.has(node.id) ? [node] : visit(node.children),
    );
  return visit(elements);
}

export function selectionRange(
  order: readonly string[],
  anchor: string | null,
  id: string,
): string[] {
  const end = order.indexOf(id),
    start = anchor ? order.indexOf(anchor) : -1;
  return end < 0
    ? []
    : start < 0
      ? [id]
      : order.slice(Math.min(start, end), Math.max(start, end) + 1);
}
