import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = updateOrganizationSchema.parse(body);

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { slug: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Personal workspaces carry the slug ensurePersonalOrganization assigns.
    if (!organization.slug.startsWith("personal-")) {
      return NextResponse.json(
        { error: "Only personal workspaces can be renamed" },
        { status: 403 }
      );
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: session.user.id } },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this organization" },
        { status: 403 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });

    return NextResponse.json({ ...updated, isPersonal: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}
