'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/database'
import { z } from 'zod'

const schema = z.object({
  newEmail: z.string().email(),
})

export async function initiateEmailChange(data: unknown) {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    const { newEmail } = schema.parse(data)
    if (newEmail === session.user.email) return { error: 'Email is the same' }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } })
    if (existing) return { error: 'Email already in use' }

    const result = await auth.api.sendVerificationEmail({
      email: newEmail,
      redirectURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email-change`,
    })

    if (!result) return { error: 'Failed to send verification email' }

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to initiate email change' }
  }
}

export async function verifyEmailChange(email: string, token: string) {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { email, emailVerified: new Date() },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to verify email change' }
  }
}
