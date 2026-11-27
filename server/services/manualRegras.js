const { randomUUID } = require('crypto');
const httpError = require('../utils/httpError');

// Regras do manual (sem banco): limites e validação do conteúdo enviado pela administração.
const MAX_SECOES = 30;
const MAX_PERGUNTAS = 60;
const MAX_LINKS = 10;

function texto(valor, max, nome) {
  const t = String(valor ?? '').trim();
  if (!t) throw httpError(400, `${nome} não pode ficar vazio.`);
  if (t.length > max) throw httpError(400, `${nome} pode ter no máximo ${max} caracteres.`);
  return t;
}

function link(item) {
  const to = String(item?.to ?? '').trim();
  if (!/^\/[^\s]*$/.test(to) || to.startsWith('//')) {
    throw httpError(400, 'Os links do manual devem começar com / (exemplo: /cursos).');
  }
  return { to: to.slice(0, 200), label: texto(item.label, 80, 'O texto do link') };
}

function idDe(valor) {
  const id = String(valor || '').slice(0, 40);
  return id || randomUUID();
}

function normalizar(entrada) {
  if (!Array.isArray(entrada?.secoes)) throw httpError(400, 'Manual inválido.');
  if (entrada.secoes.length > MAX_SECOES) throw httpError(400, `O manual pode ter no máximo ${MAX_SECOES} seções.`);
  return entrada.secoes.map((secao) => {
    const perguntas = Array.isArray(secao?.perguntas) ? secao.perguntas : [];
    if (perguntas.length > MAX_PERGUNTAS) throw httpError(400, `Cada seção pode ter no máximo ${MAX_PERGUNTAS} perguntas.`);
    return {
      id: idDe(secao.id),
      titulo: texto(secao.titulo, 80, 'O título da seção'),
      perguntas: perguntas.map((item) => {
        const links = Array.isArray(item?.links) ? item.links : [];
        if (links.length > MAX_LINKS) throw httpError(400, `Cada pergunta pode ter no máximo ${MAX_LINKS} links.`);
        return {
          id: idDe(item.id),
          p: texto(item.p, 160, 'A pergunta'),
          r: texto(item.r, 2000, 'A resposta'),
          links: links.map(link)
        };
      })
    };
  });
}

module.exports = { normalizar };
