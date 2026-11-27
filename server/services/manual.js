const { query } = require('../db/pool');
const PADRAO = require('./manualPadrao');
const { normalizar } = require('./manualRegras');

// Manual do Atlas, guardado em site_settings (chave 'manual'). Só a administração edita.

async function buscarManual() {
  const { rows } = await query(`select valor from site_settings where chave = 'manual'`);
  return { secoes: normalizar({ secoes: rows[0]?.valor?.secoes || PADRAO }) };
}

async function salvarManual(entrada, userId) {
  const valor = { secoes: normalizar(entrada) };
  await query(
    `insert into site_settings (chave, valor, atualizado_em, atualizado_por)
     values ('manual', $1, now(), $2)
     on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = excluded.atualizado_por`,
    [JSON.stringify(valor), userId]
  );
  return valor;
}

module.exports = { buscarManual, salvarManual, normalizar };
