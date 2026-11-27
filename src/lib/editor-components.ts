import type { EditorElement, MasterComponent } from "@/types/editor";

export function componentOwner(
  elements: EditorElement[],
  id: string,
  owner?: EditorElement,
): EditorElement | undefined {
  for (const element of elements) {
    const current = element.componentId ? element : owner;
    if (element.id === id) return current;
    const found = componentOwner(element.children, id, current);
    if (found) return found;
  }
}

export function canCreateComponent(
  elements: EditorElement[],
  id: string,
): boolean {
  if (componentOwner(elements, id)) return false;
  const visit = (nodes: EditorElement[]): boolean =>
    nodes.some((node) => Boolean(node.componentId) || visit(node.children));
  const find = (nodes: EditorElement[]): EditorElement | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const child = find(node.children);
      if (child) return child;
    }
  };
  const element = find(elements);
  return Boolean(element && !visit(element.children));
}

export function detachComponent(element: EditorElement): EditorElement {
  const detached = {
    ...element,
    children: element.children.map(detachComponent),
  };
  delete detached.componentId;
  delete detached.componentRole;
  delete detached.componentSourceId;
  return detached;
}

export function instantiateComponent(
  component: MasterComponent,
  previous?: EditorElement,
): EditorElement {
  const existing = new Map<string, string>();
  const collect = (node: EditorElement) => {
    if (node.componentSourceId) existing.set(node.componentSourceId, node.id);
    node.children.forEach(collect);
  };
  if (previous) collect(previous);
  const copy = (source: EditorElement, root = false): EditorElement => ({
    ...detachComponent({ ...source, children: [] }),
    id:
      root && previous
        ? previous.id
        : (existing.get(source.id) ?? crypto.randomUUID()),
    componentSourceId: source.id,
    breakpoint: undefined,
    ...(root
      ? { componentId: component.id, componentRole: "instance" as const }
      : {}),
    children: source.children.map((child) => copy(child)),
    styles: { ...source.styles },
    effects: source.effects ? structuredClone(source.effects) : undefined,
  });
  const instance = copy(component.element, true);
  if (previous) {
    // Placement belongs to the instance; all other master properties propagate.
    instance.styles = {
      ...instance.styles,
      position: previous.styles.position,
      left: previous.styles.left,
      top: previous.styles.top,
    };
    instance.freePosition = previous.freePosition;
    instance.breakpoint = previous.breakpoint;
  }
  return instance;
}

export function syncInstances(
  elements: EditorElement[],
  changed: MasterComponent[],
): EditorElement[] {
  let updated = false;
  const result = elements.map((element) => {
    const component =
      element.componentRole === "instance"
        ? changed.find((item) => item.id === element.componentId)
        : undefined;
    if (component) {
      updated = true;
      return instantiateComponent(component, element);
    }
    const children = syncInstances(element.children, changed);
    if (children === element.children) return element;
    updated = true;
    return { ...element, children };
  });
  return updated ? result : elements;
}
