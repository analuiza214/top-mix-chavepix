import { useState } from "react";
import { Link } from "wouter";
import {
  Search, Package, Truck, CheckCircle, Clock,
  ShieldCheck, ChevronRight, ArrowLeft, MapPin, Box
} from "lucide-react";

// ── Formata data em pt-BR ────────────────────────────────────────────────────
function fmt(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " — "
    + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ── Gera linha do tempo a partir do momento atual (lógica retroativa) ────────
function gerarEtapas(agora: Date) {
  // Simula como se o pedido tivesse sido feito 5h atrás
  const confirmado = new Date(agora.getTime() - 5 * 60 * 60 * 1000);  // 5h atrás → Confirmado
  const separacao  = new Date(agora.getTime() - 3 * 60 * 60 * 1000);  // 3h atrás → Em Separação
  const embalagem  = new Date(agora.getTime() - 1 * 60 * 60 * 1000);  // 1h atrás → Em Embalagem
  const entrega    = addDays(agora, 3);                                 // +3 dias  → Previsão entrega

  return {
    etapas: [
      {
        icone: CheckCircle,
        label: "Pedido Confirmado",
        descricao: "Pagamento recebido e pedido registrado.",
        data: fmt(confirmado),
        ok: true,
      },
      {
        icone: Box,
        label: "Em Separação",
        descricao: "Seu produto está sendo separado no estoque.",
        data: fmt(separacao),
        ok: true,
      },
      {
        icone: Package,
        label: "Em Embalagem",
        descricao: "O produto está sendo embalado com cuidado para envio.",
        data: fmt(embalagem),
        ok: true,
      },
      {
        icone: Truck,
        label: "Enviado / Em Trânsito",
        descricao: "Pedido entregue aos Correios e a caminho de você.",
        data: `Previsão: ${entrega.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
        ok: false,
      },
      {
        icone: MapPin,
        label: "Saiu para Entrega",
        descricao: "O pedido está com o entregador e chegará em breve.",
        data: `Previsão: ${entrega.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
        ok: false,
      },
    ],
    previsao: entrega.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric"
    }),
  };
}

// ── Valida formato do código TM ───────────────────────────────────────────────
function codigoValido(cod: string): boolean {
  return /^TM[A-Z0-9]{6,10}$/i.test(cod.trim().replace(/[-\s]/g, ""));
}

export default function RastrearPedido() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<ReturnType<typeof gerarEtapas> | null>(null);
  const [codigoExibido, setCodigoExibido] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  function handleRastrear(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const cod = codigo.trim();
    if (!cod) return;

    if (!codigoValido(cod)) {
      setErro("Código inválido. Use o código enviado pela Top Mix, ex: TM2A3B4C5D");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCodigoExibido(cod.toUpperCase());
      setResultado(gerarEtapas(new Date()));
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Voltar à Loja
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Rastrear Pedido</h1>
          <p className="text-sm text-gray-500 mt-1">Digite o código enviado pela Top Mix para ver o status da entrega.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Formulário */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <form onSubmit={handleRastrear} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={codigo}
                onChange={e => { setCodigo(e.target.value); setErro(""); }}
                placeholder="Ex: TM2A3B4C5D"
                className={`w-full pl-9 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${erro ? "border-red-400" : "border-gray-200"}`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl font-black text-sm text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #15803d, #22c55e)" }}
            >
              {loading ? "Buscando..." : "RASTREAR"}
            </button>
          </form>
          {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
            {/* Cabeçalho do pedido */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Pedido</p>
                <p className="font-black text-lg text-gray-900">{codigoExibido}</p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700">
                📦 Em Processamento
              </span>
            </div>

            {/* Linha do tempo */}
            <div className="space-y-0">
              {resultado.etapas.map((etapa, i) => {
                const Icon = etapa.icone;
                const isLast = i === resultado.etapas.length - 1;
                return (
                  <div key={i} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${etapa.ok ? "bg-green-500" : "bg-gray-200"}`}>
                        <Icon className={`h-4 w-4 ${etapa.ok ? "text-white" : "text-gray-400"}`} />
                      </div>
                      {!isLast && (
                        <div
                          className={`w-0.5 flex-1 my-1 ${etapa.ok ? "bg-green-300" : "bg-gray-200"}`}
                          style={{ minHeight: 28 }}
                        />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-bold ${etapa.ok ? "text-gray-900" : "text-gray-400"}`}>
                        {etapa.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{etapa.descricao}</p>
                      <p className={`text-xs mt-0.5 font-semibold ${etapa.ok ? "text-green-600" : "text-gray-400"}`}>
                        {etapa.data}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Previsão de entrega */}
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <strong>Previsão de entrega:</strong> até {resultado.previsao}. Fique atento — entregas podem variar conforme a região.
            </div>
          </div>
        )}

        {/* Onde encontro meu código */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-gray-900 mb-4">Onde encontro meu código?</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              "No WhatsApp — enviamos o código assim que o pedido for confirmado",
              "O código começa sempre com TM seguido de letras e números",
              "Dúvidas? Fale conosco pelo WhatsApp (83) 99331-8120",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center text-sm text-gray-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          Não encontrou? <Link href="/fale-conosco" className="text-yellow-600 font-bold hover:underline ml-1">Entre em contato</Link>
        </div>
      </div>
    </div>
  );
}