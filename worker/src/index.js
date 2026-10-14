/**
 * Unio contact form endpoint.
 *
 * A Cloudflare Worker that receives the "Get in touch" form from the static
 * site, validates it, and forwards it as an email through Resend. Nothing is
 * stored anywhere: the request is turned into one email and dropped.
 *
 * Accepts a classic HTML form POST (application/x-www-form-urlencoded or
 * multipart/form-data) and answers with a redirect to the thank-you page, so
 * the site needs no JavaScript. Also accepts JSON and answers JSON, in case a
 * fetch()-based form is wanted later.
 *
 * Configuration (wrangler.toml [vars] and `wrangler secret put`):
 *   ALLOWED_ORIGINS   comma-separated list of origins allowed to post,
 *                     e.g. "https://unio.syntaric.com"
 *   TO_EMAIL          where submissions go, comma-separated for several
 *   FROM_EMAIL        sender, on a domain verified in Resend,
 *                     e.g. "Unio website <noreply@syntaric.com>"
 *   REDIRECT_URL      thank-you page, e.g. "https://unio.syntaric.com/thanks.html"
 *   RESEND_API_KEY    secret
 *   TURNSTILE_SECRET  secret, optional; enables Cloudflare Turnstile checks
 *   CONTACT_RATELIMIT optional rate-limit binding (see wrangler.toml)
 */

const FIELD_LIMITS = { kind: 120, name: 120, org: 200, email: 200, message: 5000 };

export default {
  async fetch(request, env) {
    const allowed = parseList(env.ALLOWED_ORIGINS);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
    }

    // Only accept posts that come from the site. Browsers send Origin on
    // cross-site form posts and fetch(); same-site posts may carry only Referer.
    const referer = request.headers.get("Referer") || "";
    const fromSite =
      allowed.length === 0 ||
      allowed.includes(origin) ||
      allowed.some((a) => referer.startsWith(a + "/") || referer === a);
    if (!fromSite) {
      return new Response("Forbidden", { status: 403 });
    }

    const reply = new Replier(request, env, cors);

    // Per-IP rate limit, if the binding is configured.
    if (env.CONTACT_RATELIMIT) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.CONTACT_RATELIMIT.limit({ key: ip });
      if (!success) {
        return reply.fail(429, "Too many requests from your network. Please try again in a minute.");
      }
    }

    let data;
    try {
      data = await readBody(request);
    } catch {
      return reply.fail(400, "The form could not be read. Please go back and try again.");
    }

    // Honeypot: a real visitor never sees this field, so anything in it is a bot.
    // Answer as if it worked, so the bot learns nothing.
    if (data._gotcha) {
      return reply.done();
    }

    const fields = {};
    for (const [key, max] of Object.entries(FIELD_LIMITS)) {
      fields[key] = clean(data[key], max);
    }

    if (!fields.name || !isEmail(fields.email)) {
      return reply.fail(400, "Please give your name and a valid email address.");
    }

    if (env.TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(env.TURNSTILE_SECRET, data["cf-turnstile-response"], request.headers.get("CF-Connecting-IP"));
      if (!ok) {
        return reply.fail(400, "The anti-spam check did not pass. Please go back and try again.");
      }
    }

    const sent = await sendEmail(env, fields, request);
    if (!sent) {
      return reply.fail(502, "We could not send your request right now. Please email info@syntaric.com directly.");
    }
    return reply.done();
  },
};

/* ---------- email ---------- */

async function sendEmail(env, f, request) {
  const country = request.cf && request.cf.country ? request.cf.country : "unknown";
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const subject = `Unio: ${f.kind || "website request"} from ${f.name}${f.org ? " (" + f.org + ")" : ""}`;
  const text = [
    `New request from the Unio website`,
    ``,
    `Request:       ${f.kind || "-"}`,
    `Name:          ${f.name}`,
    `Organisation:  ${f.org || "-"}`,
    `Email:         ${f.email}`,
    ``,
    `Message:`,
    f.message || "(none)",
    ``,
    `---`,
    `Received ${when}, visitor country ${country}. Reply to this email to answer them.`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: parseList(env.TO_EMAIL),
      reply_to: f.email,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

/* ---------- responses ---------- */

class Replier {
  constructor(request, env, cors) {
    const accept = request.headers.get("Accept") || "";
    const ct = request.headers.get("Content-Type") || "";
    this.json = ct.includes("application/json") || accept.includes("application/json");
    this.redirect = env.REDIRECT_URL || "/";
    this.cors = cors;
  }

  done() {
    if (this.json) {
      return jsonResponse({ ok: true }, 200, this.cors);
    }
    return new Response(null, { status: 303, headers: { Location: this.redirect, ...this.cors } });
  }

  fail(status, message) {
    if (this.json) {
      return jsonResponse({ ok: false, error: message }, status, this.cors);
    }
    let back = "/";
    try {
      back = new URL(this.redirect).origin + "/#contact";
    } catch {}
    return new Response(errorPage(message, back), {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", ...this.cors },
    });
  }
}

function jsonResponse(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function errorPage(message, back) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unio | Something went wrong</title>
<style>
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f3f6f9;color:#1c2a3a;display:flex;min-height:100vh;align-items:center;justify-content:center}
  main{max-width:520px;padding:40px 32px;background:#fff;border-radius:20px;box-shadow:0 16px 40px -20px rgba(12,40,66,.25)}
  h1{font-size:24px;margin:0 0 12px;color:#0c2842}
  p{margin:0 0 20px;line-height:1.6;color:#4d5d6e}
  a{display:inline-block;background:#128a8a;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px}
</style></head>
<body><main>
  <h1>Something went wrong</h1>
  <p>${escapeHtml(message)}</p>
  <a href="${escapeHtml(back)}">Back to the form</a>
</main></body></html>`;
}

/* ---------- helpers ---------- */

async function readBody(request) {
  const ct = request.headers.get("Content-Type") || "";
  if (ct.includes("application/json")) {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  }
  const form = await request.formData();
  const out = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  // strip control characters except newline and tab, collapse CR, trim, cap length
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n\t]+/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function isEmail(s) {
  return typeof s === "string" && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function parseList(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowed) {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  };
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json.success === true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
