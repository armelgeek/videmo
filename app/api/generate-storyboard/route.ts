import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, style, format, aspectRatio, language } = body;

    if (!content || !style || !format || !aspectRatio || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // TODO: Call agent to generate storyboard
    // For now, return a demo storyboard structure
    const storyboard = {
      title: `${style} ${format} - ${aspectRatio} - ${language}`,
      narrativeFlow: content.substring(0, 100),
      narrativeStyle: `Professional ${style} narrative`,
      clipOutlines: Array.from(
        { length: format === "brief" ? 6 : 10 },
        (_, i) => ({
          index: i,
          clipType:
            i === 0
              ? "intro"
              : i === (format === "brief" ? 5 : 9)
                ? "outro"
                : "content",
          title: `Clip ${i + 1}`,
          summary: `Content for clip ${i + 1} based on: ${content.substring(0, 50)}...`,
        }),
      ),
    };

    return NextResponse.json({ storyboard });
  } catch (error) {
    console.error("Storyboard generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate storyboard" },
      { status: 500 },
    );
  }
}
