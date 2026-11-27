import { useEffect, useState } from 'react';
import { listarTurmasGt5 } from '../../services/gt5';
import { errorText } from '../manage/shared';
import { formatarData, ordenarPorInicio, rotuloLocalTurma } from './gt5Format';
import UltimaSincronizacao from './UltimaSincronizacao';

// Calendário das turmas: início e término. Só leitura, como os horários; as datas vêm da planilha ou da integração.
export default function CalendarioTab({ onFeedback }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    listarTurmasGt5().then(setDados).catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dados) return <p className="gt5-vazio">Carregando calendário…</p>;
  const turmas = ordenarPorInicio(dados.turmas);

  return (
    <section className="gt5-secao">
      <p className="gt5-ajuda">Datas de início e término das turmas. Enquanto a planilha não trouxer as datas, aparece um traço.</p>
      <UltimaSincronizacao sincronizacoes={dados.sincronizacoes} />
      {turmas.length === 0 && <p className="gt5-vazio">Nenhuma turma cadastrada.</p>}
      {turmas.length > 0 && (
        <table className="manage-table">
          <thead>
            <tr><th>Início</th><th>Término</th><th>Turma</th><th>Formação</th><th>Local</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {turmas.map((t) => (
              <tr key={t.id}>
                <td>{formatarData(t.data_inicio)}</td>
                <td>{formatarData(t.data_fim)}</td>
                <td>{t.nome}</td>
                <td>{t.formacao}</td>
                <td>{rotuloLocalTurma(t)}</td>
                <td>{t.ativa ? 'Ativa' : 'Inativa'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
