// 查看使用者「找不到職業」的搜尋字詞與次數（需已綁定 KV：SEARCH_MISS，並已用 microglow profile 登入）。
// 用法：在本資料夾執行  node read-search-miss.mjs   （可加 --profile 其他名稱）
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function summarize(entries) {
  return entries.map(({ key, count }) => ({ q: key.replace(/^q:/, ""), count: Number(count) || 0 })).sort((a, b) => b.count - a.count || a.q.localeCompare(b.q, "zh-Hant"));
}
function wrangler(args, profile) {
  const out = execFileSync("npx", ["--yes", "wrangler@4", ...args, "--binding", "SEARCH_MISS", "--remote", "--profile", profile], { encoding: "utf8", shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
  return out;
}
export function readAll(run = wrangler, profile = "microglow") {
  const listing = run(["kv", "key", "list", "--prefix", "q:"], profile), list = JSON.parse(listing.slice(listing.indexOf("[")));
  return summarize(list.map(({ name }) => ({ key: name, count: run(["kv", "key", "get", name], profile).trim().split(/\r?\n/).pop() })));
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const profile = process.argv.includes("--profile") ? process.argv[process.argv.indexOf("--profile") + 1] : "microglow";
  try {
    const rows = readAll(wrangler, profile);
    if (!rows.length) console.log("目前沒有任何搜尋字詞紀錄。");
    for (const r of rows) console.log(String(r.count).padStart(5) + "  " + r.q);
  } catch (error) { console.error("讀取失敗：" + (error.stderr || error.message)); process.exitCode = 1; }
}
