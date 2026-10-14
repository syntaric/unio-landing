// Smoke test for the contact worker. Runs under plain Node, no Cloudflare
// runtime needed: it stubs fetch() so no email is sent.
//   cd worker && npm test

import worker from "../src/index.js";

const env = {
  ALLOWED_ORIGINS: "https://unio.syntaric.com",
  TO_EMAIL: "info@syntaric.com",
  FROM_EMAIL: "Unio website <noreply@syntaric.com>",
  REDIRECT_URL: "https://unio.syntaric.com/thanks.html",
  RESEND_API_KEY: "re_test_key",
};

let resendCalls = [];
globalThis.fetch = async (url, init) => {
  resendCalls.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ id: "test" }), { status: 200 });
};

function formRequest(fields, headers = {}) {
  const body = new URLSearchParams(fields);
  return new Request("https://unio-contact.example.workers.dev/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://unio.syntaric.com",
      Accept: "text/html",
      ...headers,
    },
    body,
  });
}

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

const good = { kind: "A demonstration for a region or hospital group", name: "Test Person", org: "Example Hospital", email: "test@example.org", message: "Hello" };

// 1. valid submission redirects and sends one email
resendCalls = [];
let res = await worker.fetch(formRequest(good), env);
check("valid form → 303 to thanks page", res.status === 303 && res.headers.get("Location") === env.REDIRECT_URL, String(res.status));
check("valid form → one email via Resend", resendCalls.length === 1 && resendCalls[0].url === "https://api.resend.com/emails");
check("email has reply_to and subject", resendCalls[0]?.body.reply_to === good.email && /Test Person/.test(resendCalls[0]?.body.subject));
check("email body carries the message", /Hello/.test(resendCalls[0]?.body.text));

// 2. honeypot filled → pretend success, send nothing
resendCalls = [];
res = await worker.fetch(formRequest({ ...good, _gotcha: "http://spam" }), env);
check("honeypot → 303 but no email", res.status === 303 && resendCalls.length === 0);

// 3. missing name / bad email → 400 error page
resendCalls = [];
res = await worker.fetch(formRequest({ ...good, name: "", email: "nope" }), env);
check("invalid fields → 400 html", res.status === 400 && (res.headers.get("Content-Type") || "").includes("text/html") && resendCalls.length === 0);

// 4. wrong origin → 403
res = await worker.fetch(formRequest(good, { Origin: "https://evil.example" }), env);
check("foreign origin → 403", res.status === 403);

// 5. JSON in, JSON out
resendCalls = [];
res = await worker.fetch(
  new Request("https://unio-contact.example.workers.dev/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://unio.syntaric.com" },
    body: JSON.stringify(good),
  }),
  env
);
const json = await res.json();
check("json → 200 {ok:true} with CORS header", res.status === 200 && json.ok === true && res.headers.get("Access-Control-Allow-Origin") === "https://unio.syntaric.com");

// 6. Resend failure → 502
globalThis.fetch = async () => new Response("boom", { status: 500 });
res = await worker.fetch(formRequest(good), env);
check("resend failure → 502", res.status === 502);

// 7. GET → 405, OPTIONS → 204
res = await worker.fetch(new Request("https://x/", { method: "GET" }), env);
check("GET → 405", res.status === 405);
res = await worker.fetch(new Request("https://x/", { method: "OPTIONS", headers: { Origin: "https://unio.syntaric.com" } }), env);
check("OPTIONS → 204", res.status === 204);

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
