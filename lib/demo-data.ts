export const DEMO_ANNOTATIONS = [
  {
    id: "title",
    text: 'Titre "Premium Image"',
    region: { x: 100, y: 75, width: 680, height: 117 },
    reveal: { durationMs: 1600, gapBeforeMs: 300 },
    style: { strokeColor: "#2563eb", fillColor: "rgba(37, 99, 235, 0.12)", strokeWidth: 2, opacity: 1 },
  },
  {
    id: "bag",
    text: "Sac à main",
    region: { x: 770, y: 230, width: 400, height: 535 },
    reveal: { durationMs: 3400, gapBeforeMs: 100 },
    style: { strokeColor: "#ef4444", fillColor: "rgba(239, 68, 68, 0.12)", strokeWidth: 2, opacity: 1 },
  },
  {
    id: "tag",
    text: "Étiquette de prix",
    region: { x: 595, y: 405, width: 204, height: 247 },
    reveal: { durationMs: 2000, gapBeforeMs: 100 },
    style: { strokeColor: "#10b981", fillColor: "rgba(16, 185, 129, 0.12)", strokeWidth: 2, opacity: 1 },
  },
  {
    id: "question",
    text: "Point d'interrogation",
    region: { x: 1170, y: 220, width: 201, height: 380 },
    reveal: { durationMs: 1400, gapBeforeMs: 100 },
    style: { strokeColor: "#a855f7", fillColor: "rgba(168, 85, 247, 0.12)", strokeWidth: 2, opacity: 1 },
  },
  {
    id: "region_5",
    text: "Zone 5",
    region: { x: 104, y: 192, width: 672, height: 101 },
    reveal: { durationMs: 2000, gapBeforeMs: 100 },
    style: { strokeColor: "#f97316", fillColor: "rgba(249, 115, 22, 0.12)", strokeWidth: 2, opacity: 1 },
  },
];

export const DEMO_STORYBOARD = {
  masterImageUrl: "/scene-premium-bag.png",
  masterDescription: 'A live-action flashback scene inspired by the "zoom out to the past" effect from Ratatouille.',
  panelCount: 9,
  panels: [
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Man in modern cafe takes first bite of tart, eyes widen slightly with surprise",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Extreme close-up of eye with swirling transition effect, colors shift to warm sepia tones",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Wide shot of rustic kitchen, young boy eating at table with grandmother preparing food in background",
      duration: 5 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Close-up of boy's joyful face, mouth full of food, warm nostalgic lighting, pure happiness",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Swirling temporal transition effect, man and boy's faces blend together, zoom effect accelerates",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Man in present day, eyes glistening with tears, emotional realization washing over his face",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Close-up of boy's messy grin, food remnants on face, capturing pure childhood joy and innocence",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Man looks down at the tart on his plate, processing the flood of memories, slow contemplative tilt",
      duration: 3 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Man takes another contemplative bite, savoring both food and memory, camera slowly pushes in",
      duration: 5 as const,
      aspectRatio: "16:9" as const,
      annotations: DEMO_ANNOTATIONS,
    },
  ],
}

export const DEMO_TRANSITION_STORYBOARD = {
  transitionImageUrl: "/scene-premium-bag.png",
  description:
    "There are 2 transition panels. For transition 1, I need the first frame to be identical to the current transition panel except no warp effect and background should still be restaurant. For transition 2, the first frame should be very similar to the last frame from transition 1.",
  panelCount: 5,
  panels: [
    {
      imageUrl: "/scene-premium-bag.png",
      label: "Transition 1 - First Frame",
      description: "Clean close-up of man's face in modern restaurant (no warp effect)",
    },
    {
      imageUrl: "/scene-premium-bag.png",
      label: "Transition 1 - Last Frame",
      description: "Boy eating in rustic kitchen with grandmother",
    },
    {
      imageUrl: "/scene-premium-bag.png",
      label: "Transition 2 - First Frame",
      description: "Boy eating in kitchen (similar angle to transition 1 last frame)",
    },
    {
      imageUrl: "/scene-premium-bag.png",
      label: "Visual Reference",
      description: "Warped overlay effect showing transition merge (for reference, not for video generation)",
    },
    {
      imageUrl: "/scene-premium-bag.png",
      label: "Transition 2 - Last Frame",
      description: "Man in present day (clean frame for transition 2 ending)",
    },
  ],
}

