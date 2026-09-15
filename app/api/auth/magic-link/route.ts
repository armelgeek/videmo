import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIdentifier } from "@/lib/security/rate-limiter"
import { z } from "zod"
import { prisma } from "@/lib/database"
import { emailService } from "@/lib/email-service"
import { appConfig } from "@/lib/config"
import crypto from "crypto"

const schema = z.object({
  email: z.string().email(),
  redirectTo: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIdentifier(request)
    const limit = await checkRateLimit(clientIp, "auth:magic-link")

    if (!limit.allowed) {
      return NextResponse.json(
        { message: `Too many requests. Try again in ${limit.resetIn}s` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, redirectTo } = schema.parse(body)

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } })

    // Generate token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Save magic link
    await prisma.magicLink.create({
      data: {
        email,
        token,
        expiresAt,
      },
    })

    // Send email
    try {
      await emailService.sendEmail({
        type: "magic_link",
        recipients: [email],
        subject: `Your sign-in link for ${appConfig.name}`,
        data: {
          recipientEmail: email,
          magicLink: `${appConfig.url}/api/auth/magic-link/verify?token=${token}${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`,
          expiryMinutes: 15,
        },
      })
    } catch (error) {
      console.error("Failed to send magic link email:", error)
      // Don't fail the request, the token is still valid
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Magic link error:", error)
    return NextResponse.json(
      { message: "Failed to send magic link" },
      { status: 400 }
    )
  }
}
