import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/database"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url))
  }

  try {
    const magicLink = await prisma.magicLink.findUnique({ where: { token } })

    if (!magicLink || magicLink.expiresAt < new Date() || magicLink.usedAt) {
      return NextResponse.redirect(new URL("/login?error=expired", request.url))
    }

    let user = await prisma.user.findUnique({ where: { email: magicLink.email } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: magicLink.email,
          emailVerified: true,
          name: magicLink.email.split("@")[0],
        },
      })
    } else if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      })
    }

    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    })

    return NextResponse.redirect(new URL("/dashboard", request.url))
  } catch (error) {
    console.error("Magic link verify error:", error)
    return NextResponse.redirect(new URL("/login?error=failed", request.url))
  }
}
