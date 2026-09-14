import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const updateMemberSchema = z.object({
  userId: z.string().cuid(),
  roleId: z.string().cuid(),
});

const removeMemberSchema = z.object({
  userId: z.string().cuid(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, roleId } = updateMemberSchema.parse(body);

    // Verify caller is owner/admin in this organization
    const callerMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: params.id,
        },
      },
      select: { role: { select: { name: true } } },
    });

    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role.name)) {
      return NextResponse.json(
        { error: "Only owners and admins can change member roles" },
        { status: 403 }
      );
    }

    // Can't change own role
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );
    }

    // Verify target user exists and is a member
    const targetMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: params.id,
        },
      },
      select: { id: true, role: { select: { id: true, name: true } } },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Member not found in this organization" },
        { status: 404 }
      );
    }

    // Verify new role exists
    const newRole = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });

    if (!newRole) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    // Update role
    const updated = await prisma.userOrganization.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId: params.id,
        },
      },
      data: { roleId: newRole.id },
      select: {
        id: true,
        userId: true,
        role: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = removeMemberSchema.parse(body);

    // Verify caller is owner/admin in this organization
    const callerMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: params.id,
        },
      },
      select: { role: { select: { name: true } } },
    });

    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role.name)) {
      return NextResponse.json(
        { error: "Only owners and admins can remove members" },
        { status: 403 }
      );
    }

    // Can't remove yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 400 }
      );
    }

    // Check if target is last owner
    const targetMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: params.id,
        },
      },
      select: { role: { select: { name: true } } },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (targetMembership.role.name === "owner") {
      // Check if there are other owners
      const ownerCount = await prisma.userOrganization.count({
        where: {
          organizationId: params.id,
          role: { name: "owner" },
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner from the organization" },
          { status: 409 }
        );
      }
    }

    // Remove member
    await prisma.userOrganization.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId: params.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
