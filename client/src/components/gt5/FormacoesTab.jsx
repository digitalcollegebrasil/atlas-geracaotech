import { useEffect, useState } from 'react';
import { listarFormacoes, atualizarFormacao } from '../../services/gt5';
import { errorText } from '../manage/shared';

// Formações da edição 5.0. Carga horária e duração podem ficar vazias: o documento não informa para duas formações.
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
        {!formacao.visible && <span className="gt5-marca">oculta no site</span>}
      </td>
      <td>
        <form className="gt5-linha-form" onSubmit={salvar}>
          <input
            type="number"
            min="1"
            aria-label={`Carga horária de ${formacao.title}`}
            placeholder="não informada"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
          />
          <span className="gt5-unidade">horas</span>
          <input
            type="number"
            min="1"
            aria-label={`Duração de ${formacao.title}`}
            placeholder="não informada"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
          />
          <span className="gt5-unidade">semanas</span>
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
    <section className="gt5-secao">
      <p className="gt5-ajuda">
        As formações vêm do documento GT 5.0. Aqui você preenche carga horária e duração. Enquanto estiverem em branco, nada é assumido.
      </p>
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
    </section>
  );
}
