import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { emailOTP, magicLink, organization, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { prisma } from "./prisma";
import { chooseActiveOrganization } from "./auth-organization";
import { QuotaExceededError } from "./billing/errors";
import { assertSeatAvailable, membershipLimitFor } from "./billing/org-usage";
import { EmailService } from "./email-service";
import { enqueueOnboarding } from "./email-sequences/enqueue";
import { appConfig } from "./config";
import { PROJECT_STATEMENTS } from "./video-project/access";

const isTwoFactorEnabled = process.env.NEXT_PUBLIC_ENABLE_TWO_FACTOR !== "false";
const isEmailVerificationEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_VERIFICATION !== "false";
export const isGoogleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const pendingWelcomeEmails = new Set<string>();

const INVITATION_EXPIRY_HOURS = 48;
const MAGIC_LINK_EXPIRY_MINUTES = 15;

const statement = { ...defaultStatements, ...PROJECT_STATEMENTS } as const;
const ac = createAccessControl(statement);

// La table de référence reste canAct (testée) ; ces rôles l'exposent au client
// pour que l'interface masque ce qui est interdit sans dupliquer la règle.
const organizationRoles = {
  owner: ac.newRole({ ...ownerAc.statements, project: ["create", "read", "update", "delete"] }),
  admin: ac.newRole({ ...adminAc.statements, project: ["create", "read", "update", "delete"] }),
  member: ac.newRole({ ...memberAc.statements, project: ["create", "read", "update"] }),
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user.emailVerified) {
            pendingWelcomeEmails.add(user.id);
          } else {
            await enqueueOnboarding(user.id).catch((error) =>
              console.error('❌ [Auth] Failed to schedule onboarding emails:', error),
            );
          }
        },
      },
      update: {
        after: async (user) => {
          if (!user.emailVerified || !pendingWelcomeEmails.has(user.id)) return;

          pendingWelcomeEmails.delete(user.id);
          const emailService = new EmailService();

          try {
            console.log('📧 [Auth] Sending welcome email to:', user.email);
            await emailService.sendEmail({
              type: 'welcome',
              recipients: [user.email],
              data: {
                recipientEmail: user.email,
                recipientName: user.name || user.email.split('@')[0],
                userName: user.name || user.email.split('@')[0],
              },
              subject: `Welcome to ${appConfig.name}! 🎉`,
            });
            console.log('✅ [Auth] Welcome email sent successfully to:', user.email);
          } catch (error) {
            console.error('❌ [Auth] Failed to send welcome email:', error);
          }

          await enqueueOnboarding(user.id).catch((error) =>
            console.error('❌ [Auth] Failed to schedule onboarding emails:', error),
          );
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const memberships = await prisma.organizationMember.findMany({
            where: { userId: session.userId },
            select: { organizationId: true, joinedAt: true },
          });

          return {
            data: {
              ...session,
              activeOrganizationId: chooseActiveOrganization(memberships),
            },
          };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: isEmailVerificationEnabled,
    sendResetPassword: async ({ user, url }) => {
      console.log('🔐 [Auth] sendResetPassword called', { email: user.email, url });
      const emailService = new EmailService();
      
      try {
        console.log('📧 [Auth] Sending password reset email to:', user.email);
        await emailService.sendEmail({
          recipients: [user.email],
          type: 'reset_password',
          data: {
            recipientEmail: user.email,
            recipientName: user.name || user.email.split('@')[0],
            resetToken: url.split('token=')[1] || '',
            resetUrl: url,
            expiryHours: 1,
          },
        });
        console.log('✅ [Auth] Password reset email sent successfully');
      } catch (error) {
        console.error('❌ [Auth] Error sending password reset email:', error);
        throw error;
      }
    },
  },
  socialProviders: isGoogleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : undefined,
  emailVerification: {
    sendOnSignUp: isEmailVerificationEnabled,
    autoSignInAfterVerification: !isEmailVerificationEnabled,
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            userId: user.id,
            status: { in: ["active", "trialing", "past_due"] },
            cancelAtPeriodEnd: false,
          },
          select: { id: true },
        });
        if (activeSubscription) {
          throw new APIError("BAD_REQUEST", {
            message: "Cancel your active subscription before deleting your account.",
          });
        }

        const ownedOrganizations = await prisma.organizationMember.findMany({
          where: { userId: user.id, role: "owner" },
          select: { organizationId: true },
        });
        for (const { organizationId } of ownedOrganizations) {
          const otherOwners = await prisma.organizationMember.count({
            where: { organizationId, role: "owner", userId: { not: user.id } },
          });
          const otherMembers = await prisma.organizationMember.count({
            where: { organizationId, userId: { not: user.id } },
          });
          // An owner leaving members behind would orphan the organization and its credits.
          if (otherOwners === 0 && otherMembers > 0) {
            throw new APIError("BAD_REQUEST", {
              message: "Transfer ownership of your organizations before deleting your account.",
            });
          }
        }
      },
    },
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
      isAdmin: {
        type: 'boolean',
        required: false,
        input: false,
      },
      roleId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, 
    updateAge: 60 * 60 * 24, 
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ],
  plugins: [
    organization({
      ac,
      roles: organizationRoles,
      invitationExpiresIn: INVITATION_EXPIRY_HOURS * 60 * 60,
      // Checked by the plugin when a member is added or an invitation accepted.
      membershipLimit: (_user, invitedTo) => membershipLimitFor(invitedTo.id),
      organizationHooks: {
        // Pending invitations count as seats, so a full plan is refused at invite time.
        beforeCreateInvitation: async ({ invitation }) => {
          try {
            await assertSeatAvailable(invitation.organizationId);
          } catch (error) {
            if (error instanceof QuotaExceededError) {
              throw new APIError("FORBIDDEN", {
                code: "quota_exceeded",
                message: `Your plan allows ${error.limit} member(s). Upgrade to invite more.`,
              });
            }
            throw error;
          }
        },
      },
      sendInvitationEmail: async ({ id, email, role, organization: invitedTo, inviter }) => {
        const acceptUrl = `${appConfig.url}/invite/${id}`;
        const inviterName = inviter.user.name || inviter.user.email;
        console.log('📧 [Auth] Sending organization invitation', { email, acceptUrl });
        await new EmailService().sendEmail({
          type: 'organization_invitation',
          recipients: [email],
          subject: `${inviterName} invited you to ${invitedTo.name}`,
          data: {
            recipientEmail: email,
            organizationName: invitedTo.name,
            inviterName,
            role,
            acceptUrl,
            expiryHours: INVITATION_EXPIRY_HOURS,
          },
        });
      },
      schema: {
        // The plugin expects 'member' and 'invitation' tables; ours are already
        // named, and renaming a table in production costs more than this
        // override.
        member: {
          modelName: "organizationMember",
          fields: { createdAt: "joinedAt" },
        },
        invitation: { modelName: "organizationInvitation" },
        organization: {
          additionalFields: {
            description: { type: "string", required: false },
          },
        },
      },
    }),
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRY_MINUTES * 60,
      async sendMagicLink({ email, url }) {
        await new EmailService().sendEmail({
          type: 'magic_link',
          recipients: [email],
          subject: `Your sign-in link for ${appConfig.name}`,
          data: {
            recipientEmail: email,
            magicLink: url,
            expiryMinutes: MAGIC_LINK_EXPIRY_MINUTES,
          },
        });
      },
    }),
    emailOTP({
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        console.log('🔐 [Auth] sendVerificationOTP called', { email, otp, type });
        const emailService = new EmailService();
        
        try {
          if (type === 'email-verification') {
            console.log('📧 [Auth] Sending email verification OTP to:', email);
            await emailService.sendEmail({
              recipients: [email],
              type: 'otp',
              data: {
                recipientEmail: email,
                recipientName: email.split('@')[0],
                otp: otp,
                expiryMinutes: 5,
              },
            });
            console.log('✅ [Auth] Email verification OTP sent successfully');
          } else if (type === 'sign-in') {
            console.log('📧 [Auth] Sending sign-in OTP to:', email);
            await emailService.sendEmail({
              recipients: [email],
              type: 'otp',
              data: {
                recipientEmail: email,
                recipientName: email.split('@')[0],
                otp: otp,
                expiryMinutes: 5,
              },
            });
            console.log('✅ [Auth] Sign-in OTP sent successfully');
          } else {
            
            console.log('📧 [Auth] Sending password reset OTP to:', email);
            await emailService.sendEmail({
              recipients: [email],
              type: 'otp',
              data: {
                recipientEmail: email,
                recipientName: email.split('@')[0],
                otp: otp,
                expiryMinutes: 10,
              },
            });
            console.log('✅ [Auth] Password reset OTP sent successfully');
          }
        } catch (error) {
          console.error('❌ [Auth] Error sending OTP email:', error);
          throw error;
        }
      },
      otpLength: 6,
      expiresIn: 300, 
      sendVerificationOnSignUp: true,
      disableSignUp: false,
    }),
    ...(isTwoFactorEnabled
      ? [twoFactor({ issuer: process.env.NEXT_PUBLIC_APP_NAME || "SaaS App" })]
      : []),
  ],
});
