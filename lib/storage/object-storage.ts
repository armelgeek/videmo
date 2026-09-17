/**
 * Le contrat de stockage des fichiers durables.
 *
 * L'interface existe pour que la generation d'images n'ait jamais a connaitre
 * le fournisseur : les tests passent l'adaptateur en memoire, et changer de
 * bucket ne touche qu'un fichier.
 */
export interface ObjectStorage {
  /**
   * Ecrit l'objet et rend son URL publique — durable par contrat : elle est
   * enregistree en base, ou une `data:` ou `blob:` est refusee.
   */
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<string>;

  /** Envoie un fichier local en flux : une video ne tient pas en memoire. */
  putFile(input: { key: string; path: string; contentType: string }): Promise<void>;

  /** Relit un objet en flux, `null` s'il n'existe pas. */
  getStream(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentLength: number | null } | null>;

  delete(key: string): Promise<void>;
}

/** La video d'un export. L'id de job est un UUID : la cle n'est pas devinable. */
export function buildRenderKey(userId: string, jobId: string): string {
  return `renders/${userId.replace(/[^A-Za-z0-9_-]/g, "")}/${jobId}.mp4`;
}

export class StorageNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Object storage is not configured. Missing: ${missing.join(", ")}`,
    );
    this.name = "StorageNotConfiguredError";
  }
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base des URL publiques ; le bucket est rarement servi sur son endpoint S3. */
  publicUrl: string;
  forcePathStyle: boolean;
}

const REQUIRED_VARS = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_URL",
] as const;

/**
 * Lit la configuration, ou dit precisement ce qui manque.
 *
 * Un secret absent produisait un echec d'upload opaque au moment du premier
 * appel modele — donc apres l'avoir paye.
 */
export function readS3Config(
  env: Record<string, string | undefined> = process.env,
): S3Config {
  const missing = REQUIRED_VARS.filter((name) => !env[name]?.trim());
  if (missing.length > 0) throw new StorageNotConfiguredError(missing);

  // Une page https ne peut pas lire les pixels d'une illustration servie en
  // http (contenu mixte) : l'animation ne demarrerait pas, et l'optimiseur
  // d'images refuse aussi ce bac. Seul un bac local reste permis, pour tester
  // un build de production sur sa machine.
  if (env.NODE_ENV === "production") {
    const url = new URL(env.S3_PUBLIC_URL as string);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) {
      throw new StorageNotConfiguredError(["S3_PUBLIC_URL (https requis en production)"]);
    }
  }

  return {
    endpoint: env.S3_ENDPOINT as string,
    region: env.S3_REGION?.trim() || "auto",
    bucket: env.S3_BUCKET as string,
    accessKeyId: env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    // Sans barre finale : buildPublicUrl la pose, et deux barres cassent
    // certains CDN.
    publicUrl: (env.S3_PUBLIC_URL as string).replace(/\/+$/, ""),
    // MinIO et la plupart des bacs auto-heberges n'ont pas de DNS par bucket.
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== "false",
  };
}

export function buildPublicUrl(publicUrl: string, key: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

/**
 * Une cle d'objet sans collision ni caractere hasardeux.
 *
 * Le projet est dans le chemin pour qu'une suppression cote bac reste possible
 * sans consulter la base.
 */
export function buildImageKey(input: {
  projectId: string;
  sceneIndex: number;
  extension?: string;
  now?: number;
  random?: string;
}): string {
  const stamp = input.now ?? Date.now();
  const random = input.random ?? Math.random().toString(36).slice(2, 8);
  const safeProject = input.projectId.replace(/[^A-Za-z0-9_-]/g, "");
  const extension = input.extension ?? "png";

  return `projects/${safeProject}/scenes/${input.sceneIndex}-${stamp}-${random}.${extension}`;
}

export function buildBlogCoverKey(input: {
  extension: string;
  now?: number;
  random?: string;
}): string {
  const stamp = input.now ?? Date.now();
  const random = input.random ?? Math.random().toString(36).slice(2, 8);
  const extension = input.extension.replace(/[^a-z0-9]/gi, "").toLowerCase();

  return `blog/covers/${stamp}-${random}.${extension}`;
}

export function buildNarrationKey(input: {
  projectId: string;
  sceneIndex: number;
  /**
   * Le temps de narration dans la scene, quand la voix est produite temps par
   * temps. L'horodatage suffirait a eviter la collision, mais une scene rend
   * alors plusieurs fichiers qu'on ne pourrait plus distinguer dans le bac.
   */
  beatIndex?: number;
  now?: number;
  random?: string;
}): string {
  const stamp = input.now ?? Date.now();
  const random = input.random ?? Math.random().toString(36).slice(2, 8);
  const safeProject = input.projectId.replace(/[^A-Za-z0-9_-]/g, "");
  const scene =
    input.beatIndex === undefined
      ? `${input.sceneIndex}`
      : `${input.sceneIndex}-${input.beatIndex}`;

  return `projects/${safeProject}/narration/${scene}-${stamp}-${random}.mp3`;
}

/** Adaptateur de test : garde les objets en memoire et rend une URL stable. */
export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  constructor(private readonly publicUrl = "https://storage.test") {}

  async put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<string> {
    this.objects.set(input.key, {
      body: input.body,
      contentType: input.contentType,
    });
    return buildPublicUrl(this.publicUrl, input.key);
  }

  async putFile(input: { key: string; path: string; contentType: string }): Promise<void> {
    const { readFile } = await import("node:fs/promises");
    this.objects.set(input.key, {
      body: new Uint8Array(await readFile(input.path)),
      contentType: input.contentType,
    });
  }

  async getStream(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      body: new Response(object.body as unknown as BodyInit).body as ReadableStream<Uint8Array>,
      contentLength: object.body.length,
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
