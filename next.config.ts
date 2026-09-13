import type { NextConfig } from "next";

/**
 * L'origine du bac d'objets, telle que le navigateur la voit.
 *
 * Elle doit etre nommee : les visuels et la voix sont servis depuis la, et la
 * regle par defaut n'autorise que `https:`. Un bac local en http — MinIO en
 * developpement — faisait donc echouer `next/image` (« Invalid src prop »),
 * mais aussi la lecture de l'image par le canvas, dont la mesure des sujets
 * dessines depend. On ouvre cette origine-la, pas `http:` en general.
 */
function bucketOrigin(): URL | null {
  const raw = process.env.S3_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const bucket = bucketOrigin();
const bucketSource = bucket ? ` ${bucket.origin}` : "";

const nextConfig: NextConfig = {
  output: "standalone",
  // canvas est un binaire natif et fluent-ffmpeg pilote un binaire externe :
  // ni l'un ni l'autre ne survit a un passage par le bundler. jsdom charge ses
  // modules dynamiquement, ce que le bundler ne sait pas suivre non plus.
  serverExternalPackages: ["canvas", "fluent-ffmpeg", "jsdom"],
  // Le worker de rendu est lance par spawn, donc AUCUN import ne le designe :
  // le traceur de Next ne le voit pas et output:"standalone" ne le copierait
  // pas. Il faut donc l'inclure explicitement, avec le moteur qu'il charge et
  // les images de mains qu'il dessine.
  outputFileTracingIncludes: {
    "/api/whiteboard/render": [
      "./lib/whiteboard-animation/server/**",
      "./lib/whiteboard-animation/lib/**",
      "./public/images/**",
    ],
  },
  async headers() {
    return [
      {
        // Hand sprites and other static artwork: their names carry no version,
        // so no immutable — a day fresh, then revalidated in the background.
        // Without it every editor open revalidated each sprite.
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://us-assets.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' blob: data: https:${bucketSource}`,
              `media-src 'self' blob: data: https:${bucketSource}`,
              "font-src 'self' data:",
              `connect-src 'self' blob: data: https:${bucketSource}`,
              // Sans worker-src, la regle retombe sur script-src, qui refuse
              // blob: — or le bundler lance les Web Workers depuis un blob.
              // La preparation des illustrations echouait donc sans message.
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    // Next 16 refuse toute image dont l'hote resout vers une IP privee
    // (protection SSRF, image-optimizer.js) — et rend EXACTEMENT la meme
    // erreur qu'un domaine non autorise, « "url" parameter is not allowed »,
    // ce qui fait chercher du cote des remotePatterns alors qu'ils
    // correspondent. Le bac de developpement etant sur localhost, aucun visuel
    // ne s'affichait a l'etape Storyboard.
    //
    // La levee ne vaut que pour un bac en http — MinIO en local. Un bac https,
    // donc la production, garde la protection : elle est globale, elle ne se
    // restreint pas a une origine.
    dangerouslyAllowLocalIP: bucket?.protocol === "http:",
    // Seul le bac est optimise. `hostname: "**"` faisait de l'optimiseur un
    // proxy ouvert : n'importe qui pouvait faire redimensionner, a nos frais,
    // les images de n'importe quel site. Un autre hote se declare dans
    // IMAGE_REMOTE_HOSTS (liste separee par des virgules).
    remotePatterns: [
      ...(bucket && bucket.protocol === "https:"
        ? [{ protocol: "https" as const, hostname: bucket.hostname }]
        : []),
      ...(process.env.IMAGE_REMOTE_HOSTS ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((hostname) => ({ protocol: "https" as const, hostname })),
      ...(bucket && bucket.protocol === "http:"
        ? [
            {
              protocol: "http" as const,
              hostname: bucket.hostname,
              port: bucket.port,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
