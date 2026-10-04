// src/server/api/parse.post.ts
import { defineEventHandler, readBody } from "solid-vue/server";

// src/server/utils/parse-order.ts
var MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";
var OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
var TIMEOUT_MS = 18e4;
var SCHEMA = {
  type: "object",
  properties: {
    customer: { type: "string" },
    payment: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          size: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" }
        },
        required: ["name", "size", "qty", "unit"]
      }
    }
  },
  required: ["customer", "payment", "items"]
};
var SYSTEM = `Ubah pesanan percetakan menjadi JSON. Jangan hitung harga.
customer: nama pemesan ("" jika tidak ada). payment: jumlah DP/pembayaran yang disebutkan dalam rupiah (angka bulat, 0 jika tidak disebutkan). items: name (jenis cetakan tanpa ukuran), size (ukuran), qty (angka), unit (satuan). Isi "" jika tidak ada.
Contoh: "Pak Eko bayar 50000, brosur 200 lembar A5" -> {"customer":"Pak Eko","payment":50000,"items":[{"name":"brosur","size":"A5","qty":200,"unit":"lembar"}]}`;
var CATALOG = {
  spanduk: ["spanduk", "banner", "baliho"],
  "kartu nama": ["kartu nama"],
  stiker: ["stiker", "sticker"],
  undangan: ["undangan"],
  foto: ["foto"]
};
var UNITS = /* @__PURE__ */ new Set(["lembar", "box", "pcs", "meter", "rim", "buah", "pack"]);
var NUM_WORDS = /* @__PURE__ */ new Set(["satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh"]);
var SIZE_RE = /\b(\d+(?:[.,]\d+)?\s?[x×]\s?\d+(?:[.,]\d+)?|a\d|\d{1,2}\s?r)\b/i;
var VALID_SIZE_RE = /^(\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?(?:cm|mm|m)?|[ab]\d\+?|\d{1,2}r|f4)$/i;
var HONORIFICS = /* @__PURE__ */ new Set(["pak", "bapak", "bu", "ibu", "haji", "hj", "kang", "teh", "mas", "mbak", "aa", "neng"]);
var SIZE_AFTER_RE = new RegExp("^\\s*" + SIZE_RE.source, "i");
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function fmtSize(s) {
  const t = s.replace(/\s+/g, "").replace("\xD7", "x");
  return /^a\d$/i.test(t) || /^\d{1,2}r$/i.test(t) ? t.toUpperCase() : t.toLowerCase();
}
function normalizeItem(raw) {
  let name = String(raw.name ?? "").trim().toLowerCase();
  let size = String(raw.size ?? "").trim();
  let unit = String(raw.unit ?? "").trim().toLowerCase();
  if (UNITS.has(size.toLowerCase())) {
    if (!unit) unit = size.toLowerCase();
    size = "";
  }
  if (size) {
    name = name.replace(new RegExp(escapeRe(size), "i"), " ");
  } else {
    const m = name.match(SIZE_RE);
    if (m) {
      size = m[0];
      name = name.replace(m[0], " ");
    }
  }
  name = name.replace(/\bcetak\b/g, " ").replace(/\s+/g, " ").trim();
  for (const [key, aliases] of Object.entries(CATALOG)) {
    if (aliases.some((a) => name === a || name.includes(a))) {
      name = key;
      break;
    }
  }
  if (NUM_WORDS.has(unit)) unit = "";
  size = fmtSize(size);
  if (size && !VALID_SIZE_RE.test(size)) size = "";
  return { name, size, qty: Number(raw.qty) || 0, unit };
}
function recoverSize(item, text) {
  if (item.size) return item;
  const lower = text.toLowerCase();
  const aliases = CATALOG[item.name] ?? [item.name];
  for (const a of aliases) {
    const i = lower.indexOf(a);
    if (i < 0) continue;
    const m = lower.slice(i + a.length).match(SIZE_AFTER_RE);
    if (m?.[1]) return { ...item, size: fmtSize(m[1]) };
  }
  return item;
}
function parsePayment(text) {
  const m = text.match(
    /\b(?:uang muka|pembayaran|dibayar|bayar|panjar|dp|lunas)\s*(?:rp\.?)?\s*(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)?(?![a-z])/i
  );
  if (!m?.[1]) return null;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const mult = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6 };
  return Math.round(n * (mult[(m[2] ?? "").toLowerCase()] ?? 1));
}
function postProcess(raw, text) {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map(normalizeItem).filter((i) => i.name && i.qty > 0).map((i) => recoverSize(i, text));
  const lower = text.toLowerCase();
  let customer = String(raw.customer ?? "").replace(/^atas nama\s+/i, "").trim();
  const words = customer.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !HONORIFICS.has(w));
  if (!words.some((w) => lower.includes(w))) customer = "";
  const extractedPayment = parsePayment(text);
  const modelPayment = Number(raw.payment);
  const dp = extractedPayment ?? (Number.isFinite(modelPayment) && modelPayment >= 0 && modelPayment <= 1e10 ? Math.round(modelPayment) : 0);
  const warnings = [];
  if (!customer) warnings.push("Nama pemesan kosong");
  if (!items.length) warnings.push("Tidak ada item terbaca");
  if (!dp) warnings.push("Pembayaran Rp0");
  for (const [key, aliases] of Object.entries(CATALOG)) {
    if (aliases.some((a) => lower.includes(a)) && !items.some((i) => i.name === key))
      warnings.push(`Mungkin ada item terlewat: ${key}`);
  }
  return { customer, items, dp, warnings };
}
var emptyStats = (seconds) => ({
  seconds,
  tokPerSec: 0,
  promptTokens: 0,
  promptSecs: 0,
  outTokens: 0,
  loadSecs: 0
});
async function parseOrder(text) {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: SCHEMA,
        keep_alive: "30m",
        options: { temperature: 0, num_ctx: 2048, num_predict: 400 },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text }
        ]
      })
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = JSON.parse(data.message.content);
    return {
      ok: true,
      order: postProcess(raw, text),
      stats: {
        seconds: (performance.now() - t0) / 1e3,
        tokPerSec: data.eval_duration ? (data.eval_count ?? 0) / (data.eval_duration / 1e9) : 0,
        promptTokens: data.prompt_eval_count ?? 0,
        promptSecs: (data.prompt_eval_duration ?? 0) / 1e9,
        outTokens: data.eval_count ?? 0,
        loadSecs: (data.load_duration ?? 0) / 1e9
      }
    };
  } catch (err) {
    const error = err instanceof Error && err.name === "AbortError" ? "Model terlalu lama merespons" : err instanceof Error ? err.message : String(err);
    return { ok: false, error, stats: emptyStats((performance.now() - t0) / 1e3) };
  } finally {
    clearTimeout(timer);
  }
}

// src/server/api/parse.post.ts
var MAX_TEXT = 500;
var parse_post_default = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    event.res.status = 400;
    return { ok: false, error: "Teks pesanan kosong" };
  }
  if (text.length > MAX_TEXT) {
    event.res.status = 400;
    return { ok: false, error: `Teks terlalu panjang (maksimal ${MAX_TEXT} karakter)` };
  }
  const result = await parseOrder(text);
  if (!result.ok) event.res.status = 502;
  return result;
});
export {
  parse_post_default as default
};
