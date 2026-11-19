require("dotenv").config();
const auth = "Basic " + Buffer.from(process.env.MAYA_SECRET_KEY + ":").toString("base64");
const base = process.env.MAYA_BASE_URL;
const h = { "Content-Type": "application/json", Authorization: auth };
(async () => {
  const existing = await (await fetch(base + "/checkout/v1/webhooks", { headers: h })).json();
  for (const w of Array.isArray(existing) ? existing : []) await fetch(base + "/checkout/v1/webhooks/" + w.id, { method: "DELETE", headers: h });
  const url = process.env.PUBLIC_API_URL + "/api/v1/webhooks/maya?token=" + process.env.MAYA_WEBHOOK_TOKEN;
  for (const name of ["CHECKOUT_SUCCESS", "CHECKOUT_FAILURE"]) {
    const r = await fetch(base + "/checkout/v1/webhooks", { method: "POST", headers: h, body: JSON.stringify({ name, callbackUrl: url }) });
    console.log(name, r.status, await r.text());
  }
})();