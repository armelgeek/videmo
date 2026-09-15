'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/database'
import crypto from 'crypto'

export async function generateRecoveryCodes() {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    const codes = Array.from({ length: 8 }, () => {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()
      return code.match(/.{1,4}/g)?.join('-') || code
    })

    const bcrypt = require('bcryptjs')
    const hashes = await Promise.all(codes.map(c => bcrypt.hash(c, 10)))

    await prisma.recoveryCode.deleteMany({ where: { userId: session.user.id } })
    await Promise.all(
      hashes.map((hash, i) =>
        prisma.recoveryCode.create({
          data: { userId: session.user.id, codeHash: hash },
        })
      )
    )

    return { success: true, codes }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to generate codes' }
  }
}
