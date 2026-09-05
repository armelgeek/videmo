import { describe, expect, it } from "vitest";
import {
  InMemoryObjectStorage,
  StorageNotConfiguredError,
  buildImageKey,
  buildPublicUrl,
  readS3Config,
} from "./object-storage";

const fullEnv = {
  S3_ENDPOINT: "https://s3.example.test",
  S3_BUCKET: "videos",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_PUBLIC_URL: "https://cdn.example.test",
};

describe("readS3Config", () => {
  it("lit une configuration complete", () => {
    const config = readS3Config(fullEnv);

    expect(config.bucket).toBe("videos");
    expect(config.endpoint).toBe("https://s3.example.test");
  });

  it("nomme precisement ce qui manque", () => {
    // Un secret absent produisait un echec opaque au moment de l'upload, donc
    // apres avoir paye la generation.
    try {
      readS3Config({ ...fullEnv, S3_BUCKET: undefined, S3_PUBLIC_URL: "  " });
      expect.unreachable("readS3Config aurait du lever");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageNotConfiguredError);
      expect((error as StorageNotConfiguredError).missing).toEqual([
        "S3_BUCKET",
        "S3_PUBLIC_URL",
      ]);
    }
  });

  it("retombe sur la region auto, valable pour R2", () => {
    expect(readS3Config(fullEnv).region).toBe("auto");
    expect(readS3Config({ ...fullEnv, S3_REGION: "eu-west-3" }).region).toBe(
      "eu-west-3",
    );
  });

  it("garde le style chemin par defaut, requis par MinIO", () => {
    expect(readS3Config(fullEnv).forcePathStyle).toBe(true);
    expect(
      readS3Config({ ...fullEnv, S3_FORCE_PATH_STYLE: "false" }).forcePathStyle,
    ).toBe(false);
  });

  it("retire la barre finale de l'URL publique", () => {
    expect(
      readS3Config({ ...fullEnv, S3_PUBLIC_URL: "https://cdn.test///" })
        .publicUrl,
    ).toBe("https://cdn.test");
  });
});

describe("buildPublicUrl", () => {
  it("joint sans doubler la barre", () => {
    expect(buildPublicUrl("https://cdn.test/", "/a/b.png")).toBe(
      "https://cdn.test/a/b.png",
    );
  });
});

describe("buildImageKey", () => {
  it("range la scene sous son projet", () => {
    const key = buildImageKey({
      projectId: "abc123",
      sceneIndex: 2,
      now: 1700000000000,
      random: "xyz789",
    });

    expect(key).toBe("projects/abc123/scenes/2-1700000000000-xyz789.png");
  });

  it("refuse les caracteres hasardeux dans le chemin", () => {
    const key = buildImageKey({
      projectId: "../../etc/passwd",
      sceneIndex: 0,
      now: 1,
      random: "r",
    });

    expect(key).toBe("projects/etcpasswd/scenes/0-1-r.png");
    expect(key).not.toContain("..");
  });

  it("ne produit jamais deux fois la meme cle", () => {
    const keys = new Set(
      Array.from({ length: 50 }, () =>
        buildImageKey({ projectId: "p", sceneIndex: 0 }),
      ),
    );

    expect(keys.size).toBe(50);
  });
});

describe("InMemoryObjectStorage", () => {
  it("rend une URL durable, jamais une data:", async () => {
    const storage = new InMemoryObjectStorage();
    const url = await storage.put({
      key: "projects/p/scenes/0.png",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });

    expect(url).toBe("https://storage.test/projects/p/scenes/0.png");
    expect(url.startsWith("data:")).toBe(false);
    expect(storage.objects.get("projects/p/scenes/0.png")?.contentType).toBe(
      "image/png",
    );
  });
});
