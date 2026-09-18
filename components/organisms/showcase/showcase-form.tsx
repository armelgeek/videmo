"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createShowcaseVideo, updateShowcaseVideo } from "@/actions/showcase/manage-showcase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ShowcaseVideoDto } from "@/lib/showcase/schema";
import { SHOWCASE_SECTORS, SHOWCASE_SECTOR_IDS } from "@/lib/showcase/sectors";

type Form = {
  title: string;
  description: string;
  sector: string;
  customer: string;
  videoUrl: string;
  posterUrl: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationSec: string;
  sortOrder: string;
  published: boolean;
};

const fromVideo = (v?: ShowcaseVideoDto): Form => ({
  title: v?.title ?? "",
  description: v?.description ?? "",
  sector: v?.sector ?? "",
  customer: v?.customer ?? "",
  videoUrl: v?.videoUrl ?? "",
  posterUrl: v?.posterUrl ?? "",
  aspectRatio: (v?.aspectRatio as Form["aspectRatio"]) ?? "16:9",
  durationSec: v?.durationSec ? String(v.durationSec) : "",
  sortOrder: String(v?.sortOrder ?? 0),
  published: v?.published ?? false,
});

function UploadButton({ accept, label, onUploaded }: { accept: string; label: string; onUploaded: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/showcase/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded(data.url);
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {label}
      </Button>
    </>
  );
}

export function ShowcaseForm({ video }: { video?: ShowcaseVideoDto }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => fromVideo(video));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      durationSec: form.durationSec ? Number(form.durationSec) : undefined,
      sortOrder: Number(form.sortOrder || 0),
    };
    const result = video ? await updateShowcaseVideo(video.id, payload) : await createShowcaseVideo(payload);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(video ? "Video updated" : "Video added");
    router.push("/showcase");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Video</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="sc-video">Video file URL</Label>
            <div className="flex gap-2">
              <Input
                id="sc-video"
                value={form.videoUrl}
                onChange={(e) => set("videoUrl", e.target.value)}
                placeholder="https://…/video.mp4"
                required
              />
              <UploadButton accept="video/mp4,video/webm" label="Upload" onUploaded={(url) => set("videoUrl", url)} />
            </div>
            <p className="text-xs text-muted-foreground">MP4 or WebM, 200 MB max. A real export made with the product.</p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="sc-poster">Poster image URL</Label>
            <div className="flex gap-2">
              <Input
                id="sc-poster"
                value={form.posterUrl}
                onChange={(e) => set("posterUrl", e.target.value)}
                placeholder="https://…/poster.jpg"
              />
              <UploadButton accept="image/jpeg,image/png,image/webp" label="Upload" onUploaded={(url) => set("posterUrl", url)} />
            </div>
            <p className="text-xs text-muted-foreground">Optional. Shown before the video plays.</p>
          </div>

          <div className="grid gap-2">
            <Label>Format</Label>
            <Select value={form.aspectRatio} onValueChange={(v) => set("aspectRatio", v as Form["aspectRatio"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 landscape</SelectItem>
                <SelectItem value="9:16">9:16 vertical</SelectItem>
                <SelectItem value="1:1">1:1 square</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sc-duration">Duration (seconds)</Label>
            <Input
              id="sc-duration"
              type="number"
              min={1}
              value={form.durationSec}
              onChange={(e) => set("durationSec", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="sc-title">Title</Label>
            <Input id="sc-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={160} required />
          </div>

          <div className="grid gap-2">
            <Label>Sector</Label>
            <Select value={form.sector} onValueChange={(v) => set("sector", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a sector" />
              </SelectTrigger>
              <SelectContent>
                {SHOWCASE_SECTOR_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {SHOWCASE_SECTORS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sc-customer">Customer</Label>
            <Input id="sc-customer" value={form.customer} onChange={(e) => set("customer", e.target.value)} maxLength={120} />
            <p className="text-xs text-muted-foreground">Only with the customer&apos;s permission to show their name.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sc-order">Display order</Label>
            <Input
              id="sc-order"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Lower numbers show first.</p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="sc-desc">Description</Label>
            <Textarea
              id="sc-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={400}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <Switch id="sc-published" checked={form.published} onCheckedChange={(v) => set("published", v)} />
            <Label htmlFor="sc-published">Published on the landing page</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/showcase")}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !form.sector}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {video ? "Save changes" : "Add video"}
        </Button>
      </div>
    </form>
  );
}
