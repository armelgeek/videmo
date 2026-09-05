/**
 * Le contrat de generation d'images.
 *
 * L'interface existe pour la meme raison qu'ObjectStorage : la route ignore
 * quel fournisseur produit l'image, les tests passent un double, et changer de
 * moteur ne touche qu'un fichier. Sans elle, `api.openai.com` et le format de
 * reponse etaient ecrits en dur dans la route, et aucun test ne pouvait couvrir
 * la generation sans appel payant.
 */
export interface ImageGenerator {
  generate(input: GenerateImageInput): Promise<Uint8Array>;
}

export interface GenerateImageInput {
  prompt: string;
  /** Deja traduite dans une taille que le moteur accepte. */
  size: string;
  /**
   * La case de reference, quand la serie doit garder le meme trait. Tous les
   * moteurs ne savent pas s'en servir : un adaptateur qui l'ignore reste
   * conforme, il perd la coherence de style, pas l'image.
   */
  reference?: Uint8Array;
}

export class ImageGeneratorNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Image generation is not configured. Missing: ${missing.join(", ")}`);
    this.name = "ImageGeneratorNotConfiguredError";
  }
}

/** Le moteur a repondu, mais sans image exploitable. */
export class ImageGenerationFailedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ImageGenerationFailedError";
  }
}

/**
 * Le plus petit PNG valide : un pixel transparent. Les tests ont besoin
 * d'octets qu'un decodeur accepte, pas d'une vraie illustration.
 */
export const TRANSPARENT_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

/**
 * Double de test : rend un PNG valide sans appel reseau, et garde la trace des
 * demandes pour que les tests puissent verifier ce qui a ete demande.
 */
export class FakeImageGenerator implements ImageGenerator {
  readonly calls: GenerateImageInput[] = [];

  constructor(
    private readonly behavior: {
      image?: Uint8Array;
      failWith?: Error;
    } = {},
  ) {}

  async generate(input: GenerateImageInput): Promise<Uint8Array> {
    this.calls.push(input);
    if (this.behavior.failWith) throw this.behavior.failWith;
    return this.behavior.image ?? TRANSPARENT_PNG;
  }
}
