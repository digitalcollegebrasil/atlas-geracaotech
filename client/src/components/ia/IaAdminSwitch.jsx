import { useEffect, useState } from 'react';
import { buscarEstadoIa, definirEstadoIa, testarIa } from '../../services/ia';
import { Feedback, errorText } from '../manage/shared';

// Teste rápido: digite uma pergunta e veja a resposta da IA abaixo do campo.
function TesteIa({ disponivel }) {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState(null);
  const [testando, setTestando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function testar(event) {
    event.preventDefault();
    setTestando(true);
    setFeedback(null);
    setResposta(null);
    try {
      const dados = await testarIa(pergunta);
      setResposta(dados);
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setTestando(false);
    }
  }

  return (
    <form className="surface-card ia-admin-card" onSubmit={testar}>
      <label>
        Pergunta de teste
        <textarea value={pergunta} onChange={(e) => setPergunta(e.target.value)} rows={3} maxLength={2000} />
      </label>
      <button type="submit" className="primary-button small" disabled={testando || !disponivel || !pergunta.trim()}>
        {testando ? 'Testando…' : 'Testar'}
      </button>
      {resposta && <p>{resposta.resposta}</p>}
      <Feedback feedback={feedback} />
    </form>
  );
}

// Interruptor da IA no painel. Desligada, o site segue funcionando normalmente.
export default function IaAdminSwitch() {
  const [estado, setEstado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    buscarEstadoIa()
      .then(setEstado)
      .catch((error) => setFeedback({ type: 'error', text: errorText(error) }));
  }, []);

  async function alternar() {
    setSalvando(true);
    setFeedback(null);
    try {
      const novo = await definirEstadoIa(!estado.ligada);
      setEstado(novo);
      setFeedback({ type: 'success', text: novo.ligada ? 'IA ligada.' : 'IA desligada.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <section className="surface-card ia-admin-card">
        {!estado ? (
          <p>Carregando…</p>
        ) : (
          <>
            <p>
              Status: <strong>{estado.ligada ? 'ligada' : 'desligada'}</strong>
              {' · '}
              {estado.configurada ? `provedor ${estado.provedor}` : `não configurada (${estado.motivo || 'verifique o .env'})`}
            </p>
            <p>Tutor nas aulas: {estado.modulos?.tutor ? 'disponível' : 'indisponível'}</p>
            <button
              type="button"
              className={estado.ligada ? 'ghost-button' : 'primary-button'}
              onClick={alternar}
              disabled={salvando || !estado.configurada}
            >
              {estado.ligada ? 'Desligar IA' : 'Ligar IA'}
            </button>
          </>
        )}
        <Feedback feedback={feedback} />
      </section>
      <TesteIa disponivel={Boolean(estado?.ligada && estado?.configurada)} />
    </>
  );
}
