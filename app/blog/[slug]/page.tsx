import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettingsMap } from "@/lib/app-settings";
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

  const paragraphs = (post.content || post.excerpt || "")
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

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
        <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
          {paragraphs.map((paragraph, idx) => (
            <p key={`${idx}-${paragraph.slice(0, 32)}`} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}

