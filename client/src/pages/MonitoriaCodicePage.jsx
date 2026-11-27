import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import EspacoIncorporado from '../components/course/EspacoIncorporado';
import api from '../services/api';
import { Feedback, errorText } from '../components/manage/shared';
import '../styles/atendimento.css';

// Monitoria: as salas do Codice, do jeito que o aluno vê na aula, para ajudar com o código.
export default function MonitoriaCodicePage() {
  const [salas, setSalas] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    api.get('/monitoria/codice')
      .then(({ data }) => {
        setSalas(data.salas);
        setSelecionada((atual) => atual || data.salas[0] || null);
      })
      .catch((error) => setFeedback({ type: 'error', text: errorText(error) }));
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content atend">
        <section className="atend-head">
          <div>
            <span className="eyebrow">Monitoria</span>
            <h1>Codice</h1>
            <p>As mesmas salas de código que os alunos usam nas aulas. Escolha uma sala para acompanhar.</p>
          </div>
        </section>

        <Feedback feedback={feedback} />

        {salas.length === 0 ? (
          <section className="surface-card">
            <p className="muted">Nenhuma sala do Codice cadastrada ainda.</p>
          </section>
        ) : (
          <div className="atend-layout">
            <aside className="atend-fila" aria-label="Salas do Codice">
              <ul className="atend-lista">
                {salas.map((sala) => (
                  <li key={sala.id}>
                    <button type="button" className={`atend-item${selecionada?.id === sala.id ? ' is-active' : ''}`} onClick={() => setSelecionada(sala)}>
                      <span className="atend-item-topo"><strong>{sala.titulo}</strong></span>
                      <span className="atend-item-ultima">{sala.curso}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <section className="atend-conversa" aria-label="Sala selecionada">
              {selecionada && (
                <EspacoIncorporado lesson={{ type: 'codice', title: selecionada.titulo, url: selecionada.url }} />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
