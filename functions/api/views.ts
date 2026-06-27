// Cloudflare Pages Function：文章浏览量计数。
// 复用与点赞相同的 KV 绑定（变量名 LIKES），键前缀为 views:。
//   GET  /api/views?slug=<路径>   -> { count }
//   POST /api/views?slug=<路径>   -> { count }（自增 1）

interface Env {
  LIKES: KVNamespace;
}

const keyOf = (slug: string) => `views:${slug}`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getSlug(request: Request): string | null {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return null;
  return slug.replace(/\/+$/, "").slice(0, 200);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const slug = getSlug(request);
  if (!slug) return json({ error: "missing slug" }, 400);
  const count = parseInt((await env.LIKES.get(keyOf(slug))) ?? "0", 10) || 0;
  return json({ count });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const slug = getSlug(request);
  if (!slug) return json({ error: "missing slug" }, 400);
  const key = keyOf(slug);
  const next = (parseInt((await env.LIKES.get(key)) ?? "0", 10) || 0) + 1;
  await env.LIKES.put(key, String(next));
  return json({ count: next });
};
