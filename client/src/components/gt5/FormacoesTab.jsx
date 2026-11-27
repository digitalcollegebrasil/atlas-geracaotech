import { useEffect, useState } from 'react';
import { listarFormacoes, atualizarFormacao } from '../../services/gt5';
import { errorText } from '../manage/shared';

// Uma formação: carga horária e duração. Vazias enquanto não informadas; nada é assumido.
function LinhaFormacao({ formacao, onSalvo, onFeedback }) {
  const [carga, setCarga] = useState(formacao.carga_horaria ?? '');
  const [duracao, setDuracao] = useState(formacao.duracao_semanas ?? '');
  const [salvando, setSalvando] = useState(false);
  const mudou = String(carga) !== String(formacao.carga_horaria ?? '') || String(duracao) !== String(formacao.duracao_semanas ?? '');

  async function salvar(event) {
    event.preventDefault();
    setSalvando(true);
    try {
      await atualizarFormacao(formacao.id, { carga_horaria: carga, duracao_semanas: duracao });
      onFeedback({ type: 'success', text: `${formacao.title}: dados salvos.` });
      onSalvo();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{formacao.title}</strong>
        {!formacao.visible && <span className="badge hidden gt5-badge">oculta no site</span>}
      </td>
      <td>
        <form className="gt5-acoes-grupo" onSubmit={salvar}>
          <label className="gt5-campo">
            <span>Carga horária (h)</span>
            <input className="gt5-num" type="number" min="1" placeholder="não informada" value={carga} onChange={(e) => setCarga(e.target.value)} />
          </label>
          <label className="gt5-campo">
            <span>Duração (semanas)</span>
            <input className="gt5-num" type="number" min="1" placeholder="não informada" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
          </label>
          <button type="submit" className="primary-button small" disabled={!mudou || salvando}>Salvar</button>
        </form>
      </td>
    </tr>
  );
}

export default function FormacoesTab({ onFeedback }) {
  const [formacoes, setFormacoes] = useState(null);

  const carregar = () => listarFormacoes().then((dados) => setFormacoes(dados.formacoes));

  useEffect(() => {
    carregar().catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!formacoes) return <p className="gt5-vazio">Carregando formações…</p>;

  return (
    <section className="gt5-card">
      <div>
        <h2>Formações da edição 5.0</h2>
        <p className="gt5-nota">Vêm do documento GT 5.0. Preencha carga horária e duração quando a informação for definida.</p>
      </div>
      <div className="table-wrap">
        <table className="manage-table">
          <thead>
            <tr>
              <th>Formação</th>
              <th>Carga horária e duração</th>
            </tr>
          </thead>
          <tbody>
            {formacoes.map((f) => (
              <LinhaFormacao key={f.id} formacao={f} onFeedback={onFeedback} onSalvo={carregar} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
