import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { StorageNotConfiguredError, buildShowcaseKey } from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_POSTER_BYTES = 5 * 1024 * 1024;

type Sniffed = { kind: "video" | "poster"; contentType: string; extension: string };

// The type comes from the bytes, never from what the browser declares.
function sniff(bytes: Uint8Array): Sniffed | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", contentType: "video/webm", extension: "webm" };
  if (at(4, [0x66, 0x74, 0x79, 0x70]) && !at(8, [0x61, 0x76, 0x69, 0x66])) {
    return { kind: "video", contentType: "video/mp4", extension: "mp4" };
  }
  if (at(0, [0xff, 0xd8, 0xff])) return { kind: "poster", contentType: "image/jpeg", extension: "jpg" };
  if (at(0, [0x89, 0x50, 0x4e, 0x47])) return { kind: "poster", contentType: "image/png", extension: "png" };
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    return { kind: "poster", contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [canCreate, canUpdate] = await Promise.all([
    hasPermission(session.user.id, "showcase", "create"),
    hasPermission(session.user.id, "showcase", "update"),
  ]);
  if (!canCreate && !canUpdate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "File is too large (200 MB max)" }, { status: 413 });
    }

    const body = new Uint8Array(await file.arrayBuffer());
    const type = sniff(body);
    if (!type) {
      return NextResponse.json({ error: "Use an MP4 or WebM video, or a JPEG, PNG or WebP image" }, { status: 415 });
    }
    if (type.kind === "poster" && body.byteLength > MAX_POSTER_BYTES) {
      return NextResponse.json({ error: "Image is too large (5 MB max)" }, { status: 413 });
    }

    const url = await getObjectStorage().put({
      key: buildShowcaseKey({ kind: type.kind, extension: type.extension }),
      body,
      contentType: type.contentType,
    });
    return NextResponse.json({ url, kind: type.kind }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "File storage is not configured on this environment." }, { status: 503 });
    }
    console.error("Showcase upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
