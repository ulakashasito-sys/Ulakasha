const NEWSLETTER_TABLE = process.env.SUPABASE_NEWSLETTER_TABLE || "newsletter_subscribers";

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

function clean(value) {
  return String(value || "").trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function lang(value) {
  return value === "en" ? "en" : "it";
}

function phoneLabel(value) {
  return clean(value) || "Non indicato";
}

function consentLabel(value) {
  return value ? "true" : "false";
}

function notificationText(payload) {
  return [
    "🎉 Nuovo iscritto alla newsletter Ulakasha",
    "",
    "👤 Nome: " + payload.name,
    "📧 E-mail: " + payload.email,
    "📞 Telefono: " + phoneLabel(payload.phone),
    "🌍 Lingua newsletter: " + payload.newsletter_language,
    "✅ Consenso privacy: " + consentLabel(payload.consent)
  ].join("\n");
}

function notificationHtml(payload) {
  return notificationText(payload).replace(/\n/g, "<br>");
}

async function saveToSupabase(payload) {
  const supabaseUrl = clean(process.env.SUPABASE_URL).replace(/\/$/, "");
  const supabaseKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server configuration");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(NEWSLETTER_TABLE)}`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Newsletter Supabase insert failed", response.status, detail);
    throw new Error("Supabase insert failed");
  }
}

async function sendNotification(payload) {
  const resendApiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.RESEND_FROM_EMAIL);
  const to = clean(process.env.CONTACT_NOTIFICATION_EMAIL);

  if (!resendApiKey || !from || !to) {
    throw new Error("Missing Resend server configuration");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: payload.email,
      subject: "Nuovo iscritto newsletter Ulakasha",
      text: notificationText(payload),
      html: notificationHtml(payload)
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Newsletter Resend notification failed", response.status, detail);
    throw new Error("Resend email failed");
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const payload = {
    name: clean(data.name),
    email: clean(data.email).toLowerCase(),
    phone: clean(data.phone) || null,
    newsletter_language: lang(data.newsletter_language),
    site_language: lang(data.site_language),
    message: clean(data.message) || null,
    source: clean(data.source) || "website",
    page_url: clean(data.page_url) || null,
    consent: data.consent === true
  };

  if (!payload.name || !isEmail(payload.email) || !payload.consent) {
    return json(400, { ok: false, error: "invalid_data" });
  }

  try {
    await saveToSupabase(payload);
  } catch (error) {
    console.error("Newsletter Supabase error", error.message);
    return json(502, { ok: false, error: "supabase_error" });
  }

  try {
    await sendNotification(payload);
  } catch (error) {
    console.error("Newsletter Resend error", error.message);
    return json(502, { ok: false, error: "email_error" });
  }

  return json(200, { ok: true });
};
