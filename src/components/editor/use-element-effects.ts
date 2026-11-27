"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { DEFAULT_EFFECTS, springTransition } from "@/lib/element-effects";
import type { EditorElement } from "@/types/editor";
import { useEditorStore } from "@/store/editor-store";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useElementEffects(
  nodeRef: RefObject<HTMLElement | null>,
  element: EditorElement,
  preview: boolean,
) {
  const effects = element.effects ?? DEFAULT_EFFECTS;
  const replay = useEditorStore((state) =>
    state.animationReplay?.elementId === element.id
      ? state.animationReplay.sequence
      : 0,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const animation = useRef<Animation | null>(null);
  const previous = useRef({ preview: false, replay: 0 });

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const replaying = replay !== previous.current.replay && replay > 0;
    const entering = preview && !previous.current.preview;
    previous.current = { preview, replay };
    if (
      (!preview && !replaying) ||
      (!effects.appear.enabled &&
        !effects.hover.enabled &&
        !effects.press.enabled)
    ) {
      animation.current?.cancel();
      animation.current = null;
      return;
    }
    const reduced = reducedMotion || window.matchMedia(motionQuery).matches;
    const hovering = preview && hovered && effects.hover.enabled;
    const pressing = preview && pressed && effects.press.enabled;
    const baseOpacity = Number(element.styles.opacity ?? 1);
    const baseTransform =
      element.styles.transform && element.styles.transform !== "none"
        ? element.styles.transform
        : "";
    const target = {
      transform: `${baseTransform} scale(${reduced ? 1 : pressing ? effects.press.scale : hovering ? effects.hover.scale : 1}) rotate(${!reduced && hovering ? effects.hover.rotate : 0}deg)`,
      opacity: hovering ? (effects.hover.opacity ?? baseOpacity) : baseOpacity,
      backgroundColor: hovering
        ? (effects.hover.fill ??
          String(element.styles.backgroundColor ?? "transparent"))
        : String(element.styles.backgroundColor ?? "transparent"),
    };
    const computed = getComputedStyle(node);
    const from =
      (entering || replaying) && effects.appear.enabled && !reduced
        ? {
            transform: `${baseTransform} translate(${effects.appear.offsetX}px, ${effects.appear.offsetY}px) scale(${effects.appear.scale}) rotate(0deg)`,
            opacity: baseOpacity * effects.appear.opacity,
            backgroundColor: String(
              element.styles.backgroundColor ?? "transparent",
            ),
          }
        : {
            transform: computed.transform,
            opacity: computed.opacity,
            backgroundColor: computed.backgroundColor,
          };
    animation.current?.cancel();
    const transition =
      effects.transition.type === "spring"
        ? springTransition(
            effects.transition.stiffness,
            effects.transition.damping,
          )
        : {
            duration: effects.transition.duration * 1000,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          };
    const current = node.animate([from, target], {
      duration: reduced ? 0 : transition.duration,
      easing: CSS.supports("animation-timing-function", transition.easing)
        ? transition.easing
        : "ease-out",
      fill: "forwards",
    });
    animation.current = current;
    if (!preview)
      current.onfinish = () => {
        if (animation.current === current) {
          current.cancel();
          animation.current = null;
        }
      };
  }, [
    effects,
    element.styles,
    nodeRef,
    preview,
    hovered,
    pressed,
    replay,
    reducedMotion,
  ]);

  useEffect(() => () => animation.current?.cancel(), []);
  useEffect(() => {
    if (!preview) {
      setHovered(false);
      setPressed(false);
    }
    const release = () => setPressed(false);
    const blur = () => {
      setHovered(false);
      setPressed(false);
    };
    if (!preview || (!effects.hover.enabled && !effects.press.enabled)) return;
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", blur);
    };
  }, [preview, effects.hover.enabled, effects.press.enabled]);

  const visualStyles: CSSProperties = {
    filter: effects.blur
      ? `${element.styles.filter && element.styles.filter !== "none" ? element.styles.filter : ""} blur(${effects.blur}px)`
      : element.styles.filter,
    boxShadow:
      effects.shadow !== "none" ? effects.shadow : element.styles.boxShadow,
  };
  return {
    visualStyles,
    handlers: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (preview && effects.hover.enabled && event.pointerType !== "touch")
          setHovered(true);
      },
      onPointerLeave: () => {
        setHovered(false);
        setPressed(false);
      },
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (
          preview &&
          effects.press.enabled &&
          event.button === 0 &&
          event.isPrimary
        )
          setPressed(true);
      },
      onPointerCancel: () => setPressed(false),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (
          preview &&
          effects.press.enabled &&
          element.type === "button" &&
          !event.repeat &&
          !event.nativeEvent.isComposing &&
          ["Enter", " "].includes(event.key)
        )
          setPressed(true);
      },
      onKeyUp: () => setPressed(false),
      onBlur: () => setPressed(false),
    },
  };
}
