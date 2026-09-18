import { NextRequest, NextResponse } from "next/server";
import { getOrgPlan } from "@/lib/billing/plan-gating";
import { recordStoredObject } from "@/lib/billing/org-usage";
import { prisma } from "@/lib/prisma";
import { StorageNotConfiguredError, buildBrandLogoKey } from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import { requireSessionViewer, toErrorResponse } from "@/lib/video-project/session";

const MAX_BYTES = 1024 * 1024;

// node-canvas stamps the logo into exports: keep to formats it decodes everywhere. SVG carries script.
function sniffLogoType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  const startsWith = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (startsWith([0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", extension: "jpg" };
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  return null;
}

async function authorize(organizationId: string) {
  const viewer = await requireSessionViewer();
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: viewer.userId } },
    select: { role: true },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can change the brand logo" }, { status: 403 });
  }
  const plan = await getOrgPlan(organizationId);
  if (plan.features.custom_branding !== true) {
    return NextResponse.json(
      {
        error: "Custom branding is included in the Enterprise plan.",
        code: "feature_unavailable",
        feature: "custom_branding",
      },
      { status: 403 },
    );
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const refused = await authorize(id);
    if (refused) return refused;

    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "The logo must be 1 MB or less" }, { status: 400 });
    }
    const body = new Uint8Array(await file.arrayBuffer());
    const type = sniffLogoType(body);
    if (!type) return NextResponse.json({ error: "Use a PNG or JPEG image" }, { status: 400 });

    const key = buildBrandLogoKey({ organizationId: id, extension: type.extension });
    const url = await getObjectStorage().put({ key, body, contentType: type.contentType });
    await recordStoredObject({ organizationId: id, projectId: null, key, bytes: body.byteLength });
    await prisma.organization.update({ where: { id }, data: { logo: url } });

    return NextResponse.json({ logo: url });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: error.message, missing: error.missing }, { status: 503 });
    }
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const refused = await authorize(id);
    if (refused) return refused;
    await prisma.organization.update({ where: { id }, data: { logo: null } });
    return NextResponse.json({ logo: null });
  } catch (error) {
    return toErrorResponse(error);
  }
}
