'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function leaveOrganization(organizationId: string) {
  try {
    const session = await auth.api.getSession();
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user is member of this organization
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: { role: { select: { name: true } } },
    });

    if (!membership) {
      return { success: false, error: 'Not a member of this organization' };
    }

    // If user is owner, check if there are other owners
    if (membership.role.name === 'owner') {
      const ownerCount = await prisma.userOrganization.count({
        where: {
          organizationId,
          role: { name: 'owner' },
        },
      });

      if (ownerCount <= 1) {
        return { success: false, error: 'Cannot leave: you are the last owner of this organization' };
      }
    }

    // Remove user from organization
    await prisma.userOrganization.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    return { success: true, message: 'Successfully left the organization' };
  } catch (error) {
    return { success: false, error: 'Failed to leave organization' };
  }
}
