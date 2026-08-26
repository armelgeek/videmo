"use client";

import type React from "react";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Wand2,
  Check,
  RefreshCw,
  Upload,
  Pencil,
  Sparkles,
  Film,
} from "lucide-react";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_STORYBOARD } from "@/lib/demo-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoryboardOutline {
  index: number;
  clipType: "intro" | "content" | "outro";
  title: string;
  summary: string;
}

interface StoryboardData {
  title: string;
  narrativeFlow: string;
  narrativeStyle: string;
  clipOutlines: StoryboardOutline[];
}

interface MasterGeneratorProps {
  onGenerate: (
    storyboard: StoryboardData,
    content: string,
    params: GeneratorParams,
  ) => void;
  onLoadDemo?: () => void;
}

interface GeneratorParams {
  style: string;
  format: "brief" | "explainer";
  aspectRatio: "16:9" | "9:16";
  language: string;
}

export function MasterGenerator({
  onGenerate,
  onLoadDemo,
}: MasterGeneratorProps) {
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStoryboard, setGeneratedStoryboard] =
    useState<StoryboardData | null>(null);
  const [params, setParams] = useState<GeneratorParams>({
    style: "cinematic",
    format: "explainer",
    aspectRatio: "16:9",
    language: "en",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!content.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          style: params.style,
          format: params.format,
          aspectRatio: params.aspectRatio,
          language: params.language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate storyboard");
      }

      const data = await response.json();
      setGeneratedStoryboard(data.storyboard);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = () => {
    if (generatedStoryboard) {
      onGenerate(generatedStoryboard, content, params);
    }
  };

  const handleReset = () => {
    setGeneratedStoryboard(null);
  };

  const handleLoadDemo = () => {
    // Demo storyboard structure
    const demoStoryboard: StoryboardData = {
      title: "A Culinary Journey Through Ratatouille",
      narrativeFlow:
        "Introduction to the dish → Historical origins → Key ingredients → Preparation technique → Final presentation",
      narrativeStyle: "Warm, educational, and inviting",
      clipOutlines: [
        {
          index: 0,
          clipType: "intro",
          title: "Welcome to Ratatouille",
          summary:
            "Introduction to this classic French dish with beautiful plating",
        },
        {
          index: 1,
          clipType: "content",
          title: "A Provençal Classic",
          summary:
            "Explore the origins and cultural significance of ratatouille",
        },
        {
          index: 2,
          clipType: "content",
          title: "Essential Ingredients",
          summary:
            "Meet the fresh vegetables and herbs that make this dish special",
        },
        {
          index: 3,
          clipType: "content",
          title: "The Art of Preparation",
          summary: "Master the technique of layering and seasoning",
        },
        {
          index: 4,
          clipType: "content",
          title: "Bringing It Together",
          summary: "Watch as the dish comes to life in the oven",
        },
        {
          index: 5,
          clipType: "outro",
          title: "Bon Appétit",
          summary:
            "The finished masterpiece ready to be enjoyed with friends and family",
        },
      ],
    };

    setGeneratedStoryboard(demoStoryboard);
    setContent("A classic French dish of layered vegetables with herbs...");
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-section-title tracking-tight">
          Generate Storyboard
        </h2>
        <p className="text-body">
          Configure your parameters and describe your content to generate a
          storyboard script.
        </p>
      </div>

      {!generatedStoryboard && (
        <div className="flex justify-center mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadDemo}
            className="border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] bg-transparent"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Load Demo (Ratatouille Example)
          </Button>
        </div>
      )}

      <Card className="p-6 bg-[var(--surface-2)] border-[var(--border-default)] space-y-6">
        {!generatedStoryboard ? (
          <div className="space-y-6">
            {/* Parameters Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="style">Visual Style</Label>
                <Select value={params.style} onValueChange={(value) => setParams({ ...params, style: value })}>
                  <SelectTrigger id="style" className="bg-[var(--surface-3)] border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                    <SelectItem value="retro">Retro</SelectItem>
                    <SelectItem value="whiteboard">Whiteboard</SelectItem>
                    <SelectItem value="isometric">Isometric</SelectItem>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="documentary">Documentary</SelectItem>
                    <SelectItem value="minimalist">Minimalist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select
                  value={params.format}
                  onValueChange={(value: any) => setParams({ ...params, format: value })}
                >
                  <SelectTrigger id="format" className="bg-[var(--surface-3)] border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief (6-15 clips)</SelectItem>
                    <SelectItem value="explainer">Explainer (10-15 clips)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aspect">Aspect Ratio</Label>
                <Select
                  value={params.aspectRatio}
                  onValueChange={(value: any) => setParams({ ...params, aspectRatio: value })}
                >
                  <SelectTrigger id="aspect" className="bg-[var(--surface-3)] border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={params.language} onValueChange={(value) => setParams({ ...params, language: value })}>
                  <SelectTrigger id="language" className="bg-[var(--surface-3)] border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="it">Italiano</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content Section */}
            <div className="space-y-2">
              <Label htmlFor="content">Content / Prompt</Label>
              <Textarea
                id="content"
                placeholder="Describe the content you want to create a storyboard for. Include key topics, narrative flow, and any specific requirements..."
                className="min-h-[150px] bg-[var(--surface-3)] border-[var(--border-default)] resize-none text-base"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!content.trim() || isGenerating}
              className="w-full h-12 text-lg font-medium bg-[var(--tertiary)] hover:bg-[var(--tertiary-hover)] text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Storyboard...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Generate Storyboard
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Storyboard Display */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {generatedStoryboard.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {generatedStoryboard.narrativeFlow}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Style: <span className="font-medium">{generatedStoryboard.narrativeStyle}</span>
                </p>
              </div>

              {/* Clips Outline */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Clip Outline</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {generatedStoryboard.clipOutlines.map((clip) => (
                    <div
                      key={clip.index}
                      className="p-3 rounded-lg bg-[var(--surface-3)] border border-[var(--border-default)] space-y-1"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                          {clip.index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-foreground">
                              {clip.title}
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                              {clip.clipType}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {clip.summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 h-12 text-lg border-[var(--border-emphasis)] hover:bg-[var(--hover-overlay)] hover:border-[var(--border-strong)] bg-transparent"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Generate New
              </Button>

              <Button
                onClick={handleApprove}
                className="flex-1 h-12 text-lg bg-[var(--tertiary)] hover:bg-[var(--tertiary-hover)] text-white"
              >
                <Check className="mr-2 h-5 w-5" />
                Approve & Continue
              </Button>
            </div>
            <p className="text-xs text-center text-[var(--text-muted)]">
              Approving will proceed to the next step to generate visuals for
              each clip.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
