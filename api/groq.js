// Vercel Serverless Function：Groq 轉發代理
// 目的：讓瀏覽器同源呼叫 /api/groq，繞開瀏覽器直連 Groq 的 CORS 限制。
// 金鑰不存在伺服器：由前端每次以 x-groq-key 標頭帶上，這裡只負責轉發，不記錄、不留存。
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "只接受 POST" } });
    return;
  }
  const key = req.headers["x-groq-key"];
  if (!key) {
    res.status(400).json({ error: { message: "缺少 x-groq-key 標頭（前端未帶金鑰）" } });
    return;
  }
  try {
    // Vercel 會依 Content-Type 自動解析 JSON 到 req.body
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
      },
      body,
    });
    // 轉發 Groq 的速率限制標頭，讓前端能顯示剩餘額度
    [
      "x-ratelimit-limit-requests",
      "x-ratelimit-remaining-requests",
      "x-ratelimit-reset-requests",
      "x-ratelimit-limit-tokens",
      "x-ratelimit-remaining-tokens",
      "x-ratelimit-reset-tokens",
    ].forEach((h) => {
      const v = upstream.headers.get(h);
      if (v != null) res.setHeader(h, v);
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader("Content-Type", "application/json").send(text);
  } catch (e) {
    res.status(502).json({ error: { message: "代理轉發失敗：" + String(e) } });
  }
}
