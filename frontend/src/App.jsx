import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Database, Moon, Sun } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import BotManagement from './pages/BotManagement';
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
        <div className="nav-item">İş Kuyruğu</div>
        <div className="nav-item">Kullanıcılar</div>
        <div className="nav-item">Ayarlar</div>
      </div>

      <div className="nav-actions">
        <button className="btn-primary">Get Started</button>
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
          <Route path="/bots" element={<BotManagement />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;