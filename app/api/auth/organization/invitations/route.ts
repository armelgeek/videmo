import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailService } from "@/lib/email-service";

const sendInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  organizationId: z.string().cuid(),
  role: z.enum(["member", "admin", "owner"]).default("member"),
});

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, organizationId, role } = sendInvitationSchema.parse(body);

    // Get organization and verify user is owner/admin
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user is owner or admin in this organization
    const userMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
      select: { role: { select: { name: true } } },
    });

    if (!userMembership || !["owner", "admin"].includes(userMembership.role.name)) {
      return NextResponse.json(
        { error: "Only owners and admins can invite members" },
        { status: 403 }
      );
    }

    // Check if email is already a member
    const existingMember = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        userOrganizations: {
          where: { organizationId },
          select: { id: true },
        },
      },
    });

    if (existingMember && existingMember.userOrganizations.length > 0) {
      return NextResponse.json(
        { error: "This user is already a member of the organization" },
        { status: 409 }
      );
    }

    // Check if invitation already exists and not expired
    const existingInvitation = await prisma.organizationInvitation.findFirst({
      where: {
        email,
        organizationId,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An active invitation already exists for this email" },
        { status: 409 }
      );
    }

    // Generate token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Create invitation
    const invitation = await prisma.organizationInvitation.create({
      data: {
        email,
        organizationId,
        token,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
      },
      select: { id: true, token: true },
    });

    // Send email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.id}`;
    try {
      await emailService.send({
        to: email,
        subject: `You're invited to ${organization.name}`,
        html: `
          <p>You've been invited to join <strong>${organization.name}</strong></p>
          <p><a href="${inviteUrl}">Accept Invitation</a></p>
          <p>This link expires in 6 hours.</p>
          <p>Or copy and paste this link:<br/>${inviteUrl}</p>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send invitation email", emailError);
      // Don't fail the invitation creation if email fails
      // User can still use the link or copy it manually
    }

    return NextResponse.json(
      {
        success: true,
        invitationId: invitation.id,
        inviteUrl,
        message: "Invitation sent successfully",
      },
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
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId required" },
        { status: 400 }
      );
    }

    // Verify user is member of this organization
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }

    // Get pending invitations (not expired)
    const invitations = await prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}
