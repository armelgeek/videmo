'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/database'
import crypto from 'crypto'

export async function createTrustedDevice(userAgent: string) {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    const deviceHash = crypto.createHash('sha256').update(userAgent).digest('hex')
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const device = await prisma.trustedDevice.create({
      data: {
        userId: session.user.id,
        deviceHash,
        token,
        expiresAt,
        lastUsedAt: new Date(),
      },
    })

    return { success: true, token }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create trusted device' }
  }
}

export async function revokeTrustedDevice(deviceId: string) {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to revoke device' }
  }
}

export async function getTrustedDevices() {
  try {
    const session = await auth.api.getSession()
    if (!session?.user) return { error: 'Unauthorized' }

    const devices = await prisma.trustedDevice.findMany({
      where: { userId: session.user.id, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
    })

    return { success: true, devices }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to fetch devices' }
  }
}
