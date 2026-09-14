import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    // Get invitation without requiring session (user might not be logged in)
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "Invitation expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      id: invitation.id,
      invitedEmail: invitation.email,
      organizationName: invitation.organization.name,
      organizationId: invitation.organization.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load invitation" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if email is verified (better-auth requirement)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      return NextResponse.json(
        { error: "Email not verified" },
        { status: 403 }
      );
    }

    // Get invitation
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "Invitation expired" },
        { status: 410 }
      );
    }

    // Check email matches
    if (invitation.email !== session.user.email) {
      return NextResponse.json(
        { error: "Email mismatch" },
        { status: 403 }
      );
    }

    // Check if already member
    const existingMember = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "Already member" },
        { status: 409 }
      );
    }

    // Accept invitation: add user to organization
    await Promise.all([
      prisma.userOrganization.create({
        data: {
          userId: session.user.id,
          organizationId: invitation.organizationId,
          role: {
            connect: { name: "Member" }, // Default role
          },
        },
      }),
      prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      organizationName: invitation.organization.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
