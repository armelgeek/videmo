import { createReadStream, statSync } from "node:fs";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  type ObjectStorage,
  type S3Config,
  buildPublicUrl,
  readS3Config,
} from "./object-storage";

/**
 * L'adaptateur S3, valable pour tout bac compatible : R2, MinIO, Backblaze,
 * Scaleway. Rien ici ne suppose AWS lui-meme.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        // Une image de storyboard est relue a chaque ouverture du projet et ne
        // change jamais : son URL porte un horodatage, donc elle est immuable.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return buildPublicUrl(this.config.publicUrl, input.key);
  }

  async putFile(input: { key: string; path: string; contentType: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: createReadStream(input.path),
        // Obligatoire avec un flux : sans taille connue, S3 refuse l'envoi.
        ContentLength: statSync(input.path).size,
        ContentType: input.contentType,
        CacheControl: "private, no-store",
      }),
    );
  }

  async getStream(key: string) {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      if (!res.Body) return null;
      return {
        body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentLength: res.ContentLength ?? null,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if ((error as Error).name === "NoSuchKey" || status === 404) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}

let cached: ObjectStorage | null = null;

/**
 * Le client est garde entre les requetes : le construire a chaque appel
 * relancait la resolution des identifiants pour chacune des dix images.
 */
export function getObjectStorage(): ObjectStorage {
  if (!cached) cached = new S3ObjectStorage(readS3Config());
  return cached;
}
