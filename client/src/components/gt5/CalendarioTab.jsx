import { useEffect, useState } from 'react';
import { listarTurmasGt5 } from '../../services/gt5';
import { errorText } from '../manage/shared';
import { formatarData, ordenarPorInicio, rotuloLocalTurma } from './gt5Format';
import UltimaSincronizacao from './UltimaSincronizacao';

// Calendário das turmas: início e término. Só leitura; as datas vêm da planilha ou da integração.
export default function CalendarioTab({ onFeedback }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    listarTurmasGt5().then(setDados).catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dados) return <p className="gt5-vazio">Carregando calendário…</p>;
  const turmas = ordenarPorInicio(dados.turmas);

  return (
    <section className="gt5-card">
      <div>
        <h2>Calendário das turmas</h2>
        <p className="gt5-nota">Ordenado pela data de início. Sem data, aparece um traço até a planilha ou a integração trazer as datas.</p>
      </div>
      <UltimaSincronizacao sincronizacoes={dados.sincronizacoes} />
      {turmas.length === 0 ? <p className="gt5-vazio">Nenhuma turma cadastrada.</p> : (
        <div className="table-wrap">
          <table className="manage-table">
            <thead>
              <tr><th>Início</th><th>Término</th><th>Turma</th><th>Formação</th><th>Local</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {turmas.map((t) => (
                <tr key={t.id}>
                  <td>{formatarData(t.data_inicio)}</td>
                  <td>{formatarData(t.data_fim)}</td>
                  <td><strong>{t.nome}</strong></td>
                  <td>{t.formacao}</td>
                  <td>{rotuloLocalTurma(t)}</td>
                  <td><span className={`badge${t.ativa ? '' : ' hidden'}`}>{t.ativa ? 'Ativa' : 'Inativa'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
