// Campo de formulário com rótulo acima. Usado nas telas do GT 5.0 no lugar do label global.
export default function Campo({ rotulo, className = '', children }) {
  return (
    <label className={`gt5-campo ${className}`.trim()}>
      <span>{rotulo}</span>
      {children}
    </label>
  );
}
