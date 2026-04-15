"use client";

import Link from "next/link";
import { useState } from "react";

import type { HomeBlogPost } from "@/lib/home-blog";

const PAGE_SIZE = 3;

type HomeBlogSectionProps = {
  posts: HomeBlogPost[];
  title: string;
  subtitle: string;
  readMoreLabel: string;
  loadMoreLabel: string;
};

export function HomeBlogSection({
  posts,
  title,
  subtitle,
  readMoreLabel,
  loadMoreLabel,
}: HomeBlogSectionProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  if (posts.length === 0) return null;

  const shown = posts.slice(0, visible);
  const hasMore = visible < posts.length;

  return (
    <section className="relative mx-auto max-w-6xl px-6 pb-8">
      <div className="adria-animate-in text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted">{subtitle}</p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {shown.map((post, i) => (
          <article
            key={post.id}
            className={`adria-glass adria-animate-in overflow-hidden rounded-2xl ${
              i % 3 === 0 ? "adria-delay-1" : i % 3 === 1 ? "adria-delay-2" : "adria-delay-3"
            }`}
          >
            {post.image_url && (
              <Link href={`/blog/${post.slug}`} className="block overflow-hidden">
                <img
                  src={post.image_url}
                  alt={post.title || "Blog borítókép"}
                  className="h-36 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                />
              </Link>
            )}
            <div className="p-5">
              {post.date && (
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700/70">{post.date}</p>
              )}
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                <Link href={`/blog/${post.slug}`} className="hover:text-primary hover:underline">
                  {post.title || "Blog bejegyzés"}
                </Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {post.excerpt || "Rövid leírás hamarosan."}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                {readMoreLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, posts.length))}
            className="rounded-2xl border border-slate-300/85 bg-white/95 px-8 py-3 text-sm font-bold text-slate-900 shadow-sm transition-all hover:border-primary/50 hover:bg-slate-50"
          >
            {loadMoreLabel}
          </button>
        </div>
      )}
    </section>
  );
}
