"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { VideoGenerationRequest, GenerationProgress } from "@/lib/video-generation/types";

const FORMATS = ["explainer", "brief"] as const;
const STYLES = [
  "watercolor",
  "anime",
  "retro",
  "whiteboard",
  "classic",
  "cinematic",
  "isometric",
  "flat",
  "comic",
  "neon",
  "oil",
  "sketch",
  "papercut",
  "popart",
  "storybook",
  "pixel",
  "minimalist",
  "infographic",
  "documentary",
  "gothic",
  "pastel",
  "3b1b",
  "corporate",
  "presentation",
  "tech",
] as const;

const ASPECT_RATIOS = ["16:9", "9:16"] as const;
const LANGUAGES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "pl",
  "tr",
  "ru",
  "nl",
  "cs",
  "ar",
  "zh",
  "ja",
  "ko",
  "hi",
] as const;

export function VideoGenerator() {
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"explainer" | "brief">("explainer");
  const [style, setStyle] = useState("anime");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [language, setLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error("Please enter content for the video");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          format,
          style,
          aspectRatio,
          language,
        } as VideoGenerationRequest),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate video");
      }

      const data = await response.json();
      setJobId(data.jobId);
      toast.success("Video generation started!");

      // Start polling for progress
      pollProgress(data.jobId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start generation"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const pollProgress = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/video/status/${id}`);
        if (!response.ok) throw new Error("Failed to fetch progress");

        const data = await response.json();
        setProgress(data.progress);

        if (
          data.progress.status === "completed" ||
          data.progress.status === "error"
        ) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Progress polling error:", error);
        clearInterval(interval);
      }
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Video</CardTitle>
          <CardDescription>
            Generate a video from your content with AI-powered narration and visuals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Content */}
          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Enter the text content for your video..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-24"
              disabled={isLoading || !!progress}
            />
          </div>

          {/* Settings Grid */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Format */}
            <div className="grid gap-2">
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {format === "explainer"
                  ? "Detailed explanatory video (longer)"
                  : "Quick brief format (shorter)"}
              </p>
            </div>

            {/* Style */}
            <div className="grid gap-2">
              <Label htmlFor="style">Visual Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger id="style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Aspect Ratio */}
            <div className="grid gap-2">
              <Label htmlFor="aspectRatio">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger id="aspectRatio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ar) => (
                    <SelectItem key={ar} value={ar}>
                      {ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {aspectRatio === "16:9" ? "Widescreen" : "Vertical/Mobile"}
              </p>
            </div>

            {/* Language */}
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || !content.trim()}
            size="lg"
            className="w-full"
          >
            {isLoading ? "Starting..." : "Generate Video"}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.stage || "Processing..."}</span>
                <span>{Math.round(progress.progress || 0)}%</span>
              </div>
              <Progress value={progress.progress || 0} />
            </div>

            {/* Clips Preview */}
            {progress.clips && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Clips</h4>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
                  {progress.clips.map((clip) => (
                    <div
                      key={clip.index}
                      className="border rounded-lg overflow-hidden"
                    >
                      {clip.imageUrl ? (
                        <img
                          src={clip.imageUrl}
                          alt={clip.title}
                          className="w-full h-24 object-cover bg-muted"
                        />
                      ) : (
                        <div className="w-full h-24 bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            {clip.status === "pending" ? "Pending" : "Generating..."}
                          </span>
                        </div>
                      )}
                      <div className="p-2">
                        <p className="font-medium text-xs">{clip.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Output */}
            {progress.status === "completed" && progress.videoUrl && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Your Video</h4>
                <video
                  src={progress.videoUrl}
                  controls
                  className="w-full rounded-lg bg-black"
                />
                <Button variant="outline" className="w-full" asChild>
                  <a href={progress.videoUrl} download>
                    Download Video
                  </a>
                </Button>
              </div>
            )}

            {/* Error */}
            {progress.status === "error" && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {progress.error || "Generation failed"}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
