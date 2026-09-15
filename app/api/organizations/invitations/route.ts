import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { EmailService } from "@/lib/email-service";

const INVITATION_TTL_HOURS = 6;
const INVITATION_TTL_MS = INVITATION_TTL_HOURS * 60 * 60 * 1000;

const sendInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  organizationId: z.string().min(1),
  role: z.enum(["member", "admin", "owner"]).default("member"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, organizationId, role } = sendInvitationSchema.parse(await request.json());

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.user.id } },
      select: { role: true },
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can invite members" },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { organizationMemberships: { where: { organizationId }, select: { id: true } } },
    });
    if (existingUser && existingUser.organizationMemberships.length > 0) {
      return NextResponse.json(
        { error: "This user is already a member of the organization" },
        { status: 409 }
      );
    }

    const existingInvitation = await prisma.organizationInvitation.findFirst({
      where: { email, organizationId, status: "pending", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "An active invitation already exists for this email" },
        { status: 409 }
      );
    }

    const invitation = await prisma.organizationInvitation.create({
      data: {
        email,
        organizationId,
        role,
        status: "pending",
        inviterId: session.user.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      select: { id: true },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.id}`;
    try {
      const inviterName = session.user.name || session.user.email;
      await new EmailService().sendEmail({
        type: "organization_invitation",
        recipients: [email],
        subject: `${inviterName} invited you to ${organization.name}`,
        data: {
          recipientEmail: email,
          organizationName: organization.name,
          inviterName,
          role,
          acceptUrl: inviteUrl,
          expiryHours: INVITATION_TTL_HOURS,
        },
      });
    } catch (emailError) {
      // The invitation stays valid: the link can still be shared by hand.
      console.error("Failed to send invitation email", emailError);
    }

    return NextResponse.json(
      { success: true, invitationId: invitation.id, inviteUrl, message: "Invitation sent successfully" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Failed to send invitation", error);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.user.id } },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId, status: "pending", expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Failed to fetch invitations", error);
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
}
