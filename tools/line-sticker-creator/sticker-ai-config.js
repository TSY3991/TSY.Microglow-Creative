// 只填已部署的 Worker HTTPS 位址，不放 API 金鑰。
// 啟用時同步將 index.html 的 connect-src 改成這個 Worker 的精確 origin。
window.StickerAIConfig = Object.freeze({ endpoint: "https://microglow-sticker-ai.microglow-creative.workers.dev/arrange" });
