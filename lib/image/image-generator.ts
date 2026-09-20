/**
 * The image generation contract.
 *
 * The interface exists for the same reason as ObjectStorage: the route does not
 * know which provider produces the image, tests pass a double, and switching
 * engines touches only one file. Without it, `api.openai.com` and the response
 * format were hardcoded in the route, and no test could cover generation
 * without a paid call.
 */
export interface ImageGenerator {
  generate(input: GenerateImageInput): Promise<Uint8Array>;
}

export interface GenerateImageInput {
  prompt: string;
  /** Already translated into a size the engine accepts. */
  size: string;
  /**
   * The reference panel, when the series must keep the same stroke. Not every
   * engine can use it: an adapter that ignores it stays compliant, it loses
   * style consistency, not the image.
   */
  reference?: Uint8Array;
}

export class ImageGeneratorNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Image generation is not configured. Missing: ${missing.join(", ")}`);
    this.name = "ImageGeneratorNotConfiguredError";
  }
}

/** The engine responded, but without a usable image. */
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
 * The smallest valid PNG: one transparent pixel. Tests need bytes a decoder
 * accepts, not a real illustration.
 */
export const TRANSPARENT_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

/**
 * Test double: returns a valid PNG without a network call, and records requests
 * so tests can check what was asked.
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
