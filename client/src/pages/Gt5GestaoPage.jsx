import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Feedback } from '../components/manage/shared';
import FormacoesTab from '../components/gt5/FormacoesTab';
import VagasTab from '../components/gt5/VagasTab';
import PolosTab from '../components/gt5/PolosTab';
import LiderancasTab from '../components/gt5/LiderancasTab';
import TurmasTab from '../components/gt5/TurmasTab';
import HorariosTab from '../components/gt5/HorariosTab';
import CalendarioTab from '../components/gt5/CalendarioTab';
import '../styles/gt5.css';

const ABAS = [
  ['formacoes', 'Formações', FormacoesTab],
  ['vagas', 'Vagas', VagasTab],
  ['polos', 'Polos', PolosTab],
  ['liderancas', 'Lideranças', LiderancasTab],
  ['turmas', 'Turmas', TurmasTab],
  ['horarios', 'Horários', HorariosTab],
  ['calendario', 'Calendário', CalendarioTab],
];

// Geração Tech 5.0: cadastro acadêmico. Só a administração acessa esta tela.
export default function Gt5GestaoPage() {
  const [aba, setAba] = useState('formacoes');
  const [feedback, setFeedback] = useState(null);
  const Atual = ABAS.find(([chave]) => chave === aba)[2];

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content gt5-pagina">
        <section className="section-heading">
          <h1>Geração Tech 5.0</h1>
          <p>Formações, vagas, polos, lideranças e turmas da edição 5.0. Inscrições e matrículas continuam no site do GT.</p>
        </section>

        <div className="gt5-abas" role="tablist" aria-label="Seções do cadastro">
          {ABAS.map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={aba === chave}
              className={aba === chave ? 'is-active' : ''}
              onClick={() => { setAba(chave); setFeedback(null); }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <Feedback feedback={feedback} />
        <Atual onFeedback={setFeedback} />
      </div>
    </div>
  );
}
