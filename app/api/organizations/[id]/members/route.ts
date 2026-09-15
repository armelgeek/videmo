import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const ROLES = ["owner", "admin", "member"] as const;

const updateMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});

const removeMemberSchema = z.object({
  userId: z.string().min(1),
});

function membershipKey(organizationId: string, userId: string) {
  return { organizationId_userId: { organizationId, userId } };
}

async function requireManager(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: membershipKey(organizationId, userId),
    select: { role: true },
  });
  return membership && (membership.role === "owner" || membership.role === "admin");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, role } = updateMemberSchema.parse(await request.json());

    if (!(await requireManager(id, session.user.id))) {
      return NextResponse.json(
        { error: "Only owners and admins can change member roles" },
        { status: 403 }
      );
    }

    if (userId === session.user.id) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    const target = await prisma.organizationMember.findUnique({
      where: membershipKey(id, userId),
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found in this organization" }, { status: 404 });
    }

    const updated = await prisma.organizationMember.update({
      where: membershipKey(id, userId),
      data: { role },
      select: { id: true, userId: true, role: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = removeMemberSchema.parse(await request.json());

    if (!(await requireManager(id, session.user.id))) {
      return NextResponse.json(
        { error: "Only owners and admins can remove members" },
        { status: 403 }
      );
    }

    if (userId === session.user.id) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
    }

    const target = await prisma.organizationMember.findUnique({
      where: membershipKey(id, userId),
      select: { role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === "owner") {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: id, role: "owner" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner from the organization" },
          { status: 409 }
        );
      }
    }

    await prisma.organizationMember.delete({ where: membershipKey(id, userId) });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
