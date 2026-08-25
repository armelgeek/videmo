"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SendIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { VideoGenerationRequest, GenerationProgress } from "@/lib/video-generation/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "params" | "confirm" | "progress";
  data?: any;
};

const FORMATS = ["explainer", "brief"] as const;
const STYLES = [
  "watercolor", "anime", "retro", "whiteboard", "classic", "cinematic",
  "isometric", "flat", "comic", "neon", "oil", "sketch", "papercut", "popart",
  "storybook", "pixel", "minimalist", "infographic", "documentary", "gothic",
  "pastel", "3b1b", "corporate", "presentation", "tech",
] as const;
const ASPECT_RATIOS = ["16:9", "9:16"] as const;
const LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl",
  "cs", "ar", "zh", "ja", "ko", "hi",
] as const;

export function VideoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [params, setParams] = useState<Partial<VideoGenerationRequest>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll progress
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/video/status/${jobId}`);
        if (!response.ok) throw new Error("Failed to fetch progress");
        const data = await response.json();
        setProgress(data.progress);

        if (
          data.progress.status === "completed" ||
          data.progress.status === "error"
        ) {
          clearInterval(interval);
          addMessage({
            role: "assistant",
            content:
              data.progress.status === "completed"
                ? "✓ Your video is ready! Download it below."
                : "✗ Generation failed: " + (data.progress.error || "Unknown error"),
            type: "progress",
            data: data.progress,
          });
        }
      } catch (error) {
        console.error("Progress polling error:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  const addMessage = (msg: Omit<ChatMessage, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now().toString() }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    addMessage({ role: "user", content: input, type: "text" });
    setInput("");
    setIsLoading(true);

    try {
      // First time - extract and confirm params
      if (Object.keys(params).length === 0) {
        // Parse user input to extract content
        const newParams = { content: input };
        setParams(newParams);

        addMessage({
          role: "assistant",
          content: "Great! I'll help you create this video. Let me gather a few details...",
          type: "text",
        });

        // Ask for format
        setTimeout(() => {
          addMessage({
            role: "assistant",
            content: "What format would you like?",
            type: "params",
            data: {
              field: "format",
              options: FORMATS,
              current: "explainer",
            },
          });
        }, 300);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process request"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleParamSelect = (field: string, value: string) => {
    const newParams = { ...params, [field]: value };
    setParams(newParams);

    // Add confirmation message
    addMessage({
      role: "user",
      content: `${field}: ${value}`,
      type: "text",
    });

    // Get next parameter or confirm
    const nextStep = getNextParameter(newParams);
    if (nextStep) {
      setTimeout(() => {
        addMessage({
          role: "assistant",
          content: `Now, ${nextStep.question}`,
          type: "params",
          data: {
            field: nextStep.field,
            options: nextStep.options,
            current: newParams[nextStep.field as keyof VideoGenerationRequest],
          },
        });
      }, 300);
    } else {
      // All params collected - show confirmation
      setTimeout(() => {
        showConfirmation(newParams as VideoGenerationRequest);
      }, 300);
    }
  };

  const getNextParameter = (
    currentParams: Partial<VideoGenerationRequest>
  ) => {
    if (!currentParams.format) {
      return { field: "format", question: "What format would you like?", options: FORMATS };
    }
    if (!currentParams.style) {
      return { field: "style", question: "Which visual style?", options: STYLES };
    }
    if (!currentParams.aspectRatio) {
      return { field: "aspectRatio", question: "Choose an aspect ratio (16:9 widescreen or 9:16 vertical)?", options: ASPECT_RATIOS };
    }
    if (!currentParams.language) {
      return { field: "language", question: "What language for narration?", options: LANGUAGES };
    }
    return null;
  };

  const showConfirmation = (finalParams: VideoGenerationRequest) => {
    addMessage({
      role: "assistant",
      content: "Perfect! Here's what I'll create:",
      type: "confirm",
      data: finalParams,
    });
  };

  const handleConfirmGenerate = async () => {
    if (!params.content || !params.format || !params.style || !params.aspectRatio || !params.language) {
      toast.error("Please complete all parameters");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: params.content,
          format: params.format,
          style: params.style,
          aspectRatio: params.aspectRatio,
          language: params.language,
        } as VideoGenerationRequest),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate video");
      }

      const data = await response.json();
      setJobId(data.jobId);

      addMessage({
        role: "assistant",
        content: "🎬 Starting video generation... I'll keep you updated!",
        type: "progress",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-4 max-w-md">
              <h2 className="text-2xl font-bold">Create Your Video</h2>
              <p className="text-muted-foreground">
                Describe what you want to create and I'll guide you through the process
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-md rounded-lg p-4 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.type === "text" && <p>{msg.content}</p>}

              {msg.type === "params" && msg.data && (
                <div className="space-y-2">
                  <p className="font-medium">{msg.content}</p>
                  <div className="grid gap-2">
                    {msg.data.options.map((opt: string) => (
                      <Button
                        key={opt}
                        variant={msg.data.current === opt ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleParamSelect(msg.data.field, opt)}
                        className="justify-start"
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {msg.type === "confirm" && msg.data && (
                <div className="space-y-3">
                  <p className="font-medium mb-2">{msg.content}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Format:</span>
                      <Badge>{msg.data.format}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Style:</span>
                      <Badge variant="secondary">{msg.data.style}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aspect Ratio:</span>
                      <Badge variant="secondary">{msg.data.aspectRatio}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Language:</span>
                      <Badge variant="secondary">{msg.data.language?.toUpperCase()}</Badge>
                    </div>
                  </div>
                  <Button
                    onClick={handleConfirmGenerate}
                    className="w-full mt-4"
                    disabled={isLoading}
                  >
                    {isLoading ? "Starting..." : "✨ Generate Video"}
                  </Button>
                </div>
              )}

              {msg.type === "progress" && msg.data && (
                <div className="space-y-2">
                  <p>{msg.content}</p>
                  {msg.data.progress !== undefined && (
                    <>
                      <Progress value={msg.data.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {msg.data.stage} ({Math.round(msg.data.progress)}%)
                      </p>
                    </>
                  )}
                  {msg.data.status === "completed" && msg.data.videoUrl && (
                    <div className="mt-4 space-y-2">
                      <video
                        src={msg.data.videoUrl}
                        controls
                        className="w-full rounded-lg bg-black"
                      />
                      <Button variant="outline" size="sm" className="w-full">
                        ⬇️ Download
                      </Button>
                    </div>
                  )}
                  {msg.data.status === "error" && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {msg.data.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!jobId && (
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder={
                messages.length === 0
                  ? "What would you like to create? (e.g., 'A 2-minute video about AI')"
                  : "Enter your choice..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <SendIcon className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
