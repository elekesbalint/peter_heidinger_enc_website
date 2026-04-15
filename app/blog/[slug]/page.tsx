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
  const recommendedPosts = [...posts]
    .filter((item) => item.slug !== slug)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Vissza a főoldalra
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
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

        {recommendedPosts.length > 0 && (
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Ajánlott cikkek</h2>
            <div className="mt-4 space-y-4">
              {recommendedPosts.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                  {item.image_url && (
                    <Link href={`/blog/${item.slug}`} className="block overflow-hidden rounded-lg">
                      <img
                        src={item.image_url}
                        alt={item.title || "Blog borítókép"}
                        className="h-24 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                      />
                    </Link>
                  )}
                  <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">
                    <Link href={`/blog/${item.slug}`} className="hover:text-primary hover:underline">
                      {item.title || "Blog bejegyzés"}
                    </Link>
                  </h3>
                  {item.date && (
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700/65">{item.date}</p>
                  )}
                </article>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

