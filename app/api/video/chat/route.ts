import { videoChatAgent } from "@/lib/mastra/agents/video-chat-agent";
import { NextRequest, NextResponse } from "next/server";

const FORMATS = ["explainer", "brief"];
const STYLES = [
  "watercolor", "anime", "retro", "whiteboard", "classic", "cinematic",
  "isometric", "flat", "comic", "neon", "oil", "sketch", "papercut", "popart",
  "storybook", "pixel", "minimalist", "infographic", "documentary", "gothic",
  "pastel", "3b1b", "corporate", "presentation", "tech",
];
const ASPECT_RATIOS = ["16:9", "9:16"];
const LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl",
  "cs", "ar", "zh", "ja", "ko", "hi",
];

type ConversationState = {
  content?: string;
  format?: string;
  style?: string;
  aspectRatio?: string;
  language?: string;
};

// Store conversation history per session
const conversationHistory = new Map<string, ConversationState>();

function getNextParameter(state: ConversationState) {
  if (!state.content) return null;
  if (!state.format) return "format";
  if (!state.style) return "style";
  if (!state.aspectRatio) return "aspectRatio";
  if (!state.language) return "language";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId = "default" } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get or create conversation state
    const state = conversationHistory.get(sessionId) || {};

    // First message - extract content
    if (!state.content) {
      state.content = message;
      conversationHistory.set(sessionId, state);

      // Ask for format
      return NextResponse.json({
        complete: false,
        response: `Perfect! I'll help you create a video about: "${message}"\n\nNow, what format would you like?`,
        currentParams: state,
        nextStep: {
          field: "format",
          options: FORMATS,
          question: "Choose format: explainer or brief?",
        },
      });
    }

    // Call Mastra agent to intelligently extract the parameter
    const nextParam = getNextParameter(state);

    if (!nextParam) {
      return NextResponse.json({
        complete: true,
        params: state,
        response: `Perfect! All parameters set. Generating your video...`,
      });
    }

    // Use agent to interpret the user input for the current parameter
    const agentResult = await videoChatAgent.generate(
      `User message: "${message}"
Current conversation state: ${JSON.stringify(state)}
We're currently collecting: ${nextParam}

Valid options for ${nextParam}:
${nextParam === "format"
  ? FORMATS.join(", ")
  : nextParam === "style"
    ? STYLES.join(", ")
    : nextParam === "aspectRatio"
      ? ASPECT_RATIOS.join(", ")
      : LANGUAGES.join(", ")
}

Extract what the user is trying to set for ${nextParam}. Respond with ONLY the valid option value (e.g., "anime", "16:9", "en"). If the user input is ambiguous or doesn't match any option, suggest the best match or ask for clarification.`
    );

    const extractedValue = agentResult.text.trim().toLowerCase();

    // Validate the extracted value
    const validOptions =
      nextParam === "format"
        ? FORMATS
        : nextParam === "style"
          ? STYLES
          : nextParam === "aspectRatio"
            ? ASPECT_RATIOS
            : LANGUAGES;

    const normalizedValue = validOptions.find(
      (opt) => opt.toLowerCase() === extractedValue
    );

    if (!normalizedValue) {
      return NextResponse.json({
        complete: false,
        response: `I didn't quite understand. Could you clarify your choice for ${nextParam}?\n\nAvailable options: ${validOptions.join(", ")}`,
        currentParams: state,
      });
    }

    // Update state with the new parameter
    state[nextParam as keyof ConversationState] = normalizedValue;
    conversationHistory.set(sessionId, state);

    // Check if all parameters are collected
    const nextStep = getNextParameter(state);

    if (!nextStep) {
      return NextResponse.json({
        complete: true,
        params: state,
        response: `Excellent! All set. Ready to create your video with these parameters:`,
      });
    }

    // Ask for next parameter
    const questionText =
      nextStep === "format"
        ? "What format would you like? (explainer or brief)"
        : nextStep === "style"
          ? `What visual style? Options: ${STYLES.join(", ")}`
          : nextStep === "aspectRatio"
            ? "What aspect ratio? (16:9 for widescreen or 9:16 for vertical)"
            : `What language for narration? (${LANGUAGES.join(", ")})`;

    return NextResponse.json({
      complete: false,
      response: `Great! ${nextParam} set to: **${normalizedValue}**\n\n${questionText}`,
      currentParams: state,
      nextStep: {
        field: nextStep,
        options:
          nextStep === "format"
            ? FORMATS
            : nextStep === "style"
              ? STYLES
              : nextStep === "aspectRatio"
                ? ASPECT_RATIOS
                : LANGUAGES,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process chat message",
      },
      { status: 500 }
    );
  }
}
