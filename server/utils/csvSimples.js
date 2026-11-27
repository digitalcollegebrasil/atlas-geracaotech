const httpError = require('./httpError');

// Lê CSV (vírgula ou ponto e vírgula, com aspas) e devolve linhas como objetos.
// Cabeçalho desconhecido vira erro: a planilha não pode ter coluna que o sistema ignore em silêncio.
function lerCsvComColunas(texto, colunasAceitas) {
  if (typeof texto !== 'string' || !texto.trim()) throw httpError(400, 'A planilha está vazia.');
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const separador = linhas[0].includes(';') && !linhas[0].includes(',') ? ';' : ',';

  const campos = (linha) => {
    const out = [];
    let atual = '';
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (aspas) {
        if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
        else if (c === '"') aspas = false;
        else atual += c;
      } else if (c === '"') aspas = true;
      else if (c === separador) { out.push(atual.trim()); atual = ''; }
      else atual += c;
    }
    out.push(atual.trim());
    return out;
  };

  const cabecalho = campos(linhas[0]).map((c) => c.toLowerCase());
  const desconhecidas = cabecalho.filter((c) => !colunasAceitas.includes(c));
  if (desconhecidas.length) throw httpError(400, `Colunas não reconhecidas: ${desconhecidas.join(', ')}.`);
  if (linhas.length < 2) throw httpError(400, 'A planilha não tem linhas de registro.');

  return linhas.slice(1).map((linha, i) => {
    const valores = campos(linha);
    const obj = { _linha: i + 2 };
    cabecalho.forEach((coluna, j) => { obj[coluna] = valores[j] ?? ''; });
    return obj;
  });
}

module.exports = { lerCsvComColunas };
