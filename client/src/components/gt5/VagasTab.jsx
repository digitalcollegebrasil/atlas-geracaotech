import { useEffect, useState } from 'react';
import { listarFormacoes, atualizarFormacao, atualizarConfiguracaoGt5 } from '../../services/gt5';
import { errorText } from '../manage/shared';
import { resumoVagas, vagasConferem } from './gt5Format';

// Uma linha de vagas. A quantidade ocupada aparece como informação; quem edita é a gestão, só o total e a distribuição.
function LinhaVagas({ formacao, onSalvo, onFeedback }) {
  const inicial = {
    total: formacao.vagas.total,
    online: formacao.vagas.online.total,
    fortaleza: formacao.vagas.fortaleza.total,
    interior: formacao.vagas.interior.total,
  };
  const [valores, setValores] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const mudou = Object.keys(inicial).some((k) => String(valores[k]) !== String(inicial[k]));
  const confere = vagasConferem(valores);

  const campo = (chave, rotulo) => (
    <td>
      <input
        type="number"
        min="0"
        aria-label={`${rotulo} de ${formacao.title}`}
        value={valores[chave]}
        onChange={(e) => setValores({ ...valores, [chave]: e.target.value })}
      />
    </td>
  );

  async function salvar(event) {
    event.preventDefault();
    if (!confere) return;
    setSalvando(true);
    try {
      await atualizarFormacao(formacao.id, {
        vagas_total: valores.total, vagas_online: valores.online,
        vagas_fortaleza: valores.fortaleza, vagas_interior: valores.interior,
      });
      onFeedback({ type: 'success', text: `${formacao.title}: vagas salvas.` });
      onSalvo();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <tr>
      <td><strong>{formacao.title}</strong></td>
      {campo('total', 'Total de vagas')}
      {campo('online', 'Vagas online')}
      {campo('fortaleza', 'Vagas em Fortaleza')}
      {campo('interior', 'Vagas no interior')}
      <td>
        <form onSubmit={salvar}>
          {!confere && <span className="gt5-erro-linha">Online + Fortaleza + interior precisa ser igual ao total.</span>}
          <button type="submit" className="primary-button small" disabled={!mudou || !confere || salvando}>Salvar</button>
        </form>
      </td>
      <td className="gt5-ocupacao">
        <span>Online: {resumoVagas(formacao.vagas.online)}</span>
        <span>Fortaleza: {resumoVagas(formacao.vagas.fortaleza)}</span>
        <span>Interior: {resumoVagas(formacao.vagas.interior)}</span>
      </td>
    </tr>
  );
}

export default function VagasTab({ onFeedback }) {
  const [dados, setDados] = useState(null);
  const [concluidas, setConcluidas] = useState(false);
  const [salvandoRegra, setSalvandoRegra] = useState(false);

  const carregar = () => listarFormacoes().then((resposta) => {
    setDados(resposta);
    setConcluidas(resposta.concluidas_ocupam_vaga);
  });

  useEffect(() => {
    carregar().catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvarRegra(event) {
    event.preventDefault();
    setSalvandoRegra(true);
    try {
      await atualizarConfiguracaoGt5({ matriculas_concluidas_ocupam_vaga: concluidas });
      onFeedback({ type: 'success', text: 'Regra de vagas salva.' });
      await carregar();
    } catch (error) {
      onFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvandoRegra(false);
    }
  }

  if (!dados) return <p className="gt5-vazio">Carregando vagas…</p>;

  return (
    <section className="gt5-secao">
      {dados.fortaleza_provisoria && (
        <p className="gt5-aviso" role="note">
          <strong>Fortaleza é provisória.</strong> Presencial sem polo conta como Fortaleza, até existir uma sede cadastrada na cidade.
        </p>
      )}
      <p className="gt5-ajuda">
        Ocupadas vêm das matrículas sincronizadas do site do GT. Não se digita ocupação aqui.
      </p>

      <table className="manage-table">
        <thead>
          <tr>
            <th>Formação</th>
            <th>Total</th>
            <th>Online</th>
            <th>Fortaleza</th>
            <th>Interior</th>
            <th aria-label="Ação" />
            <th>Ocupação atual</th>
          </tr>
        </thead>
        <tbody>
          {dados.formacoes.map((f) => (
            <LinhaVagas key={f.id} formacao={f} onFeedback={onFeedback} onSalvo={carregar} />
          ))}
        </tbody>
      </table>

      <form className="gt5-regra" onSubmit={salvarRegra}>
        <label>
          <input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} />
          <span>Matrícula concluída ocupa vaga</span>
        </label>
        <p className="gt5-ajuda">
          Desligado (padrão): só matrícula ativa ocupa vaga. A gestão ainda não confirmou esta regra.
        </p>
        <button type="submit" className="ghost-button small" disabled={salvandoRegra}>Salvar regra</button>
      </form>
    </section>
  );
}
