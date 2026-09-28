const crypto = require("crypto");

const NEWSLETTER_TABLE = process.env.SUPABASE_NEWSLETTER_TABLE || "newsletter_subscribers";
const SESSION_HOURS = 12;

function clean(value) {
  return String(value || "").trim();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function base64url(value) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unbase64url(value) {
  value = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (value.length % 4) value += "=";
  return Buffer.from(value, "base64").toString("utf8");
}

function sessionSecret() {
  return clean(process.env.NEWSLETTER_ADMIN_SESSION_SECRET) || clean(process.env.NEWSLETTER_ADMIN_PASSWORD);
}

function sign(payload) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function makeToken(username) {
  const payload = base64url(JSON.stringify({
    username,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(value) {
  const token = clean(value).replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = sign(parts[0]);
  const given = parts[1];
  if (expected.length !== given.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return false;
  try {
    const payload = JSON.parse(unbase64url(parts[0]));
    return payload.exp && payload.exp > Date.now();
  } catch (error) {
    return false;
  }
}

function configured() {
  return !!(
    clean(process.env.NEWSLETTER_ADMIN_USERNAME) &&
    clean(process.env.NEWSLETTER_ADMIN_PASSWORD) &&
    sessionSecret() &&
    clean(process.env.SUPABASE_URL) &&
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  );
}

function supabaseUrl(query) {
  const base = clean(process.env.SUPABASE_URL).replace(/\/$/, "");
  return `${base}/rest/v1/${encodeURIComponent(NEWSLETTER_TABLE)}${query}`;
}

function dateFilter(value, suffix) {
  const date = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return `${date}${suffix}`;
}

async function listSubscribers(from, to) {
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const params = [
    "select=created_at,name,email,phone,newsletter_language,site_language,consent,message,page_url,source",
    "order=created_at.desc"
  ];
  const fromValue = dateFilter(from, "T00:00:00");
  const toValue = dateFilter(to, "T23:59:59");
  if (fromValue) params.push("created_at=gte." + encodeURIComponent(fromValue));
  if (toValue) params.push("created_at=lte." + encodeURIComponent(toValue));

  const response = await fetch(supabaseUrl("?" + params.join("&")), {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Newsletter admin Supabase read failed", response.status, detail);
    throw new Error("Supabase read failed");
  }

  return response.json();
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  if (!configured()) {
    console.error("Newsletter admin configuration is incomplete");
    return json(500, { ok: false, error: "server_not_configured" });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { ok: false, error: "invalid_json" });
  }

  if (data.action === "login") {
    const username = clean(data.username);
    const password = clean(data.password);
    const expectedUsername = clean(process.env.NEWSLETTER_ADMIN_USERNAME);
    const expectedPassword = clean(process.env.NEWSLETTER_ADMIN_PASSWORD);

    if (username !== expectedUsername || password !== expectedPassword) {
      return json(401, { ok: false, error: "invalid_credentials" });
    }

    return json(200, { ok: true, token: makeToken(username) });
  }

  if (!verifyToken(event.headers.authorization || event.headers.Authorization || data.token)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  if (data.action === "list") {
    try {
      const subscribers = await listSubscribers(data.from, data.to);
      return json(200, { ok: true, subscribers });
    } catch (error) {
      console.error("Newsletter admin list error", error.message);
      return json(502, { ok: false, error: "supabase_error" });
    }
  }

  return json(400, { ok: false, error: "invalid_action" });
};
