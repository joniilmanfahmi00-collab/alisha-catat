// src/server/api/warmup.post.ts
import { defineEventHandler } from "solid-vue/server";

// src/server/utils/parse-order.ts
var MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";
var OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
var TIMEOUT_MS = 18e4;
var SIZE_RE = /\b(\d+(?:[.,]\d+)?\s?[x×]\s?\d+(?:[.,]\d+)?|a\d|\d{1,2}\s?r)\b/i;
var SIZE_AFTER_RE = new RegExp("^\\s*" + SIZE_RE.source, "i");
async function warmUpModel() {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ model: MODEL, keep_alive: "30m" })
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return { ok: true, seconds: (performance.now() - t0) / 1e3 };
  } catch (err) {
    return {
      ok: false,
      seconds: (performance.now() - t0) / 1e3,
      error: err instanceof Error ? err.message : String(err)
    };
  } finally {
    clearTimeout(timer);
  }
}

// src/server/api/warmup.post.ts
var warmup_post_default = defineEventHandler(async (event) => {
  const result = await warmUpModel();
  if (!result.ok) event.res.status = 502;
  return result;
});
export {
  warmup_post_default as default
};
