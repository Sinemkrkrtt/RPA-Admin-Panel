import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Mail, Lock, LogIn } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Backend Auth sistemi kurulana kadar basit bir simülasyon
    setTimeout(() => {
      if (email === 'admin@rpa.com' && password === '123456') {
        navigate('/'); // Başarılı girişte Dashboard'a yönlendir
      } else {
        setError('E-posta adresi veya şifre hatalı. Lütfen tekrar deneyin.');
        setIsLoading(false);
      }
    }, 1200); // 1.2 saniyelik yükleniyor efekti
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Database size={32} className="text-primary" />
          </div>
          <h2>RPA Admin Merkezi</h2>
          <p>Sisteme erişmek için yetkili giriş yapın.</p>
        </div>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

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
            {isLoading ? (
              <span className="loading-spinner"></span> 
            ) : (
              <>Giriş Yap <LogIn size={18} /></>
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Sistem erişim yetkiniz yok mu? <a href="#admin">Yöneticiye Ulaşın</a></p>
        </div>
      </div>
    </div>
  );
}