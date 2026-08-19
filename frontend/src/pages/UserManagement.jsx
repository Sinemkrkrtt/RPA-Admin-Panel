import React, { useState, useEffect } from 'react';
import { 
  Users, Search, UserPlus, Shield, 
  Trash2, Mail, ShieldAlert, ShieldCheck, X 
} from 'lucide-react';
import './UserManagement.css';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '', // YENİ
    role: 'İzleyici'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Kullanıcılar çekilemedi:", error);
    }
  };

 const handleAddUser = async (e) => {
    e.preventDefault();
    
    // 1. HATA KONTROLÜ: Alanlar boş mu? Sessizce durmak yerine uyarı verelim.
    if (!formData.full_name || !formData.email || !formData.password) {
      alert("Lütfen Ad Soyad, E-posta ve Şifre alanlarının hepsini doldurun!");
      return; 
    }

    const now = new Date();
    const timeString = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;

    try {
      // Gönderilen veriyi tarayıcı konsoluna yazdıralım (F12 -> Console sekmesinden görebilirsin)
      console.log("Backend'e gönderilen veri:", { ...formData, created_at: timeString });

      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, created_at: timeString })
      });

      if (response.ok) {
        const savedUser = await response.json();
        setUsers([...users, savedUser]);
        setIsModalOpen(false);
        setFormData({ full_name: '', email: '', password: '', role: 'İzleyici' }); 
        alert("Kullanıcı başarıyla eklendi! 🎉"); // Başarı mesajı
      } else {
        // 2. HATA KONTROLÜ: Backend 500 veya 400 hatası dönerse sebebini yakalayalım
        const errorData = await response.json();
        console.error("Backend Hatası:", errorData);
        alert(`Kayıt Başarısız: ${errorData.error || "Bu e-posta adresi zaten kullanılıyor."}`);
      }
    } catch (error) {
      // 3. HATA KONTROLÜ: Sunucu kapalıysa
      console.error("Kullanıcı eklenirken bağlantı hatası:", error);
      alert("Sunucuya ulaşılamadı! Node.js backend'in (server.js) çalıştığından emin olun.");
    }
  };
  const handleDeleteUser = async (id) => {
    if(!window.confirm("Bu kullanıcıyı sistemden tamamen silmek istediğinize emin misiniz?")) return;
    
    try {
      await fetch(`http://localhost:5000/api/users/${id}`, { method: 'DELETE' });
      setUsers(users.filter(user => user.id !== id));
    } catch (error) {
      console.error("Kullanıcı silinirken hata:", error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // İsimden baş harfleri çıkartan yardımcı fonksiyon (Örn: Sinem Karakurt -> SK)
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Süper Admin': 
        return <span className="role-badge super-admin"><ShieldAlert size={14}/> Süper Admin</span>;
      case 'Operatör': 
        return <span className="role-badge operator"><ShieldCheck size={14}/> Operatör</span>;
      case 'İzleyici': 
        return <span className="role-badge viewer"><Shield size={14}/> İzleyici</span>;
      default: 
        return role;
    }
  };

  return (
    <div className="page-container">
      
      <div className="page-header">
        <div>
       
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} /> Yeni Kullanıcı
        </button>
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="İsim veya e-posta ile ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table user-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Profil</th>
              <th>Kullanıcı Adı</th>
              <th>E-posta Adresi</th>
              <th>Sistem Rolü</th>
              <th>Kayıt Tarihi</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-avatar">{getInitials(user.full_name)}</div>
                  </td>
                  <td className="font-semibold">{user.full_name}</td>
                  <td className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14}/> {user.email}
                  </td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td className="text-muted">{user.created_at}</td>
                  <td>
                    <span className={`status-dot ${user.status === 'Aktif' ? 'active' : 'suspended'}`}></span>
                    {user.status}
                  </td>
                  <td className="text-right">
                    <button 
                      className="action-btn delete" 
                      title="Kullanıcıyı Sil" 
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.role === 'Süper Admin' && users.length === 1} // Tek admin varsa kendini silemesin
                      style={{ opacity: (user.role === 'Süper Admin' && users.length === 1) ? 0.3 : 1 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Kullanıcı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* YENİ KULLANICI EKLEME MODALI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sisteme Kullanıcı Ekle</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddUser} className="modal-body">
              <div className="form-group">
                <label>Ad Soyad</label>
                <input 
                  type="text" 
                  name="full_name"
                  required
                  placeholder="Örn: Ahmet Yılmaz" 
                  value={formData.full_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>E-posta Adresi</label>
                <input 
                  type="email" 
                  name="email"
                  required
                  placeholder="ahmet@sirket.com" 
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Giriş Şifresi</label>
                <input 
                    type="password" 
                    name="password"
                    required
                    placeholder="Kullanıcı için geçici bir şifre belirleyin" 
                    value={formData.password}
                    onChange={handleInputChange}
                />
                </div>

              <div className="form-group">
                <label>Erişim Yetkisi (Rol)</label>
                <select name="role" value={formData.role} onChange={handleInputChange}>
                  <option value="Süper Admin">Süper Admin (Tam Erişim)</option>
                  <option value="Operatör">Operatör (Bot Başlat/Durdur)</option>
                  <option value="İzleyici">İzleyici (Sadece Okuma)</option>
                </select>
                <p className="role-hint">
                  {formData.role === 'Süper Admin' && 'Tüm sistem ayarlarını değiştirebilir ve bot silebilir.'}
                  {formData.role === 'Operatör' && 'Botları kuyruğa sokabilir, başlatıp durdurabilir.'}
                  {formData.role === 'İzleyici' && 'Sadece logları ve dashboard istatistiklerini görebilir.'}
                </p>
              </div>

              <div className="modal-actions mt-4">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>İptal</button>
                <button type="submit" className="btn-primary">Kullanıcıyı Yetkilendir</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}