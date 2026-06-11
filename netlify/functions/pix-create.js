const https = require("https");

function httpsRequest(url, method, data, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const clientId = process.env.MISTICPAY_CLIENT_ID;
  const clientSecret = process.env.MISTICPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[pix-create] Variáveis MISTICPAY_CLIENT_ID / MISTICPAY_CLIENT_SECRET não configuradas");
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Gateway de pagamento não configurado." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "JSON inválido." }) };
  }

  const { amount, name, document, productName } = body;

  if (!amount || !name) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Campos obrigatórios: amount, name." }) };
  }

  // CPF é obrigatório pela MisticPay
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  if (cpfDigits.length < 11) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "CPF obrigatório para gerar o PIX." }) };
  }

  const transactionId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "";
  const webhookUrl = siteUrl ? `${siteUrl}/.netlify/functions/pix-webhook` : undefined;

  const payload = {
    amount: Number(amount),
    payerName: name,
    payerDocument: cpfDigits,
    transactionId,
    description: productName || "Kit Álbum Copa Do Mundo 2026 Capa Mole + 250 Figurinhas Panini",
    ...(webhookUrl ? { projectWebhook: webhookUrl } : {}),
  };

  console.log("[pix-create] Criando transação:", { transactionId, amount: payload.amount, payerName: payload.payerName });

  try {
    const result = await httpsRequest(
      "https://api.misticpay.com/api/transactions/create",
      "POST",
      payload,
      { ci: clientId, cs: clientSecret }
    );

    console.log("[pix-create] Resposta MisticPay — status:", result.status);
    console.log("[pix-create] Body:", JSON.stringify(result.body));

    if (result.status < 200 || result.status >= 300) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: result.body }),
      };
    }

    const responseBody = result.body;
    const data = responseBody.data || responseBody;

    if (!data) {
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "Resposta inválida do gateway." }) };
    }

    const pixCode = data.copyPaste || data.pixCopiaECola || data.emv || data.brCode || data.pixCode || null;
    const qrCodeBase64 = data.qrCodeBase64 || data.qrcodeBase64 || null;
    const qrCodeImage = data.qrcodeUrl || data.qrCodeUrl || data.qrCodeImage || null;
    const tid = data.transactionId || data.id || data.externalId || transactionId;

    if (!pixCode) {
      console.error("[pix-create] Código PIX não encontrado:", JSON.stringify(data));
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "QR Code PIX não gerado. Verifique as credenciais.", rawResponse: data }),
      };
    }

    console.log("[pix-create] PIX gerado:", { tid, preview: pixCode.slice(0, 30) });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        transactionId: tid,
        status: data.transactionState || data.status || "PENDENTE",
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage: qrCodeImage || null,
      }),
    };
  } catch (err) {
    console.error("[pix-create] Erro:", err);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "Erro de comunicação com o gateway." }) };
  }
};
