import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await prisma.blog.findMany({
    where: { published: true },
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 50,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      createdAt: true,
      publishedAt: true,
      author: { select: { name: true } },
    },
  });

  const feedUrl = `${appConfig.url}/feed.xml`;
  const latest = posts[0];
  const lastBuildDate = (latest?.publishedAt ?? latest?.createdAt ?? new Date()).toUTCString();

  const items = posts
    .map((post) => {
      const url = `${appConfig.url}/blog/${post.slug}`;
      const date = (post.publishedAt ?? post.createdAt).toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${date}</pubDate>
      <dc:creator>${escapeXml(post.author?.name || "Editorial Team")}</dc:creator>
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(appConfig.name)} Blog</title>
    <link>${escapeXml(`${appConfig.url}/blog`)}</link>
    <description>${escapeXml(appConfig.description)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
