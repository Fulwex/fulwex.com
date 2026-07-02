function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({}); }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function clean(value, max = 1200) {
  return String(value || "").trim().slice(0, max);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  const name = clean(payload.name, 80);
  const email = clean(payload.email, 120);
  const company = clean(payload.company, 120);
  const message = clean(payload.message, 1200);

  if (name.length < 2 || !isValidEmail(email) || message.length < 10) {
    return res.status(400).json({ ok: false, error: "Validation failed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: "Telegram is not configured" });
  }

  const submitted = new Date().toISOString();
  const text = [
    "🚀 New Lead",
    "",
    "👤 Name:",
    name,
    "",
    "📧 Email:",
    email,
    "",
    "🏢 Company:",
    company || "-",
    "",
    "💬 Message:",
    message,
    "",
    "🕒 Submitted:",
    submitted
  ].join("\n");

  try {
    const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: "Telegram request failed" });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: "Telegram request failed" });
  }
};
