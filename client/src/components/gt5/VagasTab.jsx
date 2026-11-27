import { useEffect, useState } from 'react';
import { listarFormacoes, atualizarFormacao, atualizarConfiguracaoGt5 } from '../../services/gt5';
import { errorText } from '../manage/shared';
import { vagasConferem } from './gt5Format';

// Campo de vagas de um local, com a ocupação atual logo abaixo (vem das matrículas, não é digitada).
function CampoVagas({ rotulo, valor, ocupacao, onChange }) {
  return (
    <div className="gt5-celula-campo">
      <input
        className="gt5-num"
        type="number"
        min="0"
        aria-label={rotulo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="gt5-celula-legenda">{ocupacao.ocupadas} ocupadas · {ocupacao.disponiveis} livres</span>
    </div>
  );
}

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

  const set = (chave) => (valor) => setValores({ ...valores, [chave]: valor });

  // Ocupação somada dos três locais, para a coluna do total.
  const ocupadasTotal = formacao.vagas.online.ocupadas + formacao.vagas.fortaleza.ocupadas + formacao.vagas.interior.ocupadas;
  const ocupacaoTotal = { ocupadas: ocupadasTotal, disponiveis: formacao.vagas.total - ocupadasTotal };

  return (
    <tr>
      <td><strong>{formacao.title}</strong></td>
      <td>
        <CampoVagas rotulo={`Total de ${formacao.title}`} valor={valores.total} ocupacao={ocupacaoTotal} onChange={set('total')} />
      </td>
      <td><CampoVagas rotulo={`Vagas online de ${formacao.title}`} valor={valores.online} ocupacao={formacao.vagas.online} onChange={set('online')} /></td>
      <td><CampoVagas rotulo={`Vagas em Fortaleza de ${formacao.title}`} valor={valores.fortaleza} ocupacao={formacao.vagas.fortaleza} onChange={set('fortaleza')} /></td>
      <td><CampoVagas rotulo={`Vagas no interior de ${formacao.title}`} valor={valores.interior} ocupacao={formacao.vagas.interior} onChange={set('interior')} /></td>
      <td className="gt5-acoes">
        <form onSubmit={salvar}>
          <button type="submit" className="primary-button small" disabled={!mudou || !confere || salvando}>Salvar</button>
          {!confere && <p className="gt5-erro">Online + Fortaleza + interior precisa ser igual ao total.</p>}
        </form>
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

      <div className="gt5-card">
        <div>
          <h2>Vagas por formação</h2>
          <p className="gt5-nota">A ocupação vem das matrículas sincronizadas do site do GT. Aqui você só ajusta o total e a distribuição.</p>
        </div>
        <div className="table-wrap">
          <table className="manage-table">
            <thead>
              <tr>
                <th>Formação</th>
                <th>Total</th>
                <th>Online</th>
                <th>Fortaleza</th>
                <th>Interior</th>
                <th aria-label="Ação" />
              </tr>
            </thead>
            <tbody>
              {dados.formacoes.map((f) => (
                <LinhaVagas key={f.id} formacao={f} onFeedback={onFeedback} onSalvo={carregar} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form className="gt5-card gt5-regra" onSubmit={salvarRegra}>
        <div>
          <h2>Matrícula concluída ocupa vaga</h2>
          <p className="gt5-nota">
            Desligado (padrão): só a matrícula ativa ocupa vaga. A gestão ainda não confirmou esta regra.
          </p>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} />
          Contar matrículas concluídas como ocupadas
        </label>
        <div className="gt5-acoes-grupo">
          <button type="submit" className="ghost-button small" disabled={salvandoRegra}>Salvar regra</button>
        </div>
      </form>
    </section>
  );
}
