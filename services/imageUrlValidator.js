const axios = require("axios");

const UA =
  "Mozilla/5.0 (compatible; CommerceAI-ImageChecker/1.0; +https://localhost)";

/**
 * Returns true if URL responds with an image (2xx).
 */
async function isImageUrlReachable(url, { timeoutMs = 12000 } = {}) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;

  try {
    const head = await axios.head(trimmed, {
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { "User-Agent": UA },
    });
    if (head.status >= 200 && head.status < 400) {
      const ct = String(head.headers["content-type"] || "");
      if (!ct || ct.includes("image") || ct.includes("octet-stream")) {
        return true;
      }
    }
  } catch {
    /* fall through to GET */
  }

  try {
    const get = await axios.get(trimmed, {
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: () => true,
      responseType: "stream",
      headers: { "User-Agent": UA },
    });
    const ok = get.status >= 200 && get.status < 400;
    get.data?.destroy?.();
    return ok;
  } catch {
    return false;
  }
}

module.exports = { isImageUrlReachable };
