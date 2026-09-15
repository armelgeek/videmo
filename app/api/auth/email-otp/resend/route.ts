import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIdentifier } from "@/lib/security/rate-limiter"
import { z } from "zod"
import { emailOtp } from "@/lib/auth-client"
import { toast } from "sonner"

const schema = z.object({
  email: z.string().email(),
  type: z.enum(["email-verification", "sign-in"]),
})

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIdentifier(request)
    const limit = await checkRateLimit(clientIp, "auth:resend-otp")

    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${limit.resetIn}s` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, type } = schema.parse(body)

    const { error } = await emailOtp.sendVerificationOtp({ email, type })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Resend OTP error:", error)
    return NextResponse.json({ error: "Failed to resend" }, { status: 400 })
  }
}
