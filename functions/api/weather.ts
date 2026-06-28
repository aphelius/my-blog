// Cloudflare Pages Function：首页实时天气。
// 用 request.cf 的 IP 定位（经纬度 + 城市名）调用 Open-Meteo（免费、无需 key），
// 返回当前气温与天气代码给前端。本地 astro dev 不跑 Functions，会优雅降级。
//   GET /api/weather -> { city, temperature, code, isDay }

interface Env {
  // 暂无绑定需求；保留以备扩展（如缓存到 KV）。
  LIKES?: KVNamespace;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 边缘缓存 30 分钟，降低对 Open-Meteo 的请求量
      "cache-control": "public, max-age=1800",
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  // Cloudflare 在 request.cf 上注入访客地理信息
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  const lat = cf?.latitude;
  const lon = cf?.longitude;
  const city = cf?.city ?? cf?.region ?? "";

  if (!lat || !lon) {
    return json({ error: "no geolocation" }, 422);
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day&timezone=auto`;

  try {
    const res = await fetch(url, {
      // 让 Cloudflare 缓存上游响应
      cf: { cacheTtl: 1800, cacheEverything: true },
    });
    if (!res.ok) return json({ error: "upstream error" }, 502);
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
      };
    };
    const current = data.current ?? {};
    return json({
      city,
      temperature:
        typeof current.temperature_2m === "number"
          ? Math.round(current.temperature_2m)
          : null,
      code: current.weather_code ?? null,
      isDay: current.is_day === 1,
    });
  } catch {
    return json({ error: "fetch failed" }, 502);
  }
};
