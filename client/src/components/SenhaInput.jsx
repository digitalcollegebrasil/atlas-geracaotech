import { useState } from 'react';
import '../styles/senhaInput.css';

// Campo de senha com o ícone de olho para mostrar ou ocultar o que está sendo digitado.
export default function SenhaInput({ className = '', ...props }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <span className={`senha-input ${className}`.trim()}>
      <input {...props} type={visivel ? 'text' : 'password'} />
      <button
        type="button"
        className="senha-olho"
        onClick={() => setVisivel((atual) => !atual)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
          {visivel && <line x1="3" y1="3" x2="21" y2="21" />}
        </svg>
      </button>
    </span>
  );
}
