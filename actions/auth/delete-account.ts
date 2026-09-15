'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/database'
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(8),
})

export async function deleteAccount(data: unknown) {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    const { password } = schema.parse(data)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })

    if (!user || !user.password) return { error: 'User not found' }

    const bcrypt = require('bcryptjs')
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return { error: 'Password is incorrect' }

    await prisma.user.delete({ where: { id: user.id } })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete account' }
  }
}
