// Regras da aparência do tutor (sem banco, testáveis).
// Só valores desta lista são aceitos: a gestão escolhe, nunca digita CSS.
const httpError = require('../utils/httpError');

const FONTES = ['sistema', 'inter', 'roboto', 'lora'];
const FORMATOS = ['quadrado', 'arredondado', 'pilula'];
const PADRAO = {
  nome: 'Atlas',
  mascoteCaminho: null, // null = gif padrão do Atlas
  corFundo: '#eef6fb',
  corDestaque: '#2a6f97',
  fonte: 'sistema',
  formato: 'arredondado',
};

function cor(valor, padrao) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  if (typeof valor !== 'string' || !/^#[0-9a-f]{6}$/i.test(valor)) {
    throw httpError(400, 'Cor inválida. Use o formato #RRGGBB.');
  }
  return valor.toLowerCase();
}

function normalizar(entrada = {}) {
  const nome = typeof entrada.nome === 'string' ? entrada.nome.trim() : PADRAO.nome;
  if (!nome || nome.length > 40) throw httpError(400, 'O nome do tutor deve ter de 1 a 40 caracteres.');
  const caminho = entrada.mascoteCaminho || null;
  if (caminho !== null && (typeof caminho !== 'string' || caminho.length > 300 || !/^[\w\-/.]+$/.test(caminho) || caminho.includes('..'))) {
    throw httpError(400, 'Imagem do tutor inválida.');
  }
  return {
    nome,
    mascoteCaminho: caminho,
    corFundo: cor(entrada.corFundo, PADRAO.corFundo),
    corDestaque: cor(entrada.corDestaque, PADRAO.corDestaque),
    fonte: FONTES.includes(entrada.fonte) ? entrada.fonte : PADRAO.fonte,
    formato: FORMATOS.includes(entrada.formato) ? entrada.formato : PADRAO.formato,
  };
}

module.exports = { FONTES, FORMATOS, PADRAO, normalizar };
