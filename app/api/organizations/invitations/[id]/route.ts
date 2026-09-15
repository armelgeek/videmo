import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // No session required: the invitee may not be signed in yet.
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invitation || invitation.status !== "pending") {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    return NextResponse.json({
      id: invitation.id,
      invitedEmail: invitation.email,
      organizationName: invitation.organization.name,
      organizationId: invitation.organization.id,
    });
  } catch (error) {
    console.error("Failed to load invitation", error);
    return NextResponse.json({ error: "Failed to load invitation" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    });
    if (!user?.emailVerified) {
      return NextResponse.json({ error: "Email not verified" }, { status: 403 });
    }

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    if (!invitation || invitation.status !== "pending") {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    const key = { organizationId_userId: { organizationId: invitation.organizationId, userId: session.user.id } };
    const existingMember = await prisma.organizationMember.findUnique({ where: key, select: { id: true } });
    if (existingMember) {
      return NextResponse.json({ error: "Already member" }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "accepted" },
      }),
    ]);

    return NextResponse.json({ success: true, organizationName: invitation.organization.name });
  } catch (error) {
    console.error("Failed to accept invitation", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
