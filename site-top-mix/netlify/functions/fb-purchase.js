const https = require("https");
const crypto = require("crypto");

function hash(str) {
  return crypto.createHash("sha256").update(str.trim().toLowerCase()).digest("hex");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };
  }

  const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
  const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

  if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Pixel nao configurado" }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON invalido" }) }; }

  const { user_data, custom_data } = payload;

  const fbPayload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: {
        em: user_data?.em ? [hash(user_data.em[0])] : undefined,
        ph: user_data?.ph || undefined,
        fn: user_data?.fn || undefined,
        ln: user_data?.ln || undefined,
      },
      custom_data: custom_data || {},
    }],
  };

  const url = `https://graph.facebook.com/v19.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;
  const body = JSON.stringify(fbPayload);

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        console.log("FB CAPI response:", res.statusCode, d);
        resolve({ statusCode: 200, headers, body: JSON.stringify({ ok: true }) });
      });
    });
    req.on("error", (e) => resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }));
    req.write(body);
    req.end();
  });
};
