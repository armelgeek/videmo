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
const NARRATORS = [
  "david", "sarah", "michael", "emma", "james", "sophia", "alex", "oliver"
];

type ConversationStep =
  | "collecting-params"
  | "params-complete"
  | "generating-script"
  | "validating-script"
  | "generating-storyboard"
  | "validating-storyboard"
  | "generating-images"
  | "choosing-narrator"
  | "generating-video";

type ConversationState = {
  step?: ConversationStep;
  content?: string;
  format?: string;
  style?: string;
  aspectRatio?: string;
  language?: string;
  script?: string;
  storyboard?: string;
  narrator?: string;
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
    let state = conversationHistory.get(sessionId) || {
      step: "collecting-params",
    };

    // ===== STEP 1: Collect Parameters =====
    if (!state.step || state.step === "collecting-params") {
      // First message - extract content
      if (!state.content) {
        state.content = message;
        state.step = "collecting-params";
        conversationHistory.set(sessionId, state);

        return NextResponse.json({
          complete: false,
          response: `Perfect! I'll help you create a video about: "${message}"\n\nNow, what format would you like?`,
          currentParams: state,
          nextStep: {
            field: "format",
            options: FORMATS,
          },
        });
      }

      // Call agent to extract parameter
      const nextParam = getNextParameter(state);

      if (!nextParam) {
        // All params collected - move to next step
        state.step = "params-complete";
        conversationHistory.set(sessionId, state);

        return NextResponse.json({
          complete: false,
          response: `Excellent! All parameters set:
• Format: ${state.format}
• Style: ${state.style}
• Aspect Ratio: ${state.aspectRatio}
• Language: ${state.language}

Now I'll generate your script. This may take a moment...`,
          currentParams: state,
          step: "params-complete",
        });
      }

      // Extract the parameter value using agent
      const agentResult = await videoChatAgent.generate(
        `User: "${message}"
State: ${JSON.stringify(state)}
Collect: ${nextParam}
Valid: ${
          nextParam === "format"
            ? FORMATS.join(", ")
            : nextParam === "style"
              ? STYLES.join(", ")
              : nextParam === "aspectRatio"
                ? ASPECT_RATIOS.join(", ")
                : LANGUAGES.join(", ")
        }
Respond ONLY the valid option value.`
      );

      const extractedValue = agentResult.text.trim().toLowerCase();
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
          response: `I didn't catch that. Please choose: ${validOptions.join(", ")}`,
          currentParams: state,
          nextStep: {
            field: nextParam,
            options: validOptions,
          },
        });
      }

      (state as any)[nextParam] = normalizedValue;
      conversationHistory.set(sessionId, state);

      const nextStep = getNextParameter(state);
      const stepQuestions: Record<string, string> = {
        format: "Choose format: explainer or brief?",
        style: `Pick a style: ${STYLES.slice(0, 6).join(", ")} ...`,
        aspectRatio: "Pick ratio: 16:9 or 9:16?",
        language: `Pick language: ${LANGUAGES.slice(0, 6).join(", ")} ...`,
      };

      return NextResponse.json({
        complete: false,
        response: `✓ ${nextParam}: **${normalizedValue}**\n\n${nextStep ? stepQuestions[nextStep] : ""}`,
        currentParams: state,
        nextStep: nextStep
          ? {
              field: nextStep,
              options:
                nextStep === "format"
                  ? FORMATS
                  : nextStep === "style"
                    ? STYLES
                    : nextStep === "aspectRatio"
                      ? ASPECT_RATIOS
                      : LANGUAGES,
            }
          : null,
      });
    }

    // ===== STEP 2: Generate Script =====
    if (state.step === "params-complete") {
      state.step = "generating-script";
      state.script = `[Script for ${state.format} video about ${(state.content || "").substring(0, 50)}...]`;
      conversationHistory.set(sessionId, state);

      return NextResponse.json({
        complete: false,
        response: `📝 Script generated! Preview:\n\n${state.script}\n\nDoes this script work for you?`,
        currentParams: state,
        step: "validating-script",
        nextStep: {
          field: "validate-script",
          options: ["yes", "regenerate"],
        },
      });
    }

    // ===== STEP 3: Validate & Generate Storyboard =====
    if (state.step === "validating-script") {
      if (message.toLowerCase() !== "yes" && message.toLowerCase() !== "regenerate") {
        return NextResponse.json({
          complete: false,
          response: `Please say "yes" to approve or "regenerate" to try again.`,
          currentParams: state,
          nextStep: {
            field: "validate-script",
            options: ["yes", "regenerate"],
          },
        });
      }

      if (message.toLowerCase() === "regenerate") {
        // In a real scenario, regenerate the script
        state.script = `[Regenerated script...]`;
        return NextResponse.json({
          complete: false,
          response: `📝 New script:\n\n${state.script}\n\nBetter?`,
          currentParams: state,
          nextStep: {
            field: "validate-script",
            options: ["yes", "regenerate"],
          },
        });
      }

      // Approved - move to storyboard
      state.step = "validating-storyboard";
      state.storyboard = `[Storyboard frames for ${state.style} style...]`;
      conversationHistory.set(sessionId, state);

      return NextResponse.json({
        complete: false,
        response: `🎨 Storyboard created in ${state.style} style!\n\n${state.storyboard}\n\nApprove this storyboard?`,
        currentParams: state,
        nextStep: {
          field: "validate-storyboard",
          options: ["yes", "regenerate"],
        },
      });
    }

    // ===== STEP 4: Validate Storyboard =====
    if (state.step === "validating-storyboard") {
      if (message.toLowerCase() !== "yes" && message.toLowerCase() !== "regenerate") {
        return NextResponse.json({
          complete: false,
          response: `Please say "yes" to approve or "regenerate".`,
          nextStep: {
            field: "validate-storyboard",
            options: ["yes", "regenerate"],
          },
        });
      }

      if (message.toLowerCase() === "regenerate") {
        state.storyboard = `[Regenerated storyboard...]`;
        return NextResponse.json({
          complete: false,
          response: `🎨 New storyboard ready. Looks good?`,
          nextStep: {
            field: "validate-storyboard",
            options: ["yes", "regenerate"],
          },
        });
      }

      // Approved - move to narrator choice
      state.step = "choosing-narrator";
      conversationHistory.set(sessionId, state);

      return NextResponse.json({
        complete: false,
        response: `🎤 Great! Now choose a narrator voice for your ${state.language} video.`,
        currentParams: state,
        nextStep: {
          field: "narrator",
          options: NARRATORS,
        },
      });
    }

    // ===== STEP 5: Choose Narrator =====
    if (state.step === "choosing-narrator") {
      const validNarrators = NARRATORS;
      const normalizedNarrator = validNarrators.find(
        (n) => n.toLowerCase() === message.toLowerCase()
      );

      if (!normalizedNarrator) {
        return NextResponse.json({
          complete: false,
          response: `Please choose a narrator: ${validNarrators.join(", ")}`,
          nextStep: {
            field: "narrator",
            options: validNarrators,
          },
        });
      }

      state.narrator = normalizedNarrator;
      state.step = "generating-video";
      conversationHistory.set(sessionId, state);

      return NextResponse.json({
        complete: true,
        params: state,
        response: `Perfect! Ready to generate your final video with narrator: **${normalizedNarrator}**.`,
      });
    }

    return NextResponse.json({
      error: "Unknown state",
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
