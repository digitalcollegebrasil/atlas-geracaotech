const { gerarResposta, IaErro } = require('../services/ia');
const { montarSistemaTutor, textoDeHtml } = require('../services/ia/tutor');
const { calcularEstado } = require('../services/ia/estado');
const { registrarUso, lerLigada, salvarLigada, lerAula } = require('../db/iaRepo');

const MAX_PERGUNTA = 2000;
const MAX_ID_AULA = 200;
// Histórico da conversa com o tutor: só as últimas trocas, com tamanho limitado (é o cliente que envia).
const MAX_MENSAGENS_HISTORICO = 12;
const MAX_CARACTERES_HISTORICO = 2000;

function historicoSeguro(entrada) {
  if (!Array.isArray(entrada)) return [];
  const limpo = entrada
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MENSAGENS_HISTORICO)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CARACTERES_HISTORICO) }));
  // A conversa precisa começar com a fala do aluno.
  while (limpo.length && limpo[0].role !== 'user') limpo.shift();
  return limpo;
}

// Se o banco falhar, a IA aparece como desligada (o site continua funcionando).
async function ligadaNoPainel() {
  try {
    return await lerLigada();
  } catch (erro) {
    return false;
  }
}

// GET /api/ia/estado -> { ligada, configurada, motivo, provedor, modulos: { tutor } }
exports.estado = async (req, res) => {
  res.json(calcularEstado({ ligadaNoPainel: await ligadaNoPainel() }));
};

// PUT /api/ia/estado  { ligada: boolean }  (so administracao)
exports.definirEstado = async (req, res) => {
  const ligada = req.body?.ligada;
  if (typeof ligada !== 'boolean') {
    throw new IaErro('entrada', 'Informe "ligada" como true ou false.', 400);
  }
  await salvarLigada(ligada, req.user && req.user.id);
  res.json(calcularEstado({ ligadaNoPainel: ligada }));
};

// POST /api/ia/tutor  { pergunta, aulaId }  -> { resposta }
// O material da aula e lido no servidor pelo ID; o cliente nao envia texto.
// O ID da aula e texto (lessons.id e text), entao nao e convertido para numero.
exports.tutor = async (req, res) => {
  const estado = calcularEstado({ ligadaNoPainel: await ligadaNoPainel() });
  if (!estado.modulos.tutor) {
    throw new IaErro('desativado', 'O assistente de IA não está disponível agora.', 503);
  }

  const { pergunta, aulaId } = req.body || {};

  if (typeof pergunta !== 'string' || !pergunta.trim()) {
    throw new IaErro('entrada', 'Escreva a sua pergunta.', 400);
  }
  if (pergunta.length > MAX_PERGUNTA) {
    throw new IaErro('entrada', `A pergunta pode ter até ${MAX_PERGUNTA} caracteres.`, 400);
  }
  const id = typeof aulaId === 'string' ? aulaId.trim() : '';
  if (!id || id.length > MAX_ID_AULA) {
    throw new IaErro('entrada', 'Informe a aula.', 400);
  }
  const aula = await lerAula(id);
  if (!aula) {
    throw new IaErro('entrada', 'Aula não encontrada.', 404);
  }
  const material = `${aula.title || ''}\n${textoDeHtml(aula.content)}`;

  const usuarioId = req.user && req.user.id;
  try {
    const r = await gerarResposta({
      modulo: 'tutor',
      sistema: montarSistemaTutor(material),
      mensagens: [...historicoSeguro(req.body?.historico), { role: 'user', content: pergunta }],
    });
    // Alguns provedores devolvem 200 sem texto (ex.: limite de tokens); avisa em vez de resposta vazia.
    if (!r.texto || !r.texto.trim()) {
      // Diagnóstico: tokensSaida no limite => corte por tamanho; zero => o provedor não gerou texto.
      console.warn('[ia/tutor] resposta vazia', {
        provedor: r.provedor, modelo: r.modelo, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida,
      });
      throw new IaErro('vazio', 'O assistente não conseguiu responder desta vez. Tente reformular a pergunta.', 502);
    }
    await registrarUso({
      usuarioId, modulo: 'tutor', provedor: r.provedor, modelo: r.modelo,
      status: 'ok', tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida,
    }).catch(() => {});
    return res.json({ resposta: r.texto });
  } catch (erro) {
    const codigo = erro instanceof IaErro ? erro.codigo : 'erro';
    if (codigo !== 'entrada') {
      await registrarUso({
        usuarioId, modulo: 'tutor', provedor: process.env.IA_PROVEDOR, modelo: process.env.IA_MODELO,
        status: 'erro', codigoErro: codigo,
      }).catch(() => {});
    }
    throw erro;
  }
};
