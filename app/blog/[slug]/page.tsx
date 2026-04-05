import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettingsMap } from "@/lib/app-settings";
import { blogContentToSafeHtml } from "@/lib/blog-content";
import { parseHomeBlogPosts } from "@/lib/home-blog";

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const settings = await getSettingsMap();
  const posts = parseHomeBlogPosts(settings.home_blog_posts_json);
  const post = posts.find((item) => item.slug === slug);

  if (!post) {
    notFound();
  }

  const bodyHtml = blogContentToSafeHtml(post.content || post.excerpt || "");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Vissza a főoldalra
      </Link>
      <article className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        {post.date && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700/70">{post.date}</p>}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{post.title}</h1>
        {post.image_url && (
          <img
            src={post.image_url}
            alt={post.title || "Blog borítókép"}
            className="mt-6 h-64 w-full rounded-xl object-cover md:h-80"
          />
        )}
        {bodyHtml ? (
          <div
            className="blog-prose mt-6 text-base leading-relaxed text-muted"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="mt-6 text-muted">A cikk tartalma hamarosan.</p>
        )}
      </article>
    </main>
  );
}

