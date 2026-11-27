import type { ElementEffects } from "@/types/editor";

export function createDefaultEffects(): ElementEffects {
  return {
    appear: { enabled: false, opacity: 0, offsetX: 0, offsetY: 24, scale: 1 },
    hover: { enabled: false, scale: 1.05, rotate: 0 },
    press: { enabled: false, scale: 0.95 },
    transition: { type: "ease", duration: 0.35, stiffness: 170, damping: 26 },
    blur: 0,
    shadow: "none",
  };
}

export const DEFAULT_EFFECTS = createDefaultEffects();

export type EffectsPatch = {
  [Key in keyof ElementEffects]?: ElementEffects[Key] extends object
    ? Partial<ElementEffects[Key]>
    : ElementEffects[Key];
};

export function mergeEffects(
  current: ElementEffects | undefined,
  patch: EffectsPatch,
): ElementEffects | null {
  const base = current ?? DEFAULT_EFFECTS;
  const effects = {
    ...base,
    ...patch,
    appear: { ...base.appear, ...patch.appear },
    hover: { ...base.hover, ...patch.hover },
    press: { ...base.press, ...patch.press },
    transition: { ...base.transition, ...patch.transition },
  };
  const finite = (value: number) => Number.isFinite(value);
  const between = (value: number, min: number, max: number) =>
    finite(value) && value >= min && value <= max;
  if (
    ![
      effects.appear.enabled,
      effects.hover.enabled,
      effects.press.enabled,
    ].every((value) => typeof value === "boolean") ||
    !between(effects.appear.opacity, 0, 1) ||
    !finite(effects.appear.offsetX) ||
    !finite(effects.appear.offsetY) ||
    !between(effects.appear.scale, 0, 10) ||
    !between(effects.hover.scale, 0, 10) ||
    !finite(effects.hover.rotate) ||
    (effects.hover.opacity !== undefined &&
      !between(effects.hover.opacity, 0, 1)) ||
    (effects.hover.fill !== undefined &&
      !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(effects.hover.fill)) ||
    !between(effects.press.scale, 0, 10) ||
    !between(effects.blur, 0, 100) ||
    !["spring", "ease"].includes(effects.transition.type) ||
    !between(effects.transition.duration, 0, 10) ||
    !between(effects.transition.stiffness, 1, 1000) ||
    !between(effects.transition.damping, 1, 100) ||
    typeof effects.shadow !== "string" ||
    effects.shadow.length > 500
  )
    return null;
  return effects;
}

/** Unit-mass damped spring, sampled into a native linear() easing curve. */
export function springTransition(stiffness: number, damping: number) {
  const frequency = Math.sqrt(stiffness);
  const ratio = damping / (2 * frequency);
  const rate =
    ratio <= 1
      ? damping / 2
      : (damping - Math.sqrt(damping * damping - 4 * stiffness)) / 2;
  // shortcut: springs settle within 10 seconds; extend for deliberately slower motion.
  const seconds = Math.min(10, Math.max(0.1, Math.log(10000) / rate));
  const response = (time: number) => {
    if (Math.abs(ratio - 1) < 0.0001)
      return 1 - Math.exp(-frequency * time) * (1 + frequency * time);
    if (ratio < 1) {
      const damped = frequency * Math.sqrt(1 - ratio * ratio);
      return (
        1 -
        Math.exp((-damping * time) / 2) *
          (Math.cos(damped * time) +
            (damping / (2 * damped)) * Math.sin(damped * time))
      );
    }
    const a = (-damping + Math.sqrt(damping * damping - 4 * stiffness)) / 2;
    const b = (-damping - Math.sqrt(damping * damping - 4 * stiffness)) / 2;
    return 1 - (b * Math.exp(a * time) - a * Math.exp(b * time)) / (b - a);
  };
  const samples = Array.from({ length: 121 }, (_, index) =>
    index === 0
      ? 0
      : index === 120
        ? 1
        : Number(response((seconds * index) / 120).toFixed(5)),
  );
  return { duration: seconds * 1000, easing: `linear(${samples.join(", ")})` };
}
