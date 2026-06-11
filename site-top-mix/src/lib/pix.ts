/**
 * Gerador de código PIX estático (EMV/BR Code)
 * Padrão Banco Central do Brasil — sem gateway externo
 */

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase().padStart(4, "0"));
}

export interface PixPayload {
  chave: string;       // chave pix (email, cpf, telefone, EVP)
  nome: string;        // nome do recebedor (máx 25 chars)
  cidade: string;      // cidade do recebedor (máx 15 chars)
  valor?: number;      // valor em reais (undefined = valor livre)
  txid?: string;       // identificador da transação (máx 25 chars)
  descricao?: string;  // descrição opcional (máx 72 chars)
}

export function gerarPixEMV(payload: PixPayload): string {
  const { chave, nome, cidade, valor, txid, descricao } = payload;

  // 26 – Merchant Account Information (GUI + chave)
  const gui = tlv("00", "br.gov.bcb.pix");
  const chaveField = tlv("01", chave);
  const descField = descricao ? tlv("02", descricao.slice(0, 72)) : "";
  const merchantAccount = tlv("26", gui + chaveField + descField);

  // 54 – valor
  const valorField = valor !== undefined
    ? tlv("54", valor.toFixed(2))
    : "";

  // 62 – Additional Data (txid)
  const txidValue = (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const additionalData = tlv("62", tlv("05", txidValue));

  // Monta o payload sem CRC
  const body =
    tlv("00", "01") +           // Payload format indicator
    tlv("01", "12") +           // Point of initiation (12 = único uso, use "11" para reutilizável)
    merchantAccount +
    tlv("52", "0000") +         // MCC (0000 = não especificado)
    tlv("53", "986") +          // Currency (BRL = 986)
    valorField +
    tlv("58", "BR") +           // Country code
    tlv("59", nome.slice(0, 25).padEnd(1)) +
    tlv("60", cidade.slice(0, 15).padEnd(1)) +
    additionalData +
    "6304";                     // CRC tag (valor calculado abaixo)

  return body + crc16(body);
}
