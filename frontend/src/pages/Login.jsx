// src/pages/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Mail, Lock, LogIn } from 'lucide-react';
import './Login.css';

const PIPELINE = [
  { label: 'Tetiklendi',   log: 'Zamanlanmış görev tetiklendi' },
  { label: 'Veri Al',      log: 'Kaynak sistemden veri çekiliyor' },
  { label: 'İşle',         log: '1.204 kayıt işleniyor' },
  { label: 'Doğrula',      log: 'Sonuçlar doğrulanıyor' },
  { label: 'Tamamlandı',   log: 'İşlem başarıyla tamamlandı' },
];

function useAutomationFeed() {
  const [activeStage, setActiveStage] = useState(0);
  const [feed, setFeed] = useState([]);
  const stageRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const i = stageRef.current;
      const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
      setFeed((prev) => [{ time, ...PIPELINE[i], id: `${i}-${time}-${Math.random()}` }, ...prev].slice(0, 4));
      setActiveStage(i);
      stageRef.current = (i + 1) % PIPELINE.length;
    };
    tick();
    const id = setInterval(tick, 1900);
    return () => clearInterval(id);
  }, []);

  return { activeStage, feed };
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { activeStage, feed } = useAutomationFeed();

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Backend Auth sistemi kurulana kadar basit bir simülasyon
    setTimeout(() => {
      if (email === 'admin@rpa.com' && password === '123456') {
        navigate('/');
      } else {
        setError('E-posta adresi veya şifre hatalı. Lütfen tekrar deneyin.');
        setIsLoading(false);
      }
    }, 1200);
  };

  return (
    <div className="login-page">
      {/* SOL: Canlı otomasyon konsolu */}
      <aside className="login-visual" aria-hidden="true">
        <div className="visual-grid" />

        <div className="visual-brand">
          <Database size={18} />
          <span>RPA ADMIN</span>
        </div>

        <div className="pipeline">
          <svg className="pipeline-svg" viewBox="0 0 200 420" preserveAspectRatio="xMidYMid meet">
            <line x1="100" y1="30" x2="100" y2="390" className="pipeline-track" />
            <line
              x1="100" y1="30" x2="100" y2="390"
              className="pipeline-flow"
              style={{ strokeDashoffset: 360 - (activeStage / (PIPELINE.length - 1)) * 360 }}
            />
            {PIPELINE.map((stage, i) => {
              const y = 30 + i * 90;
              const isActive = i === activeStage;
              const isDone = i < activeStage;
              return (
                <g key={stage.label} transform={`translate(100, ${y})`}>
                  <circle
                    r="7"
                    className={`node-dot ${isActive ? 'node-active' : ''} ${isDone ? 'node-done' : ''}`}
                  />
                  {isActive && <circle r="14" className="node-pulse" />}
                  <text x="22" y="5" className="node-label">{stage.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="status-feed">
          <p className="feed-heading">CANLI İŞLEM AKIŞI</p>
          <ul>
            {feed.map((item) => (
              <li key={item.id} className="feed-line">
                <span className="feed-time">{item.time}</span>
                <span className="feed-text">{item.log}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="visual-tagline">
          Otomasyon süreçlerinizi tek merkezden izleyin ve yönetin.
        </p>
      </aside>

      {/* SAĞ: Giriş formu */}
      <main className="login-form-panel">
        <div className="login-card">
          <div className="login-header">
            <span className="login-eyebrow">YETKİLİ ERİŞİM</span>
            <h2>RPA Admin Merkezi</h2>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>E-posta Adresi</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  placeholder="admin@rpa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Şifre</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="forgot-password">
              <a href="#reset">Şifremi Unuttum</a>
            </div>

            <button type="submit" className="btn-primary login-btn" disabled={isLoading}>
              {isLoading ? <span className="loading-spinner" /> : <>Giriş Yap <LogIn size={18} /></>}
            </button>
          </form>

          <div className="login-footer">
            <p>Sistem erişim yetkiniz yok mu? <a href="#admin">Yöneticiye Ulaşın</a></p>
          </div>
        </div>
      </main>
    </div>
  );
}