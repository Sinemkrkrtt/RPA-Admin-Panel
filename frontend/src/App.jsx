import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Database, Moon, Sun } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import BotManagement from './pages/BotManagement';
import QueueManagement from './pages/QueueManagement';
import SystemLogs from './pages/SystemLogs';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';
import SystemSettings from './pages/SystemSettings';
import AuditLogs from './pages/AuditLogs';
import './App.css';

const NAV_ITEMS = [
  { path: '/', label: 'Genel Bakış' },
  { path: '/bots', label: 'Robotlar' },
  { path: '/queue', label: 'İş Kuyruğu' },
  { path: '/logs', label: 'Loglar' },
  { path: '/audit', label: 'Denetim' },
  { path: '/users', label: 'Kullanıcılar' },
  { path: '/settings', label: 'Ayarlar' },
];

function Navbar({ isDarkMode, toggleTheme }) {
  const location = useLocation();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark"><Database size={15} strokeWidth={2.2} /></span>
          <span className="brand-name">RPA Admin</span>
          <span className="env-chip">PROD</span>
        </Link>

        <nav className="nav-menu">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={isDarkMode ? 'Açık temaya geç' : 'Koyu temaya geç'}
            title={isDarkMode ? 'Açık temaya geç' : 'Koyu temaya geç'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link to="/login" className="btn-ink">Giriş yap</Link>
        </div>
      </div>
    </header>
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((v) => !v);

  return (
    <BrowserRouter>
      <div className="dashboard-container">
        <Navbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

        <Routes>
          <Route path="/" element={<Dashboard isDarkMode={isDarkMode} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bots" element={<BotManagement />} />
          <Route path="/queue" element={<QueueManagement />} />
          <Route path="/logs" element={<SystemLogs />} />
          <Route path="/audit" element={<AuditLogs />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/settings" element={<SystemSettings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;