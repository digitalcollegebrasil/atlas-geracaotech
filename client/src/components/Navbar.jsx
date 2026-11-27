import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AvatarImg from './AvatarImg';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, isAdmin, isTeacher, isAtendente, isMonitor, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="navbar">
      <Link to="/dashboard" className="brand">
        <span className="brand-mark">Atlas</span>
        <span className="brand-dot">Geração Tech</span>
      </Link>

      <nav className="nav-links">
        {isAuthenticated && isAtendente && <NavLink to="/gestao/atendimento">Atendimento</NavLink>}
        {isAuthenticated && !isAtendente && !isMonitor && <NavLink to="/dashboard">Dashboard</NavLink>}
        {isAuthenticated && !isAtendente && !isMonitor && <NavLink to="/cursos">Trilhas</NavLink>}
        {isAuthenticated && !isAtendente && !isMonitor && (!isTeacher || isAdmin) && <NavLink to="/documentos">Documentos</NavLink>}
        {isAuthenticated && !isTeacher && !isAtendente && !isMonitor && <NavLink to="/anotacoes">Anotações</NavLink>}
        {isAuthenticated && !isTeacher && !isAtendente && !isMonitor && <NavLink to="/editor">Editor</NavLink>}
        {isAuthenticated && !isTeacher && !isAtendente && !isMonitor && <NavLink to="/jogo">Codey</NavLink>}
        {isAuthenticated && isMonitor && <NavLink to="/monitoria">Monitoria</NavLink>}
        {isAuthenticated && isMonitor && <NavLink to="/editor">Codice</NavLink>}
        {isAuthenticated && isMonitor && <NavLink to="/manual">Manual</NavLink>}
        {isAuthenticated && isTeacher && !isAtendente && <NavLink to="/gestao">Gestão</NavLink>}
      </nav>

      <div className="nav-actions">
        <button type="button" className="ghost-button" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {isAuthenticated && (
          <>
            <NavLink to="/minha-area" className="nav-user" title="Minha área">
              <AvatarImg className="nav-avatar" id={user?.avatar} />
              <span>{user?.name?.split(' ')[0] || 'Minha área'}</span>
            </NavLink>
            <button type="button" className="primary-button small" onClick={handleLogout}>
              Sair
            </button>
          </>
        )}
      </div>
    </header>
  );
}
