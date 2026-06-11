const https = require("https");

function httpsRequest(url, method, data, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: method || "GET",
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
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const transactionId = event.queryStringParameters && event.queryStringParameters.transactionId;
  if (!transactionId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "transactionId obrigatório" }) };
  }

  const clientId = process.env.MISTICPAY_CLIENT_ID;
  const clientSecret = process.env.MISTICPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Gateway não configurado" }) };
  }

  console.log("[pix-status] Consultando transação:", transactionId);

  try {
    // Tenta POST com body (forma mais comum da MisticPay)
    const result = await httpsRequest(
      "https://api.misticpay.com/api/transactions/check",
      "POST",
      { transactionId },
      {
        ci: clientId,
        cs: clientSecret,
      }
    );

    console.log("[pix-status] Resposta:", result.status, JSON.stringify(result.body));

    const responseBody = result.body;

    // A resposta pode ter os dados em .data, .transaction, ou diretamente no body
    const transaction =
      (responseBody && responseBody.data) ||
      (responseBody && responseBody.transaction) ||
      responseBody ||
      {};

    const rawStatus = (
      transaction.transactionState ||
      transaction.status ||
      transaction.state ||
      ""
    ).toUpperCase();

    // MisticPay usa: COMPLETO, PAGO, APPROVED, PAID, CONCLUIDO
    const isPaid = ["COMPLETO", "PAGO", "APPROVED", "PAID", "CONCLUIDO", "APROVADO"].includes(rawStatus);
    // Expirado/falha: FALHA, EXPIRADO, EXPIRED, CANCELLED, CANCELADO
    const isExpired = ["FALHA", "EXPIRADO", "EXPIRED", "CANCELLED", "CANCELADO"].includes(rawStatus);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transactionId,
        status: rawStatus,
        isPaid,
        isExpired,
        payedAt: transaction.updatedAt || transaction.paidAt || null,
      }),
    };
  } catch (err) {
    console.error("[pix-status] Erro:", err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
    };
  }
};
