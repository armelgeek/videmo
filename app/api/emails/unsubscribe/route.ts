import { type NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { isValidUnsubscribeSignature } from "@/lib/email-sequences/unsubscribe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function unsubscribe(request: NextRequest): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("u");
  if (!isValidUnsubscribeSignature(userId, searchParams.get("s"), process.env.BETTER_AUTH_SECRET)) {
    return false;
  }
  await prisma.user.updateMany({ where: { id: userId! }, data: { marketingEmailsOptOut: true } });
  return true;
}

function page(title: string, message: string, status: number) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#000">
<h1 style="font-size:24px">${title}</h1><p>${message}</p><p><a href="${appConfig.url}" style="color:#000">Back to ${appConfig.name}</a></p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest) {
  if (!(await unsubscribe(request))) {
    return page("Invalid link", "This unsubscribe link is not valid.", 400);
  }
  return page(
    "You're unsubscribed",
    "You won't receive onboarding tips or monthly summaries anymore. Account and security emails still arrive.",
    200,
  );
}

// One-click unsubscribe from the mail client (RFC 8058).
export async function POST(request: NextRequest) {
  const ok = await unsubscribe(request);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
