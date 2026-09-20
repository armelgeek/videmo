import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/organisms/header/header";
import { Footer } from "@/components/organisms/footer/footer";
import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import { JsonLd } from "@/components/providers/json-ld";
import { articleSchema, breadcrumbSchema } from "@/lib/seo";
import { appConfig } from "@/lib/config";
import { auth } from "@/lib/auth";
import { isUserAdmin } from "@/lib/auth-utils";
import { Calendar, User as UserIcon, Clock, ArrowLeft } from "lucide-react";
import { ShareButtons } from "@/components/molecules/blog/share-buttons";

import "@/components/organisms/landing/sketch/sketch.css";
import "../blog.css";

export const dynamic = "force-dynamic";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blog.findUnique({
    where: { slug },
    select: { title: true, excerpt: true, coverImage: true, published: true },
  });

  // A draft must not leak its title into the tab or a share preview:
  // only an admin, who can preview it, sees its metadata.
  if (!post || (!post.published && !(await isUserAdmin()))) {
    return { title: "Post not found", robots: { index: false, follow: false } };
  }

  const url = `${appConfig.url}/blog/${slug}`;

  return {
    title: `${post.title} — ${appConfig.name} Blog`,
    robots: post.published ? undefined : { index: false, follow: false },
    description: post.excerpt ?? undefined,
    keywords: ["blog", "article", "explainer video", "whiteboard", slug.replace(/-/g, " ")],
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      url,
      type: "article",
      siteName: appConfig.name,
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  const [session, post] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    prisma.blog.findUnique({
      where: { slug },
      include: {
        author: { select: { name: true } },
      },
    }),
  ]);

  if (!post) notFound();

  const isAdmin = await isUserAdmin(session?.user?.id);

  // A draft stays hidden from the public: only an admin can preview it.
  if (!post.published && !isAdmin) notFound();

  // Approximate reading time (200 words/min)
  const wordCount = post.content.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const authorName = post.author?.name || "Editorial Team";
  const publishedDate = post.publishedAt ?? post.createdAt;

  const related = await prisma.blog.findMany({
    where: {
      published: true,
      id: { not: post.id },
      ...(post.tags.length > 0 ? { tags: { hasSome: post.tags } } : {}),
    },
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  return (
    <div className="sketch flex min-h-screen flex-col">
      <JsonLd
        data={[
          articleSchema({
            title: post.title,
            description: post.excerpt ?? "",
            slug: post.slug,
            authorName: authorName,
            publishedAt: publishedDate.toISOString(),
            modifiedAt: post.updatedAt?.toISOString(),
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />

      <Header user={session?.user} isAdmin={isAdmin} />

      <main className="flex-1 blog-page">
        <div className="sk-wrap blog-article-wrapper">
          {!post.published && (
            <p className="blog-draft-banner" role="status">
              Draft preview — this article is not visible to the public yet.
            </p>
          )}

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="blog-breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/blog">Blog</Link>
            <span aria-hidden="true">/</span>
            <span className="text-muted-foreground truncate max-w-[200px] sm:max-w-xs">{post.title}</span>
          </nav>

          {/* Article Header */}
          <header className="blog-article-header">
            <div className="blog-article-meta">
              <span className="blog-article-meta-item">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <time dateTime={publishedDate.toISOString()}>
                  {publishedDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </span>
              <span aria-hidden="true">·</span>
              <span className="blog-article-meta-item">
                <UserIcon className="h-4 w-4" aria-hidden="true" />
                <span>{authorName}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="blog-article-meta-item">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>{readingTime} min read</span>
              </span>
            </div>

            <h1 className="font-display font-extrabold tracking-tight">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-xl text-muted-foreground leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {post.tags.length > 0 && (
              <ul className="blog-article-tags">
                {post.tags.map((tag) => (
                  <li key={tag} className="blog-tag">
                    {tag}
                  </li>
                ))}
              </ul>
            )}

            {post.coverImage && (
              <div className="blog-article-cover" aria-hidden="true">
                <img
                  src={post.coverImage}
                  alt={post.title}
                />
              </div>
            )}
          </header>

          {/* Main Article Body Card */}
          <article className="blog-article-card">
            <div
              className="blog-prose"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(post.content, {
                  ALLOWED_TAGS: [
                    "p", "b", "i", "em", "strong", "a", "ul", "ol", "li",
                    "h1", "h2", "h3", "h4", "h5", "h6", "img", "blockquote",
                    "code", "pre", "hr", "br",
                  ],
                  ALLOWED_ATTR: ["href", "src", "alt", "class", "target", "rel"],
                  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
                }),
              }}
            />
          </article>

          <ShareButtons
            url={`${appConfig.url}/blog/${post.slug}`}
            title={post.title}
          />

          {related.length > 0 && (
            <section className="blog-related" aria-labelledby="related-heading">
              <h2 id="related-heading" className="blog-related-heading">
                Keep reading
              </h2>
              <ul className="blog-related-list">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link href={`/blog/${item.slug}`} className="blog-related-card">
                      <time
                        className="blog-related-date"
                        dateTime={(item.publishedAt ?? item.createdAt).toISOString()}
                      >
                        {(item.publishedAt ?? item.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                      <span className="blog-related-title">{item.title}</span>
                      {item.excerpt && (
                        <span className="blog-related-excerpt">{item.excerpt}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Navigation / Back Button */}
          <div className="flex items-center justify-between">
            <Link href="/blog" className="sk-btn inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to all articles</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
