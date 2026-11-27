const { query } = require('../db/pool');
const { mediaUrl } = require('./mediaStorage');
const { PADRAO, normalizar, FONTES, FORMATOS } = require('./iaAparenciaRegras');

// Aparência do tutor (Atlas), guardada em site_settings, chave 'tutor'.

// Link assinado da imagem é gerado a cada leitura (expira em horas).
function paraCliente(valor) {
  const c = normalizar({ ...PADRAO, ...(valor || {}) });
  return { ...c, mascote: c.mascoteCaminho ? mediaUrl(c.mascoteCaminho) : null };
}

async function buscarAparenciaTutor() {
  const { rows } = await query(`select valor from site_settings where chave = 'tutor'`);
  return paraCliente(rows[0]?.valor);
}

async function salvarAparenciaTutor(entrada, userId) {
  const valor = normalizar(entrada);
  await query(
    `insert into site_settings (chave, valor, atualizado_em, atualizado_por)
     values ('tutor', $1, now(), $2)
     on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = excluded.atualizado_por`,
    [JSON.stringify(valor), userId]
  );
  return paraCliente(valor);
}

module.exports = { FONTES, FORMATOS, PADRAO, normalizar, paraCliente, buscarAparenciaTutor, salvarAparenciaTutor };
