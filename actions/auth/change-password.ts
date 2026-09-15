'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/database'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function changePassword(data: unknown) {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    const validated = schema.parse(data)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })

    if (!user || !user.password) return { error: 'User not found' }

    const bcrypt = require('bcryptjs')
    const valid = await bcrypt.compare(validated.currentPassword, user.password)
    if (!valid) return { error: 'Current password is incorrect' }

    const hashedPassword = await bcrypt.hash(validated.newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to change password' }
  }
}
