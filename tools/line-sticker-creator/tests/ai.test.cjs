"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const C = require("../sticker-core.js"), AI = require("../sticker-ai.js");
const worker = import("../worker/worker.mjs");
function state(count = 8) {
  const s = C.initial(); s.settings.source = "original"; s.settings.kind = "animal"; s.settings.style = "cute";
  s.settings.count = count; s.items = Array.from({ length: count }, () => C.item()); s.grids = C.autoGrids(count);
  return s;
}
const rows = input => input.items.map(x => ({ id: x.id, text: "AI台詞" + x.id, emotion: "眉眼彎起露出笑容" + x.id, action: "一手揮手、身體微微前傾" + x.id }));
const origin = "https://tsy3991.github.io";
const environment = () => ({ AI_ENABLED: "true", ALLOWED_ORIGIN: origin, GEMINI_API_KEY: "test-only-not-real", GEMINI_MODEL: "gemini-2.5-flash-lite", CLIENT_LIMITER: { limit: async () => ({ success: true }) }, SERVICE_LIMITER: { limit: async () => ({ success: true }) } });
const request = (body, headers = {}, method = "POST") => new Request("https://worker.example/arrange", { method, headers: { Origin: origin, "CF-Connecting-IP": "192.0.2.1", "Content-Type": "application/json", ...headers }, ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
test("前端只傳內容白名單，不傳共用名稱、照片或其他設定", () => {
  const s = state(); s.settings.name = "私人店名"; s.reference = "data:image/png;secret";
  const input = AI.payload(s); assert.ok(!JSON.stringify(input).includes("私人店名")); assert.ok(!JSON.stringify(input).includes("data:image"));
  assert.equal(input.items.length, 8);
});
test("支援全部張數，只補空白並保留逐張無文字開關", () => {
  for (const count of [8, 16, 24, 32, 40]) {
    const s = state(count); s.settings.textMode = "per"; s.items[0].text = "自己的台詞"; s.items[0].emotion = "自訂表情"; s.items[1].hasText = false;
    const before = C.clone(s), input = AI.payload(s); AI.apply(s, rows(input));
    assert.equal(s.items[0].text, "自己的台詞"); assert.equal(s.items[0].emotion, "自訂表情"); assert.equal(s.items[1].text, "");
    assert.equal(s.items[1].hasText, false); assert.deepEqual(s.settings, before.settings); assert.deepEqual(s.grids, before.grids);
    assert.ok(s.items.every(x => x.emotion && x.action));
  }
});
test("壞結果整批拒絕，既有內容不變", () => {
  for (const kind of ["short", "duplicate", "long", "blank", "type"]) {
    const s = state(), before = C.clone(s), data = rows(AI.payload(s));
    if (kind === "short") data.pop(); if (kind === "duplicate") data[1].id = 1;
    if (kind === "long") data[7].action = "字".repeat(301); if (kind === "blank") data[7].emotion = ""; if (kind === "type") data[7].text = 9;
    assert.throws(() => AI.apply(s, data)); assert.deepEqual(s, before);
  }
});
test("未設定與不安全端點不發請求", () => {
  assert.equal(AI.endpoint(""), "");
  for (const url of ["http://worker.example/arrange", "https://key@worker.example/arrange", "https://worker.example/arrange?key=secret", "https://worker.example/other"]) assert.throws(() => AI.endpoint(url));
});
test("Worker 檢查輸入，拒絕照片、秘密與超量欄位", async () => {
  const { validateInput } = await worker, input = AI.payload(state()); assert.deepEqual(validateInput(input), input);
  for (const invalid of [{ ...input, photo: "data:image" }, { ...input, count: 9 }, { ...input, context: { ...input.context, key: "secret" } }, { ...input, items: [{ ...input.items[0], id: 2 }, ...input.items.slice(1)] }]) assert.throws(() => validateInput(invalid));
});
test("Worker 僅接受允許來源與路由，preflight 不觸發 Gemini", async () => {
  const { handle } = await worker, input = AI.payload(state()), env = environment(); let calls = 0;
  const upstream = () => { calls++; throw Error("unexpected"); };
  assert.equal((await handle(request(input, { Origin: "https://evil.example" }), env, upstream)).status, 403);
  assert.equal((await handle(request(input, { Origin: "" }), env, upstream)).status, 403);
  assert.equal((await handle(new Request("https://worker.example/other", { headers: { Origin: origin } }), env, upstream)).status, 404);
  const options = await handle(request(null, {}, "OPTIONS"), env, upstream); assert.equal(options.status, 204); assert.equal(options.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal((await handle(request(null, {}, "GET"), env, upstream)).status, 405); assert.equal(calls, 0);
});
test("Worker 未啟用或缺少金鑰與限流 binding 時不呼叫 Gemini", async () => {
  const { handle } = await worker; let calls = 0;
  for (const change of [{ AI_ENABLED: "false" }, { GEMINI_API_KEY: "" }, { CLIENT_LIMITER: null }, { SERVICE_LIMITER: null }, { GEMINI_MODEL: "invalid/path" }]) assert.equal((await handle(request(AI.payload(state())), { ...environment(), ...change }, () => { calls++; })).status, 503);
  assert.equal(calls, 0);
});
test("Worker 拒絕壞 JSON、非 JSON、超大 body，限流時不呼叫模型", async () => {
  const { handle } = await worker; let calls = 0; const upstream = () => { calls++; };
  assert.equal((await handle(request("not-json"), environment(), upstream)).status, 400);
  assert.equal((await handle(request(AI.payload(state()), { "Content-Type": "text/plain" }), environment(), upstream)).status, 400);
  assert.equal((await handle(request(" ".repeat(65537)), environment(), upstream)).status, 413);
  for (const binding of ["CLIENT_LIMITER", "SERVICE_LIMITER"]) {
    const env = environment(); env[binding] = { limit: async () => ({ success: false }) };
    assert.equal((await handle(request(AI.payload(state())), env, upstream)).status, 429);
  }
  assert.equal(calls, 0);
});
test("Worker 合法請求使用 header 金鑰，回應不含金鑰並保留既有欄位", async () => {
  const { handle } = await worker, s = state(); s.items[0].text = "保留"; s.items[0].action = "自訂";
  const input = AI.payload(s), env = environment(); let calls = 0;
  const response = await handle(request(input), env, async (url, options) => {
    calls++; assert.ok(!url.includes(env.GEMINI_API_KEY)); assert.equal(options.headers["x-goog-api-key"], env.GEMINI_API_KEY);
    assert.ok(options.signal instanceof AbortSignal); assert.ok(JSON.parse(options.body).generationConfig.responseSchema);
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ items: rows(input) }) }] } }] });
  });
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.items[0].text, "保留"); assert.equal(body.items[0].action, "自訂");
  assert.ok(!JSON.stringify(body).includes(env.GEMINI_API_KEY)); assert.equal(response.headers.get("Cache-Control"), "no-store"); assert.equal(calls, 1);
});
test("Worker 上游額度、權限、截斷與壞結果失敗，不改用其他模型", async () => {
  const { handle } = await worker, input = AI.payload(state());
  for (const [upstreamResponse, code] of [[new Response("secret error", { status: 429 }), 429], [new Response("secret error", { status: 401 }), 503], [Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] }), 502], [Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not-json" }] } }] }), 502]]) {
    let calls = 0; const response = await handle(request(input), environment(), async () => { calls++; return upstreamResponse; });
    assert.equal(response.status, code); assert.ok(!(await response.text()).includes("secret error")); assert.equal(calls, 1);
  }
});
test("Cloudflare fetch 簽名不把 ExecutionContext 當 upstream fetch", async () => {
  const { default: entry } = await worker; const response = await entry.fetch(request(AI.payload(state())), { ...environment(), AI_ENABLED: "false" }, {}); assert.equal(response.status, 503);
});
