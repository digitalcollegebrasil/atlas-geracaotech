const atendimento = require('../db/atendimentoRepo');
const httpError = require('../utils/httpError');
const { query } = require('../db/pool');

const LIMITE_ANEXO = 2 * 1024 * 1024; // 2 MB, como no sistema de frequência do GT.
const TIPOS = {
  'image/png': (b) => b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/jpeg': (b) => b.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/gif': (b) => b.slice(0, 4).toString('latin1') === 'GIF8',
  'image/webp': (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.slice(0, 4).toString('latin1') === '%PDF'
};

// Confere o tipo pelo conteúdo (não só pela extensão) e o tamanho antes de guardar.
function anexoValido(body) {
  const nome = String(body?.nome || '').replace(/[\\/\r\n\t]/g, '').trim().slice(0, 160);
  if (!nome) throw httpError(400, 'Informe o nome do arquivo.');
  const tipo = String(body?.tipo || '').toLowerCase();
  const verifica = TIPOS[tipo];
  if (!verifica) throw httpError(400, 'Envie imagem (PNG, JPG, GIF ou WEBP) ou PDF.');
  const base64 = String(body?.dados || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) throw httpError(400, 'Arquivo vazio.');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw httpError(400, 'Arquivo vazio.');
  if (buffer.length > LIMITE_ANEXO) throw httpError(400, 'O arquivo pode ter no máximo 2 MB.');
  if (!verifica(buffer)) throw httpError(400, 'O conteúdo do arquivo não confere com o tipo informado.');
  return { nome, tipo, tamanho: buffer.length, dados: buffer.toString('base64') };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textoValido(valor) {
  const texto = String(valor || '').trim();
  if (!texto) throw httpError(400, 'Escreva uma mensagem antes de enviar.');
  if (texto.length > 1000) throw httpError(400, 'A mensagem pode ter no máximo 1000 caracteres.');
  return texto;
}

// Canais de conversa: atendimento geral e monitoria (assuntos técnicos).
const CANAIS = ['atendimento', 'monitoria'];

// Canal pedido pelo aluno (na consulta ou no corpo). Padrão: atendimento geral.
function canalDoAluno(req) {
  const canal = String(req.query?.canal || req.body?.canal || 'atendimento');
  if (!CANAIS.includes(canal)) throw httpError(400, 'Canal inválido.');
  return canal;
}

// Equipe atende só o próprio canal: a monitoria fala com o monitor; o atendimento, com o atendente.
// A administração acompanha os dois.
function podeAtenderCanal(user, canal) {
  if (user.role === 'monitor') return canal === 'monitoria';
  if (user.role === 'atendente') return canal === 'atendimento';
  return true;
}

// Conversa da equipe, só se o canal dela for o que quem pede atende.
async function sessaoDaEquipe(req) {
  if (!UUID.test(req.params.id)) throw httpError(404, 'Atendimento não encontrado.');
  const sessao = await atendimento.detalheSessao(req.params.id);
  if (!sessao || !podeAtenderCanal(req.user, sessao.canal)) throw httpError(404, 'Atendimento não encontrado.');
  return sessao;
}

function desdeDe(query) {
  const n = Number(query.desde || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── Anexos ─────────────────────────────────────────────────────────────

// Mostra ou baixa um anexo. Aluno só vê a própria conversa; equipe vê todas.
exports.abrirAnexo = async (req, res) => {
  const mensagemId = Number(req.params.id);
  if (!Number.isInteger(mensagemId)) throw httpError(404, 'Anexo não encontrado.');
  const anexo = await atendimento.anexoDaMensagem(mensagemId);
  if (!anexo) throw httpError(404, 'Anexo não encontrado.');
  // Equipe (atendente e monitor) e administração podem abrir anexos das conversas que atendem.
  const equipe = ['admin', 'atendente', 'monitor'].includes(req.user.role);
  if (!equipe && anexo.user_id !== req.user.id) throw httpError(404, 'Anexo não encontrado.');
  res.set('Content-Type', anexo.anexo_tipo);
  res.set('Content-Disposition', `inline; filename="${anexo.anexo_nome.replace(/"/g, '')}"`);
  res.set('Cache-Control', 'private, max-age=3600');
  return res.send(Buffer.from(anexo.anexo_dados, 'base64'));
};

exports.anexoAluno = async (req, res) => {
  const anexo = anexoValido(req.body);
  const sessao = await atendimento.sessaoDoAluno(req.user.id, canalDoAluno(req));
  const mensagem = await atendimento.anexoDoAluno(sessao, anexo);
  return res.status(201).json({ mensagem });
};

exports.anexoEquipe = async (req, res) => {
  const anexo = anexoValido(req.body);
  const sessao = await sessaoDaEquipe(req);
  if (sessao.status === 'finalizado') throw httpError(409, 'Este atendimento já foi finalizado.');
  const mensagem = await atendimento.anexoDaEquipe(req.params.id, req.user.id, anexo);
  return res.status(201).json({ mensagem });
};

// ── Aluno ──────────────────────────────────────────────────────────────

// Sessão do aluno com mensagens novas (?desde=id) e os assuntos prontos do robô.
exports.sessaoAluno = async (req, res) => {
  const canal = canalDoAluno(req);
  const sessao = await atendimento.sessaoDoAluno(req.user.id, canal);
  const mensagens = await atendimento.mensagensDepois(sessao.id, desdeDe(req.query));
  const topicos = sessao.status === 'bot' ? (await atendimento.faqAtivas(canal)).map((f) => ({ id: f.id, titulo: f.titulo })) : [];
  await query('update atendimento_sessoes set nao_lidas_aluno = 0 where id = $1', [sessao.id]);
  return res.json({
    sessao: { id: sessao.id, status: sessao.status, canal, atendente: sessao.atendente_id ? (canal === 'monitoria' ? 'Monitoria Geração Tech' : 'Equipe Geração Tech') : null },
    mensagens,
    topicos
  });
};

exports.enviarMensagemAluno = async (req, res) => {
  const texto = textoValido(req.body?.texto);
  const sessao = await atendimento.sessaoDoAluno(req.user.id, canalDoAluno(req));
  await atendimento.enviarMensagemAluno(sessao, texto);
  return res.status(201).json({ ok: true });
};

exports.escolherAssunto = async (req, res) => {
  const faqId = String(req.body?.faqId || '');
  if (!UUID.test(faqId)) throw httpError(400, 'Assunto inválido.');
  const sessao = await atendimento.sessaoDoAluno(req.user.id, canalDoAluno(req));
  const resultado = await atendimento.escolherAssunto(sessao, faqId);
  if (resultado === 'nao_encontrado') throw httpError(404, 'Assunto não encontrado.');
  if (resultado === 'com_equipe') throw httpError(409, 'Sua conversa já está com a equipe. Escreva sua mensagem por aqui.');
  return res.status(201).json({ ok: true });
};

exports.falarComEquipe = async (req, res) => {
  const sessao = await atendimento.sessaoDoAluno(req.user.id, canalDoAluno(req));
  const resultado = await atendimento.pedirEquipe(sessao);
  if (resultado === 'ja_transferida') throw httpError(409, 'Sua conversa já foi encaminhada para a equipe.');
  return res.status(201).json({ ok: true });
};

// ── Gestão ─────────────────────────────────────────────────────────────

exports.resumoGestao = async (req, res) => res.json({ resumo: await atendimento.resumoGestao() });

// Monitor vê só a monitoria; atendente, o atendimento; administração escolhe o canal.
function canalDaEquipe(req) {
  if (req.user.role === 'monitor') return 'monitoria';
  if (req.user.role === 'atendente') return 'atendimento';
  const canal = String(req.query?.canal || 'atendimento');
  if (!CANAIS.includes(canal)) throw httpError(400, 'Canal inválido.');
  return canal;
}

exports.listarSessoes = async (req, res) => {
  return res.json({ sessoes: await atendimento.listarSessoes(String(req.query.filtro || 'abertos'), canalDaEquipe(req)) });
};

exports.detalheSessao = async (req, res) => {
  const sessao = await sessaoDaEquipe(req);
  const mensagens = await atendimento.mensagensDepois(sessao.id, desdeDe(req.query), 500);
  // Quem só acompanha (administração) não zera as mensagens novas da fila do atendente.
  if (!desdeDe(req.query) && req.user.role === 'atendente') await atendimento.marcarLidaPelaGestao(sessao.id);
  return res.json({ sessao, mensagens });
};

exports.responder = async (req, res) => {
  await sessaoDaEquipe(req);
  const texto = textoValido(req.body?.texto);
  const resultado = await atendimento.responderComoEquipe(req.params.id, req.user.id, texto);
  if (resultado === 'nao_encontrada') throw httpError(404, 'Atendimento não encontrado.');
  if (resultado === 'finalizada') throw httpError(409, 'Este atendimento já foi finalizado.');
  return res.status(201).json({ mensagem: resultado });
};

exports.finalizar = async (req, res) => {
  await sessaoDaEquipe(req);
  const ok = await atendimento.finalizarSessao(req.params.id);
  if (!ok) throw httpError(409, 'Este atendimento já foi finalizado ou não existe.');
  return res.json({ status: 'finalizado' });
};

exports.arquivar = async (req, res) => {
  await sessaoDaEquipe(req);
  const ok = await atendimento.arquivarSessao(req.params.id);
  if (!ok) throw httpError(409, 'Só é possível arquivar um atendimento já finalizado.');
  return res.json({ status: 'arquivado' });
};

// Encaminha a conversa para o outro canal: atendente manda para a monitoria; monitor manda para o atendimento.
exports.encaminhar = async (req, res) => {
  const sessao = await sessaoDaEquipe(req);
  const destino = req.user.role === 'monitor' ? 'atendimento' : 'monitoria';
  const resultado = await atendimento.encaminharParaCanal(sessao, destino);
  if (resultado === 'finalizada') throw httpError(409, 'Este atendimento já foi finalizado.');
  if (resultado === 'ja_no_destino') throw httpError(409, 'Esta conversa já está nesse canal.');
  return res.json({ status: destino });
};

// ── Perguntas frequentes (administração) ───────────────────────────────

function dadosFaq(body) {
  const titulo = String(body?.titulo || '').trim();
  const resposta = String(body?.resposta || '').trim();
  const palavras = String(body?.palavras || '').split(',').map((p) => p.trim()).filter(Boolean).join(',');
  if (!titulo || titulo.length > 160) throw httpError(400, 'Informe o título da pergunta (até 160 caracteres).');
  if (!resposta || resposta.length > 4000) throw httpError(400, 'Informe a resposta (até 4000 caracteres).');
  if (!palavras) throw httpError(400, 'Informe ao menos uma palavra-chave separada por vírgula.');
  return {
    titulo,
    resposta,
    palavras: palavras.slice(0, 1000),
    ativo: Boolean(body?.ativo),
    revisado: Boolean(body?.revisado),
    canal: CANAIS.includes(body?.canal) ? body.canal : 'atendimento',
    ordem: Number.isFinite(Number(body?.ordem)) ? Math.trunc(Number(body.ordem)) : 0
  };
}

exports.listarFaq = async (req, res) => res.json({ faq: await atendimento.listarFaq(canalDeQuery(req)) });

// Canal informado na consulta (atendimento por padrão).
function canalDeQuery(req) {
  const canal = String(req.query?.canal || 'atendimento');
  if (!CANAIS.includes(canal)) throw httpError(400, 'Canal inválido.');
  return canal;
}

exports.criarFaq = async (req, res) => res.status(201).json({ item: await atendimento.salvarFaq(null, dadosFaq(req.body)) });

exports.atualizarFaq = async (req, res) => {
  if (!UUID.test(req.params.id)) throw httpError(404, 'Pergunta não encontrada.');
  const item = await atendimento.salvarFaq(req.params.id, dadosFaq(req.body));
  if (!item) throw httpError(404, 'Pergunta não encontrada.');
  return res.json({ item });
};

exports.removerFaq = async (req, res) => {
  if (!UUID.test(req.params.id)) throw httpError(404, 'Pergunta não encontrada.');
  if (!(await atendimento.removerFaq(req.params.id))) throw httpError(404, 'Pergunta não encontrada.');
  return res.json({ ok: true });
};
