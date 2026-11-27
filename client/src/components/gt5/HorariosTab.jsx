import { useEffect, useState } from 'react';
import { listarTurmasGt5 } from '../../services/gt5';
import { errorText } from '../manage/shared';
import { agruparTurmas } from './gt5Format';
import UltimaSincronizacao from './UltimaSincronizacao';

// Horários por turma. Só leitura: turno, dias e horário entram pela planilha ou pela integração com o site.
export default function HorariosTab({ onFeedback }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    listarTurmasGt5().then(setDados).catch((error) => onFeedback({ type: 'error', text: errorText(error) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dados) return <p className="gt5-vazio">Carregando horários…</p>;
  const grupos = agruparTurmas(dados.turmas);

  return (
    <section className="gt5-secao">
      <p className="gt5-ajuda">Horários são definidos na planilha de turmas ou vêm da integração com o site do GT.</p>
      <UltimaSincronizacao sincronizacoes={dados.sincronizacoes} />
      {grupos.length === 0 && <p className="gt5-vazio">Nenhuma turma cadastrada.</p>}
      {grupos.map((grupo) => (
        <div key={grupo.formacao} className="gt5-grupo">
          <h2>{grupo.formacao}</h2>
          <table className="manage-table">
            <thead>
              <tr><th>Local</th><th>Turma</th><th>Turno</th><th>Dias</th><th>Horário</th></tr>
            </thead>
            <tbody>
              {grupo.locais.flatMap((local) => local.turmas.map((t) => (
                <tr key={t.id}>
                  <td>{local.local}</td>
                  <td>{t.nome}</td>
                  <td>{t.turno || '—'}</td>
                  <td>{t.dias_semana || '—'}</td>
                  <td>{t.horario || '—'}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
