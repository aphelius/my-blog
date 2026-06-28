// Cloudflare Pages Function：首页实时天气。
// 默认用 request.cf 的 IP 定位（城市级，可能落到省会）；若带上 ?lat=&lon=
// （来自浏览器精确定位）则优先使用，以提升精度。调用 Open-Meteo（免费、无需 key）。
// 本地 astro dev 不跑 Functions，会优雅降级。
//   GET /api/weather[?lat=..&lon=..&city=..] -> { city, temperature, code, isDay }

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
  const params = new URL(request.url).searchParams;

  // 优先使用客户端传入的精确经纬度（浏览器 Geolocation）；否则回退到 IP 定位
  const qLat = parseFloat(params.get("lat") ?? "");
  const qLon = parseFloat(params.get("lon") ?? "");
  const hasPrecise =
    Number.isFinite(qLat) &&
    Number.isFinite(qLon) &&
    Math.abs(qLat) <= 90 &&
    Math.abs(qLon) <= 180;

  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  const lat = hasPrecise ? qLat : cf?.latitude;
  const lon = hasPrecise ? qLon : cf?.longitude;
  const city = hasPrecise
    ? (params.get("city") ?? "").slice(0, 60)
    : (cf?.city ?? cf?.region ?? "");

  if (lat == null || lon == null) {
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
