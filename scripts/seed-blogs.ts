import "dotenv/config";
import { prisma } from "../lib/prisma";

const SAMPLE_POSTS = [
  {
    title: "From Script to Whiteboard: How Hand-Drawn Videos Boost Conversion Rates",
    slug: "script-to-whiteboard-boost-conversion",
    excerpt:
      "Why hand-drawn whiteboard animations hold viewer attention 3x longer than standard talking-head videos, and how to structure your script for maximum impact.",
    tags: ["marketing", "whiteboard", "conversion", "growth"],
    coverImage: "/demos/styles/outlinefill.webp",
    content: `
      <h2>The Cognitive Science Behind Whiteboard Animations</h2>
      <p>Ever wondered why the human brain gets instantly hooked when a hand draws an illustration on a blank canvas? In psychology, this is known as <strong>anticipatory engagement</strong>. When viewers see a pen moving, their brains constantly predict what shape will appear next, creating an active state of attention rather than passive consumption.</p>
      
      <blockquote>
        "Viewers retain up to 15% more information from a whiteboard video compared to standard presentation slides or talking heads."
      </blockquote>

      <h2>3 Key Rules for High-Converting Scripts</h2>
      <p>A great animation can't save a boring script. Here are the principles top-performing marketing teams follow:</p>
      <ul>
        <li><strong>Hook within 5 seconds:</strong> State the painful status quo immediately before introducing features.</li>
        <li><strong>One central metaphor per scene:</strong> Avoid cluttering a single scene with more than two visual concepts.</li>
        <li><strong>Clear visual payoff:</strong> Let the drawing resolve exactly when the narrator reveals the solution.</li>
      </ul>

      <h2>Conclusion</h2>
      <p>Turning dry documentation or SaaS features into an animated journey makes your value proposition memorable. Start with a 60-second draft and watch your retention metrics climb.</p>
    `,
  },
  {
    title: "The 60-Second Explainer Formula: Scene-by-Scene Breakdown",
    slug: "60-second-explainer-formula",
    excerpt:
      "How to craft a high-impact SaaS pitch in under a minute without corporate jargon, bloated intros, or losing your viewer's momentum.",
    tags: ["storyboard", "saas", "copywriting", "tutorial"],
    coverImage: "/demos/styles/chunkjump.webp",
    content: `
      <h2>Why 60 Seconds is the Sweet Spot</h2>
      <p>Attention spans are scarce. On landing pages and social platforms, user engagement drops sharply after the 60-to-90 second mark. Condensing your product into one minute forces clarity and eliminates fluff.</p>

      <h2>The 4-Part Storyboard Template</h2>
      <ol>
        <li><strong>Scene 1 (0–12s) — The Villain:</strong> The friction your prospect faces right now.</li>
        <li><strong>Scene 2 (12–28s) — The Shift:</strong> The breakthrough approach that replaces the old manual way.</li>
        <li><strong>Scene 3 (28–48s) — The Proof:</strong> 2 or 3 snappy scenes showing your product in action.</li>
        <li><strong>Scene 4 (48–60s) — The Call to Action:</strong> A crystal-clear next step with zero hesitation.</li>
      </ol>

      <p>Practice reading your script at 130 words per minute. That gives you roughly 120–140 words total—every single syllable must earn its place.</p>
    `,
  },
  {
    title: "Synchronized Voiceovers: Why Word-by-Word Timing Matters",
    slug: "synchronized-voiceover-timing-matters",
    excerpt:
      "Audio-visual harmony is the secret behind captivating animations. Discover how auto-syncing speech and drawing creates effortless comprehension.",
    tags: ["audio", "animation", "ai", "sync"],
    coverImage: "/demos/styles/contour.webp",
    content: `
      <h2>The Dissonance Problem</h2>
      <p>Have you ever watched an educational video where the illustration finished drawing three seconds before the speaker mentioned it? Or worse, the hand was still scribbling while the narration had already moved to the next topic? This cognitive mismatch breaks immersion.</p>

      <h2>Word-by-Word Timestamp Alignment</h2>
      <p>Modern AI transcription generates word-level timestamps with millisecond accuracy. By binding the SVG stroke interpolation directly to phoneme boundaries, the pen arrives at the exclamation point at the exact moment the speaker's voice reaches its crescendo.</p>

      <p>Whether you upload a custom human recording or leverage realistic synthetic voices, synchronized timing turns good animatics into cinema-grade presentations.</p>
    `,
  },
  {
    title: "Multi-Format Distribution: Repurposing 16:9 for Shorts, Reels & TikTok",
    slug: "repurposing-videos-for-vertical-reels-tiktok",
    excerpt:
      "Never pay twice or spend hours cropping keyframes. How to transform your landscape explainer into punchy 9:16 vertical clips seamlessly.",
    tags: ["growth", "reels", "social-media", "distribution"],
    coverImage: "/demos/styles/scanner.webp",
    content: `
      <h2>One Script, Three Canvas Ratios</h2>
      <p>Your YouTube audience expects 16:9 widescreen. Your LinkedIn followers scroll 1:1 square feeds. Your TikTok and Instagram Reels audiences demand full-height 9:16 vertical immersion. Re-animating each format manually used to mean 3x production costs.</p>

      <h2>The Smart Framing Approach</h2>
      <p>By centering the active focal point and utilizing responsive whiteboard boundaries, each scene can dynamically reflow without truncating critical drawings or subtitles.</p>
      <ul>
        <li>Keep text captions in the safe vertical zone (middle 60%).</li>
        <li>Let background accents expand naturally into the canvas edges.</li>
        <li>Export all three formats directly from a single project timeline.</li>
      </ul>
    `,
  },
  {
    title: "Collaborative Video Creation: Streamlining Team Reviews Without Chaos",
    slug: "collaborative-video-creation-team-workspaces",
    excerpt:
      "Say goodbye to passing around heavy MP4 files and confusing revision notes. How shared workspaces, roles, and edit locks keep teams aligned.",
    tags: ["teams", "productivity", "workflow", "management"],
    coverImage: "/demos/styles/illustfill.webp",
    content: `
      <h2>The Agency vs In-House Bottleneck</h2>
      <p>We've all lived through the "final_v2_edit_FINAL_really.mp4" nightmare. Client feedback scattered across Slack, email threads, and Notion pages creates missed deadlines and frustration.</p>

      <h2>Modern Whiteboard Collaboration</h2>
      <p>Bringing team members and clients into dedicated workspaces with role-based permissions (Owner, Admin, Member) changes the game. With real-time edit locks, teammates can preview ongoing animations without risking accidental overwrites.</p>
      <p>When feedback happens scene by scene right where the drawings are rendered, turnaround times drop from three weeks to three hours.</p>
    `,
  },
];

async function main() {
  console.log("🌱 Starting blog seed with cover images...");

  // 1. Find or create an author user
  let author = await prisma.user.findFirst();

  if (!author) {
    console.log("No user found. Creating a default editorial author...");
    author = await prisma.user.create({
      data: {
        name: "Videmo Editorial",
        email: "editorial@videmo.app",
        isAdmin: true,
      },
    });
  }

  console.log(`Using author: ${author.name || author.email} (${author.id})`);

  // 2. Upsert posts
  for (const post of SAMPLE_POSTS) {
    const upserted = await prisma.blog.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        coverImage: post.coverImage,
        published: true,
        publishedAt: new Date(),
        authorId: author.id,
      },
      create: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        coverImage: post.coverImage,
        published: true,
        publishedAt: new Date(),
        authorId: author.id,
      },
    });

    console.log(`✓ Upserted blog with image: "${upserted.title}" (slug: /blog/${upserted.slug})`);
  }

  const total = await prisma.blog.count();
  console.log(`\n🎉 Seed completed! Total published blogs in database: ${total}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding blogs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
