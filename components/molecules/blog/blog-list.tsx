'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  X,
  Calendar,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface BlogPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage?: string | null;
  createdAt: Date | string;
  publishedAt?: Date | string | null;
  tags?: string[];
  author: {
    name: string | null;
  } | null;
}

interface BlogListProps {
  posts: BlogPostItem[];
  allTags: string[];
  activeTag: string | null;
  query: string;
  page: number;
  totalPages: number;
  total: number;
}

export function BlogList({
  posts,
  allTags,
  activeTag,
  query,
  page,
  totalPages,
  total,
}: BlogListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(query);

  // L'URL est la source de verite : un retour arriere doit reafficher la
  // recherche qui a produit la page, pas la derniere frappe.
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const navigate = (next: { q?: string; tag?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    const nextQuery = next.q ?? query;
    const nextTag = next.tag === undefined ? activeTag : next.tag;
    const nextPage = next.page ?? 1;

    if (nextQuery) params.set('q', nextQuery);
    if (nextTag) params.set('tag', nextTag);
    if (nextPage > 1) params.set('page', String(nextPage));

    const search = params.toString();
    startTransition(() => {
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  };

  useEffect(() => {
    if (searchInput === query) return;
    const timer = setTimeout(() => navigate({ q: searchInput, page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasFilters = Boolean(query || activeTag);

  return (
    <div>
      <div className="blog-search-container">
        <div className="blog-search-box">
          <Search className="blog-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search articles by title, topic, or keyword..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="blog-search-input"
            aria-label="Search articles"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="blog-search-clear"
              aria-label="Clear search query"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="blog-search-meta">
          <span className="font-mono text-xs">
            {hasFilters
              ? `${total} ${total === 1 ? 'article matches' : 'articles match'}`
              : `${total} ${total === 1 ? 'article' : 'articles'} published`}
          </span>
          {query && (
            <span className="sk-hand text-xs">Filtering by &ldquo;{query}&rdquo;</span>
          )}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="blog-tag-filters">
          <button
            type="button"
            onClick={() => navigate({ tag: null, page: 1 })}
            className="blog-tag-chip"
            aria-pressed={activeTag === null}
          >
            All topics
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => navigate({ tag: activeTag === tag ? null : tag, page: 1 })}
              className="blog-tag-chip"
              aria-pressed={activeTag === tag}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="blog-empty-state">
          <h3 className="font-display font-bold text-xl mb-2">
            {hasFilters ? 'No matching articles' : 'No articles published yet'}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {query
              ? `We couldn't find anything matching “${query}”. Try another keyword.`
              : activeTag
                ? `No article is tagged “${activeTag}” yet.`
                : 'We are working on fresh content and tutorials. Check back soon!'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                navigate({ q: '', tag: null, page: 1 });
              }}
              className="sk-btn text-sm py-2 px-4"
            >
              Clear filters ✕
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="blog-grid" data-pending={isPending || undefined}>
            {posts.map((post) => {
              const date = new Date(post.publishedAt ?? post.createdAt);
              const authorName = post.author?.name || 'Editorial Team';
              const initial = authorName.charAt(0).toUpperCase();

              return (
                <article key={post.id} className="blog-card">
                  <div>
                    {post.coverImage && (
                      <Link
                        href={`/blog/${post.slug}`}
                        className="blog-card-image-link"
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="blog-card-image"
                          loading="lazy"
                        />
                      </Link>
                    )}

                    <div className="blog-card-meta">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <time dateTime={date.toISOString()}>
                        {formatDistanceToNow(date, { addSuffix: true })}
                      </time>
                    </div>

                    <h2 className="blog-card-title">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>

                    {post.excerpt && <p className="blog-card-excerpt">{post.excerpt}</p>}

                    {(post.tags ?? []).length > 0 && (
                      <ul className="blog-card-tags">
                        {(post.tags ?? []).slice(0, 3).map((tag) => (
                          <li key={tag} className="blog-tag">
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="blog-card-footer">
                    <div className="blog-card-author">
                      <div className="blog-card-avatar" aria-hidden="true">
                        {initial}
                      </div>
                      <span>{authorName}</span>
                    </div>

                    <Link
                      href={`/blog/${post.slug}`}
                      className="blog-card-link"
                      aria-label={`Read ${post.title}`}
                    >
                      <span>Read</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="blog-pagination" aria-label="Pagination">
              <button
                type="button"
                className="blog-page-btn"
                onClick={() => navigate({ page: page - 1 })}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <span className="blog-page-status" aria-live="polite">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="blog-page-btn"
                onClick={() => navigate({ page: page + 1 })}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
