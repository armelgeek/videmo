import type { AnnotationPlan } from "@/lib/storyboard/annotation-planning";

/**
 * Reads an already produced image to locate the areas to reveal.
 *
 * Separate from ImageGenerator: producing an illustration and reading it back
 * are two distinct capabilities, which one provider does not always offer.
 */
export interface RegionReader {
  read(input: ReadRegionsInput): Promise<AnnotationPlan>;
}

export interface ReadRegionsInput {
  /** L'image a lire, telle qu'elle sera affichee. */
  imageUrl: string;
  prompt: string;
}

export class RegionReadFailedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RegionReadFailedError";
  }
}

/** Test double: returns the regions it is given, without network. */
export class FakeRegionReader implements RegionReader {
  readonly calls: ReadRegionsInput[] = [];

  constructor(
    private readonly behavior: { plan?: AnnotationPlan; failWith?: Error } = {},
  ) {}

  async read(input: ReadRegionsInput): Promise<AnnotationPlan> {
    this.calls.push(input);
    if (this.behavior.failWith) throw this.behavior.failWith;
    return (
      this.behavior.plan ?? {
        regions: [{ beatIndex: 0, x: 0, y: 0, width: 100, height: 100 }],
      }
    );
  }
}
