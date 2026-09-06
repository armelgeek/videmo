import type { AnnotationPlan } from "@/lib/storyboard/annotation-planning";

/**
 * Lit une image deja produite pour y situer les zones a reveler.
 *
 * Separee d'ImageGenerator : produire une illustration et la relire sont deux
 * capacites distinctes, qu'un meme fournisseur n'offre pas forcement.
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

/** Double de test : rend les regions qu'on lui donne, sans reseau. */
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
