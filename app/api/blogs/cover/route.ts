import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  StorageNotConfiguredError,
  buildBlogCoverKey,
} from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Le type est deduit du contenu, jamais de ce que le client declare : un
 * `Content-Type` d'image sur un fichier arbitraire ferait servir n'importe quoi
 * depuis le bac. SVG est exclu volontairement (il porte du script).
 */
function sniffImageType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  const startsWith = (offset: number, signature: number[]) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith(0, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (startsWith(0, [0x52, 0x49, 0x46, 0x46]) && startsWith(8, [0x57, 0x45, 0x42, 0x50])) {
    return { contentType: "image/webp", extension: "webp" };
  }
  if (startsWith(4, [0x66, 0x74, 0x79, 0x70]) && startsWith(8, [0x61, 0x76, 0x69, 0x66])) {
    return { contentType: "image/avif", extension: "avif" };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [canCreate, canUpdate] = await Promise.all([
    hasPermission(session.user.id, "blog", "create"),
    hasPermission(session.user.id, "blog", "update"),
  ]);
  if (!canCreate && !canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (5 MB max)" },
        { status: 413 },
      );
    }

    const body = new Uint8Array(await file.arrayBuffer());
    const imageType = sniffImageType(body);
    if (!imageType) {
      return NextResponse.json(
        { error: "Unsupported format. Use JPEG, PNG, WebP or AVIF." },
        { status: 415 },
      );
    }

    const url = await getObjectStorage().put({
      key: buildBlogCoverKey({ extension: imageType.extension }),
      body,
      contentType: imageType.contentType,
    });

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      console.error("Blog cover upload: storage not configured", error.missing);
      return NextResponse.json(
        { error: "Image storage is not configured on this environment." },
        { status: 503 },
      );
    }
    console.error("Blog cover upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
