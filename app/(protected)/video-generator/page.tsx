import { VideoGenerator } from "@/components/video-generation/video-generator";

export default function VideoGeneratorPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Video Generator</h1>
        <p className="text-muted-foreground mt-2">
          Create narrated videos with AI-generated images and voice-over
        </p>
      </div>

      <VideoGenerator />
    </div>
  );
}
