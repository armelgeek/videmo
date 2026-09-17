import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/organisms/header/header";
import { Footer } from "@/components/organisms/footer/footer";
import { BlogList } from "@/components/molecules/blog/blog-list";
import { HandArrow } from "@/components/organisms/landing/sketch/hand-arrow";
import { auth } from "@/lib/auth";
import { isUserAdmin } from "@/lib/auth-utils";
import { buildMetadata } from "@/lib/seo";

import "@/components/organisms/landing/sketch/sketch.css";
import "./blog.css";

export const dynamic = "force-dynamic";

const baseMetadata = buildMetadata({
  title: "Blog — Tutorials, Insights & Case Studies",
  description:
    "Explore guides, product updates, and expert tips on video creation, AI storytelling, and marketing best practices.",
  path: "/blog",
  keywords: ["blog", "articles", "video creation", "whiteboard animation", "tutorials", "guides"],
});

export const metadata = {
  ...baseMetadata,
  alternates: {
    ...baseMetadata.alternates,
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "Blog RSS feed" }],
    },
  },
};

const PAGE_SIZE = 9;

interface BlogPageProps {
  searchParams: Promise<{ page?: string; q?: string; tag?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const activeTag = params.tag?.trim() || null;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const where = {
    published: true,
    ...(activeTag ? { tags: { has: activeTag } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { excerpt: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [session, total, posts, tagRows] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    prisma.blog.count({ where }),
    prisma.blog.findMany({
      where,
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        createdAt: true,
        publishedAt: true,
        tags: true,
        author: {
          select: { name: true },
        },
      },
    }),
    prisma.blog.findMany({
      where: { published: true },
      select: { tags: true },
    }),
  ]);

  const allTags = [...new Set(tagRows.flatMap((row) => row.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isAdmin = await isUserAdmin(session?.user?.id);

  return (
    <div className="sketch flex min-h-screen flex-col">
      <Header user={session?.user} isAdmin={isAdmin} />

      <main className="flex-1 blog-page">
        <div className="sk-wrap">
          {/* Hero Section */}
          <section className="blog-hero">
            <span className="sk-eyebrow">Stories & Tutorials</span>
            <h1 className="font-display font-extrabold tracking-tight">
              Hand-drawn notes & <span className="sk-hl">insights.</span>
            </h1>
            <p className="blog-hero-lede">
              Practical advice on scriptwriting, visual storytelling, whiteboard animations, and growing your audience.
            </p>
            <div className="blog-hero-badge sk-hand" aria-hidden="true">
              <span>fresh ideas scene by scene</span>
              <HandArrow variant="curve-right" className="blog-hero-arrow" />
            </div>
          </section>

          {/* Interactive Search + Articles Grid */}
          <BlogList
            posts={posts}
            allTags={allTags}
            activeTag={activeTag}
            query={query}
            page={page}
            totalPages={totalPages}
            total={total}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
