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
import AuditLogs from './pages/AuditLogs'; // YENİ EKLENDİ
import './App.css';

// Navbar bileşeni: Hangi sayfada olduğumuzu (useLocation) anlayıp o menüyü aktif yapar.
function Navbar({ isDarkMode, toggleTheme }) {
  const location = useLocation(); 

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Database size={24} className="brand-icon" />
        <span>RPA Admin Merkezi</span>
      </div>
      
      <div className="nav-links">
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link to="/bots" className={`nav-item ${location.pathname === '/bots' ? 'active' : ''}`}>
          Robot Yönetimi
        </Link>
        <Link to="/queue" className={`nav-item ${location.pathname === '/queue' ? 'active' : ''}`}>
          İş Kuyruğu
        </Link>
        <Link to="/logs" className={`nav-item ${location.pathname === '/logs' ? 'active' : ''}`}>
          Log ve İzleme
        </Link>
        <Link to="/audit" className={`nav-item ${location.pathname === '/audit' ? 'active' : ''}`}>
          Denetim İzleri {/* YENİ EKLENDİ */}
        </Link>
        <Link to="/users" className={`nav-item ${location.pathname === '/users' ? 'active' : ''}`}>
          Kullanıcılar
        </Link>
       <Link to="/settings" className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}>
        Ayarlar
      </Link>
      </div>

      <div className="nav-actions">
        {/* Yönlendirme işlemi için Link kullanıldı ve buton stili korundu */}
        <Link to="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
          Giriş Yap
        </Link>
        
        <div className="theme-toggle" onClick={toggleTheme}>
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <BrowserRouter>
      <div className="dashboard-container">
        {/* Navbar her sayfada sabit kalacak */}
        <Navbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        
        {/* Routes kısmı sayfa değiştiğinde içeriğin değiştiği yerdir */}
        <Routes>
          {/* Dashboard bileşenine tema bilgisini prop olarak yolluyoruz ki grafik renkleri değişebilsin */}
          <Route path="/" element={<Dashboard isDarkMode={isDarkMode} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bots" element={<BotManagement />} />
          <Route path="/queue" element={<QueueManagement />} />
          <Route path="/logs" element={<SystemLogs />} />
          <Route path="/audit" element={<AuditLogs />} /> {/* YENİ EKLENDİ */}
          <Route path="/users" element={<UserManagement />} />
          <Route path="/settings" element={<SystemSettings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;