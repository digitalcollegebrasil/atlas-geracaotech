// Adaptador do Google Gemini, pela API generateContent.
const { fetchComPrazo, lerCorpo, erroDoProvedor } = require('../http');

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini 3 e 4 raciocinam no nivel "high" por padrao, e o raciocinio gasta o limite de tokens e o tempo.
// Para o tutor (respostas curtas), usamos "low" salvo se IA_NIVEL_RACIOCINIO disser outra coisa.
function nivelDeRaciocinio(modelo, configurado) {
  if (configurado) return configurado;
  return /gemini-[34]/.test(modelo) ? 'low' : '';
}

async function chamar({ chave, modelo, baseUrl, sistema, mensagens, maxTokens, timeoutMs, fetchImpl, raciocinio }) {
  const corpo = {
    contents: mensagens.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens },
  };
  const nivel = nivelDeRaciocinio(modelo, raciocinio);
  if (nivel) corpo.generationConfig.thinkingConfig = { thinkingLevel: nivel };
  if (sistema) corpo.systemInstruction = { parts: [{ text: sistema }] };

  // A chave vai no cabecalho (e nao na URL), para nao aparecer em logs.
  const url = baseUrl || `${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`;
  const resp = await fetchComPrazo(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(corpo),
    },
    timeoutMs
  );
  const dados = await lerCorpo(resp);
  if (!resp.ok) throw erroDoProvedor(resp, dados);

  // Partes marcadas como "thought" são raciocínio interno: não entram na resposta.
  const partes = dados.candidates?.[0]?.content?.parts || [];
  return {
    texto: partes.filter((p) => !p.thought).map((p) => p.text || '').join(''),
    tokensEntrada: dados.usageMetadata?.promptTokenCount ?? null,
    tokensSaida: dados.usageMetadata?.candidatesTokenCount ?? null,
  };
}

module.exports = { chamar };
