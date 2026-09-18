export const FREE_ANIMATION_STYLES = ["chunkjump", "contour", "scanner", "outlineonly"] as const;

const FREE = new Set<string>(FREE_ANIMATION_STYLES);

// The editors spell some ids with hyphens ("chunk-jump") and the engine without ("chunkjump").
export function normalizeStyleId(style: string): string {
  return style.trim().toLowerCase().replace(/-/g, "");
}

export function isPremiumStyle(style: string | null | undefined): boolean {
  if (!style) return false;
  return !FREE.has(normalizeStyleId(style));
}

type StyleCarrier = { animStyle?: unknown };

function readStyle(value: unknown): string | null {
  const style = (value as StyleCarrier | null)?.animStyle;
  return typeof style === "string" && style.trim() ? style : null;
}

/** Every style a render would draw with: project default, scenes, layers and annotations. */
export function premiumStylesIn(project: {
  animStyle?: unknown;
  scenes?: unknown[];
}): string[] {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    const style = readStyle(value);
    if (style && isPremiumStyle(style)) found.add(normalizeStyleId(style));
  };

  visit(project);
  for (const scene of project.scenes ?? []) {
    visit(scene);
    const layers = (scene as { layers?: unknown[] } | null)?.layers ?? [];
    const annotations = (scene as { annotations?: unknown[] } | null)?.annotations ?? [];
    for (const layer of layers) {
      visit(layer);
      for (const annotation of (layer as { annotations?: unknown[] } | null)?.annotations ?? []) {
        visit(annotation);
      }
    }
    for (const annotation of annotations) visit(annotation);
  }
  return [...found];
}
