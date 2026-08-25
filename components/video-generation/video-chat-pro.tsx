"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SendIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { GenerationProgress } from "@/lib/video-generation/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayContent?: string;
  params?: Record<string, string>;
  isThinking?: boolean;
  options?: string[];
};

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

export function VideoChatPro() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing effect for assistant messages
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || lastMsg.isThinking || lastMsg.displayContent === lastMsg.content) {
      return;
    }

    const nextIndex = (lastMsg.displayContent?.length ?? 0) + 1;
    typingTimeoutRef.current = setTimeout(() => {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.role === "assistant" && lastMessage.content) {
          lastMessage.displayContent = lastMessage.content.slice(0, nextIndex);
        }
        return updated;
      });
    }, 20);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
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
          const finalContent =
            data.progress.status === "completed"
              ? "✨ Your video is ready! Here it is:"
              : "❌ Generation failed: " + (data.progress.error || "Unknown error");
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: finalContent,
              displayContent: finalContent,
            },
          ]);
        }
      } catch (error) {
        console.error("Progress polling error:", error);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [jobId]);

  const addMessage = (msg: Omit<Message, "id">) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: Date.now().toString(),
        displayContent: msg.role === "user" ? msg.content : "",
      },
    ]);
  };

  const handleOptionClick = async (option: string) => {
    addMessage({ role: "user", content: option });
    setIsLoading(true);

    try {
      await streamResponse(option);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const streamResponse = async (userMessage: string) => {
    const thinkingMarker = `__thinking_${Date.now()}__`;
    setMessages((prev) => [
      ...prev,
      {
        id: thinkingMarker,
        role: "assistant" as const,
        content: "",
        displayContent: "",
        isThinking: true,
      },
    ]);

    try {
      const response = await fetch("/api/video/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const data = await response.json();

      // Remove thinking message and add real response
      setMessages((prev) => prev.filter((m) => m.id !== thinkingMarker));

      if (data.complete) {
        // All params collected - generate video
        addMessage({
          role: "assistant",
          content: `Perfect! I'm creating your ${data.params.format} video in ${data.params.style} style...`,
          params: data.params,
        });

        // Start generation
        const genResponse = await fetch("/api/video/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.params),
        });

        if (!genResponse.ok) {
          const error = await genResponse.json();
          throw new Error(error.error || "Failed to generate video");
        }

        const genData = await genResponse.json();
        setJobId(genData.jobId);

        addMessage({
          role: "assistant",
          content: "🎬 Generating your video... This may take a few minutes.",
        });
      } else {
        // Continue conversation with options
        addMessage({
          role: "assistant",
          content: data.response,
          options: data.nextStep?.options || data.options,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process");
      setMessages((prev) => prev.filter((m) => m.id !== thinkingMarker));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    addMessage({ role: "user", content: userMsg });
    setInput("");
    setIsLoading(true);

    try {
      await streamResponse(userMsg);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4 bg-gradient-to-r from-background to-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Video Creator</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Tell me what video you want to create
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <div className="text-4xl">🎬</div>
                <h2 className="text-2xl font-bold">Create Your Video</h2>
                <p className="text-muted-foreground">
                  Describe what you want to create and I'll guide you through
                  the process step by step
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-none">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-lg p-4 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-bl-none"
                    : "bg-muted rounded-tl-none"
                }`}
              >
                {msg.isThinking ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">
                      {msg.displayContent ?? msg.content}
                      {msg.displayContent !== msg.content && (
                        <span className="animate-pulse">▌</span>
                      )}
                    </p>

                    {msg.params && (
                      <div className="mt-3 pt-3 border-t border-current/20 space-y-2">
                        <p className="text-xs font-medium opacity-70">
                          Selected:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(msg.params).map(([key, value]) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="text-xs"
                            >
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {progress && (
                      <div className="mt-3 pt-3 border-t border-current/20 space-y-2">
                        <div className="text-xs font-medium opacity-70">
                          {progress.stage}
                        </div>
                        <Progress
                          value={progress.progress || 0}
                          className="h-2"
                        />
                        <p className="text-xs opacity-70">
                          {Math.round(progress.progress || 0)}%
                        </p>

                        {progress.status === "completed" &&
                          progress.videoUrl && (
                            <video
                              src={progress.videoUrl}
                              controls
                              className="w-full rounded mt-3 bg-black"
                            />
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-none text-xs font-medium">
                  You
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Options - toujours visibles */}
      {!jobId && messages.length > 0 && (
        <div className="border-t p-4 bg-muted/50">
          <div className="max-w-4xl mx-auto space-y-2">
            {(() => {
              const lastMsg = messages[messages.length - 1];
              if (lastMsg?.role !== "assistant" || !Array.isArray(lastMsg?.options)) return null;

              const optionsToShow = lastMsg.options.slice(0, 6);
              return (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Choose an option:</p>
                  <div className="flex flex-wrap gap-2">
                    {optionsToShow.map((opt) => (
                      <Button
                        key={opt}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOptionClick(opt)}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Input */}
      {!jobId && (
        <div className="border-t p-4 bg-muted/30">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder={
                  messages.length === 0
                    ? "E.g., Create a 2-minute video about quantum computing..."
                    : "Or type your response..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SendIcon className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