export const DEMO_FINAL_SEQUENCE = {
  masterDescription: 'A live-action flashback scene inspired by the "zoom out to the past" effect from Ratatouille.',
  videoConfig: {
    aspectRatio: "16:9" as const,
    useFastModel: true,
  },
  get panels() {
    return this.storyboard;
  },
  get media() {
    const list: any[] = [];
    this.storyboard.forEach((p, i) => {
      list.push({
        id: `media-video-${i}`,
        url: p.videoUrl,
        prompt: p.prompt,
        duration: p.duration,
        aspectRatio: this.videoConfig.aspectRatio,
        status: "ready" as const,
        type: "video" as const,
        resolution: { width: 1280, height: 720 },
      });
      if (p.audioUrl) {
        list.push({
          id: `media-audio-${i}`,
          url: p.audioUrl,
          prompt: `Audio: ${p.prompt}`,
          duration: p.duration,
          aspectRatio: this.videoConfig.aspectRatio,
          status: "ready" as const,
          type: "audio" as const,
          resolution: { width: 1280, height: 720 },
        });
      }
    });
    return list;
  },
  get clips() {
    const list: any[] = [];
    let startTime = 0;
    this.storyboard.forEach((p, i) => {
      list.push({
        speed: 1,
        id: `clip-${i}`,
        mediaId: `media-video-${i}`,
        trackId: "v1",
        start: startTime,
        duration: p.duration,
        offset: 0,
        transition: undefined,
      });
      if (p.audioUrl) {
        list.push({
          speed: 1,
          id: `audio-clip-${i}`,
          mediaId: `media-audio-${i}`,
          trackId: "a1",
          start: startTime,
          duration: p.duration,
          offset: 0,
          transition: undefined,
        });
      }
      startTime += p.duration;
    });
    return list;
  },
  storyboard: [
    // Panel 0 - Regular panel
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Cinematic close-up of the man eating pie, followed by a rapid, disorienting dolly-in to mid-face.",
      duration: 8 as const,
      linkedImageUrl: undefined,
      videoUrl: "https://v3b.fal.media/files/b/0a84a235/Z9sIv_PFVXLU8uDcb9Hey_output.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
    // Panel 1 - Transition (first frame: transition panel 0, last frame: main panel 2)
    {
      imageUrl: "/scene-premium-bag.png",
      linkedImageUrl: "/scene-premium-bag.png",
      prompt:
        "Extreme close-up on the man's eye, rapidly accelerating into a blurring pullback zoom that transitions cinematically into a warm flashback sequence.",
      duration: 5 as const,
      videoUrl: "https://v3b.fal.media/files/b/monkey/D_Pf7zR9bbiKaRT6twClJ.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
    // Panel 2 - Regular panel
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Wide shot of rustic kitchen, young boy eating at table with grandmother preparing food in background",
      duration: 5 as const,
      linkedImageUrl: undefined,
      videoUrl: "https://v3b.fal.media/files/b/elephant/l8BSTRj_g7f-pFOfx7siq_TPl6daj3.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
    // Panel 3 - Regular panel
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "Close-up of boy's joyful face, mouth full of food, warm nostalgic lighting, pure happiness",
      duration: 5 as const,
      linkedImageUrl: undefined,
      videoUrl: "https://v3b.fal.media/files/b/panda/evoI_qve6jM04K-AeG4dd_TV3dmkaY.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
    // Panel 4 - Transition (first frame: transition panel 2, last frame: transition panel 4)
    {
      imageUrl: "/scene-premium-bag.png",
      linkedImageUrl: "/scene-premium-bag.png",
      prompt:
        "A cinematic wide-angle of the boy and his smiling grandmother, then rapidly accelerating into a blurring pullback zoom that transitions cinematically into a warmer present-day sequence.",
      duration: 5 as const,
      videoUrl: "https://v3b.fal.media/files/b/monkey/ASI6U2FEsmr-xxQI9iAV0.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
    // Panel 5 - Regular panel
    {
      imageUrl: "/scene-premium-bag.png",
      prompt: "A cinematic close-up of the man's face at a restaurant as he recalls memories of childhood.",
      duration: 8 as const,
      linkedImageUrl: undefined,
      videoUrl: "https://v3b.fal.media/files/b/rabbit/iS5IFUBwrTgZCqEdTZJJo_output.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
    // Panel 6 - Regular panel
    {
      imageUrl: "/scene-premium-bag.png",
      prompt:
        "Man in present day taking another bite of pie, savoring the memory and the moment, camera slowly pulls back.",
      duration: 8 as const,
      linkedImageUrl: undefined,
      videoUrl: "https://v3b.fal.media/files/b/zebra/N6ZZnPbVVVpDx1ls0SjMQ_output.mp4",
      audioUrl: "/audio/test-audio-tone.mp3",
      annotations: DEMO_ANNOTATIONS,
    },
  ],
}
