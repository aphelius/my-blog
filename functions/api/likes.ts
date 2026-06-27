// Cloudflare Pages Function：全站点赞计数。
// 绑定一个名为 LIKES 的 KV 命名空间（见仓库 README / 部署说明）。
//   GET  /api/likes?slug=<路径>          -> { count }
//   POST /api/likes?slug=<路径>  body:{action:"like"|"unlike"} -> { count }

interface Env {
  LIKES: KVNamespace;
}

const keyOf = (slug: string) => `likes:${slug}`;

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
  // 归一化：去掉末尾斜杠，限制长度，避免脏 key
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

  let action = "like";
  try {
    const body = (await request.json()) as { action?: string };
    if (body?.action === "unlike") action = "unlike";
  } catch {
    /* 空 body 视为点赞 */
  }

  const key = keyOf(slug);
  const current = parseInt((await env.LIKES.get(key)) ?? "0", 10) || 0;
  const next = Math.max(0, action === "unlike" ? current - 1 : current + 1);
  await env.LIKES.put(key, String(next));
  return json({ count: next });
};
