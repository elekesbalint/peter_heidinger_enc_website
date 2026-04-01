export type HomeBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image_url: string;
};

export const DEFAULT_HOME_BLOG_POSTS: HomeBlogPost[] = [
  {
    id: "blog-1",
    slug: "hogyan-valassz-jarmukategoriat-enc-rendelesnel",
    title: "Hogyan válassz járműkategóriát ENC rendelésnél?",
    excerpt: "Összeszedtük röviden, melyik kategória mire való, hogy a rendelés során könnyebben tudj dönteni.",
    content:
      "A megfelelő kategória kiválasztása fontos, mert ez határozza meg a díjszámítást is.\n\nHa bizonytalan vagy, ellenőrizd a rendelési oldalon található kategória magyarázót, és hasonlítsd össze a járműved fő paramétereit.",
    date: "2026-03-30",
    image_url: "",
  },
  {
    id: "blog-2",
    slug: "mikor-erdemes-egyenleget-feltolteni",
    title: "Mikor érdemes egyenleget feltölteni?",
    excerpt: "Mutatjuk, mire figyelj úticél választáskor, és hogyan kerülheted el az alacsony egyenleget indulás előtt.",
    content:
      "Indulás előtt mindig nézd meg az ajánlott összeget, és számolj tartalékkal is.\n\nEltérő útvonal vagy határátkelő esetén a tényleges költség magasabb lehet.",
    date: "2026-03-30",
    image_url: "",
  },
  {
    id: "blog-3",
    slug: "mit-latsz-a-dashboardon",
    title: "Mit látsz a dashboardon?",
    excerpt: "Lépésről lépésre bemutatjuk, hol találod az eszközeidet, az egyenlegeket és a feltöltési előzményeket.",
    content:
      "A Fiókom oldalon egy helyen eléred az eszközeidet, egyenlegeidet és a feltöltési előzményeket.\n\nÍgy gyorsan ellenőrizheted, hogy minden rendben van-e indulás előtt.",
    date: "2026-03-30",
    image_url: "",
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizePost(input: Partial<HomeBlogPost>, index: number): HomeBlogPost {
  const title = String(input.title ?? "").trim();
  const id = String(input.id ?? `blog-${index + 1}`).trim() || `blog-${index + 1}`;
  const slugFromTitle = slugify(title);
  const fallbackSlug = `blog-${index + 1}`;
  const slug = String(input.slug ?? "").trim() || slugFromTitle || fallbackSlug;

  return {
    id,
    slug,
    title,
    excerpt: String(input.excerpt ?? "").trim(),
    content: String(input.content ?? "").trim(),
    date: String(input.date ?? "").trim(),
    image_url: String(input.image_url ?? "").trim(),
  };
}

export function parseHomeBlogPosts(raw: string | null | undefined): HomeBlogPost[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_HOME_BLOG_POSTS];
    const normalized = parsed
      .map((item, index) => normalizePost((item ?? {}) as Partial<HomeBlogPost>, index))
      .filter((post) => post.title || post.excerpt || post.content);
    return normalized;
  } catch {
    return [...DEFAULT_HOME_BLOG_POSTS];
  }
}

export function stringifyHomeBlogPosts(posts: HomeBlogPost[]): string {
  return JSON.stringify(posts);
}

export function createEmptyHomeBlogPost(): HomeBlogPost {
  const id = `blog-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    id,
    slug: id,
    title: "",
    excerpt: "",
    content: "",
    date: new Date().toISOString().slice(0, 10),
    image_url: "",
  };
}

