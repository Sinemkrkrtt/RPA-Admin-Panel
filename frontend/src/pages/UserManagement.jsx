import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, X, UserPlus, Trash2, Check, Eye, EyeOff, Lock, Loader2,
  AlertCircle, CheckCircle2, SearchX, Users, WifiOff
} from 'lucide-react';
import './UserManagement.css';

const API = 'http://localhost:5000/api/users';

/* Rollerin yetki gücü soldan sağa artar */
const ROLES = [
  { key: 'İzleyici', short: 'İzleyici', mark: 'viewer' },
  { key: 'Operatör', short: 'Operatör', mark: 'operator' },
  { key: 'Süper Admin', short: 'Süper Admin', mark: 'super' }
];

const CAPS = [
  { label: 'Panel ve logları görüntüle', roles: ['İzleyici', 'Operatör', 'Süper Admin'] },
  { label: 'Robot başlat / durdur', roles: ['Operatör', 'Süper Admin'] },
  { label: 'Kuyruğa görev ekle', roles: ['Operatör', 'Süper Admin'] },
  { label: 'Robot tanımla / sil', roles: ['Süper Admin'] },
  { label: 'Kullanıcı ve ayar yönetimi', roles: ['Süper Admin'] }
];

const MARK = { 'Süper Admin': 'super', 'Operatör': 'operator', 'İzleyici': 'viewer' };

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
};

const tint = (seed) => {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 5;
};

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

const stamp = () => {
  const now = new Date();
  return `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(null);

  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '', email: '', password: '', role: 'İzleyici'
  });

  const notify = useCallback((tone, text) => setToast({ tone, text }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- VERİ ---------------- */
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('users');
      setUsers(await response.json());
      setIsOffline(false);
    } catch (error) {
      console.error('Kullanıcılar çekilemedi:', error);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const formValid =
    formData.full_name.trim().length > 1 &&
    isEmail(formData.email) &&
    formData.password.length >= 6;

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!formValid || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, created_at: stamp() })
      });

      if (!response.ok) {
        let reason = 'Bu e-posta adresi zaten kullanılıyor olabilir.';
        try {
          const errorData = await response.json();
          if (errorData?.error) reason = errorData.error;
        } catch { /* gövde boş olabilir */ }
        throw new Error(reason);
      }

      const savedUser = await response.json();
      setUsers((prev) => [savedUser, ...prev]);
      setIsModalOpen(false);
      setFormData({ full_name: '', email: '', password: '', role: 'İzleyici' });
      notify('ok', `${savedUser.full_name} ${savedUser.role} olarak eklendi.`);
    } catch (error) {
      console.error('Kullanıcı eklenirken hata:', error);
      notify('error', error.message || 'Kullanıcı eklenemedi. Sunucuyu kontrol edin.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user) => {
    setConfirmId(null);
    setBusyId(user.id);
    try {
      const response = await fetch(`${API}/${user.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('silinemedi');
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      notify('ok', `${user.full_name} sistemden çıkarıldı.`);
    } catch (error) {
      console.error('Kullanıcı silinirken hata:', error);
      notify('error', 'Kullanıcı silinemedi. Bağlantıyı kontrol edin.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInputChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e) => e.key === 'Escape' && setIsModalOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  /* ---------------- TÜRETİLEN VERİ ---------------- */
  const roleCounts = useMemo(() => {
    const base = { 'Süper Admin': 0, 'Operatör': 0, 'İzleyici': 0 };
    users.forEach((u) => { if (base[u.role] !== undefined) base[u.role] += 1; });
    return base;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const hit = !q
        || String(user.full_name || '').toLowerCase().includes(q)
        || String(user.email || '').toLowerCase().includes(q);
      return hit && (!roleFilter || user.role === roleFilter);
    });
  }, [users, searchTerm, roleFilter]);

  const isFiltered = searchTerm.trim() !== '' || roleFilter !== null;
  const clearFilters = () => { setSearchTerm(''); setRoleFilter(null); };

  return (
    <main className="main-content">
      {/* BAŞLIK — tek satır */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">Kullanıcılar</h1>
          <div className="page-sub">
            <span className={`status-dot ${roleCounts['Süper Admin'] === 0 || isOffline ? 'is-down' : ''}`} />
            <span className="count">{users.length}</span> kullanıcı
            <span className="sep">·</span>
            <span className="count">{roleCounts['Süper Admin']}</span> süper admin
          </div>
        </div>

        <div className="head-actions">
          <button className="btn-ink" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={15} /> Yeni kullanıcı
          </button>
        </div>
      </div>

      {isOffline && !isLoading && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Kullanıcı listesi {API} adresinden alınamadı.</span>
          <button className="btn" onClick={fetchUsers}>Tekrar dene</button>
        </div>
      )}

      {/* YETKİ MATRİSİ — hem belge hem filtre */}
      <section className="panel rise" style={{ '--d': '70ms' }}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Yetki matrisi</h2>
            <p className="panel-desc">Rol başlığına tıklayarak listeyi o role göre filtreleyin</p>
          </div>
        </div>

        <div className="mx-scroll">
          <table className="mx">
            <thead>
              <tr>
                <th />
                {ROLES.map((role) => (
                  <th key={role.key} className={`mx-col ${roleFilter === role.key ? 'on' : ''}`}>
                    <button
                      className="mx-col-btn"
                      onClick={() => setRoleFilter(roleFilter === role.key ? null : role.key)}
                      aria-pressed={roleFilter === role.key}
                    >
                      <span className="mx-col-name">
                        <i className={`role-mark ${role.mark}`} /> {role.short}
                      </span>
                      <span className="mx-col-count">{roleCounts[role.key]} kişi</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPS.map((cap) => (
                <tr key={cap.label}>
                  <td className="mx-cap">{cap.label}</td>
                  {ROLES.map((role) => {
                    const allowed = cap.roles.includes(role.key);
                    return (
                      <td key={role.key} className={`mx-cell ${roleFilter === role.key ? 'on' : ''}`}>
                        {allowed
                          ? <span className="mx-yes"><Check size={14} strokeWidth={2.6} /></span>
                          : <span className="mx-no">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* KULLANICI TABLOSU */}
      <section className="panel rise" style={{ '--d': '120ms' }}>
        <div className="panel-head toolbar">
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="İsim veya e-posta ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Kullanıcı ara"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')} aria-label="Aramayı temizle">
                <X size={13} />
              </button>
            )}
          </div>

          {roleFilter && (
            <div className="toolbar-right">
              <span className="role-badge"><i className={`role-mark ${MARK[roleFilter]}`} /> {roleFilter}</span>
              <button className="btn-text" onClick={() => setRoleFilter(null)}>Kaldır</button>
            </div>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th style={{ width: 170 }}>Rol</th>
                <th style={{ width: 120 }}>Durum</th>
                <th style={{ width: 160 }}>Kayıt tarihi</th>
                <th className="text-right" style={{ width: 190 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td>
                      <div className="identity">
                        <div className="skel" style={{ width: 32, height: 32, borderRadius: 9 }} />
                        <div>
                          <div className="skel" style={{ width: 132, height: 13 }} />
                          <div className="skel" style={{ width: 168, height: 11, marginTop: 5 }} />
                        </div>
                      </div>
                    </td>
                    <td><div className="skel" style={{ width: 108, height: 22, borderRadius: 20 }} /></td>
                    <td><div className="skel" style={{ width: 62, height: 12 }} /></td>
                    <td><div className="skel" style={{ width: 116, height: 12 }} /></td>
                    <td />
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const busy = busyId === user.id;
                  const lastAdmin = user.role === 'Süper Admin' && roleCounts['Süper Admin'] <= 1;
                  const active = (user.status || 'Aktif') === 'Aktif';

                  return (
                    <tr key={user.id} className={busy ? 'is-busy' : ''}>
                      <td>
                        <div className="identity">
                          <span className={`user-avatar tint-${tint(user.email || user.full_name)}`}>
                            {initials(user.full_name)}
                          </span>
                          <span className="identity-text">
                            <span className="identity-name">{user.full_name}</span>
                            <span className="identity-mail" title={user.email}>{user.email}</span>
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="role-badge">
                          <i className={`role-mark ${MARK[user.role] || 'viewer'}`} /> {user.role}
                        </span>
                      </td>

                      <td>
                        <span className={`u-state ${active ? '' : 'off'}`}>
                          <i className="u-dot" /> {user.status || 'Aktif'}
                        </span>
                      </td>

                      <td className="c-time c-muted">{user.created_at || '—'}</td>

                      <td className="text-right">
                        {confirmId === user.id ? (
                          <div className="confirm">
                            <span>Erişimi kaldırılsın mı?</span>
                            <button className="mini danger" onClick={() => handleDeleteUser(user)}>Sil</button>
                            <button className="mini" onClick={() => setConfirmId(null)}>Vazgeç</button>
                          </div>
                        ) : busy ? (
                          <Loader2 size={15} className="spin" style={{ color: 'var(--ink-3)' }} />
                        ) : lastAdmin ? (
                          <span className="self-lock"><Lock size={12} /> Son süper admin</span>
                        ) : (
                          <div className="row-actions">
                            <button
                              className="action-btn delete"
                              title="Kullanıcıyı sil"
                              onClick={() => setConfirmId(user.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="table-empty">
                      {isFiltered ? (
                        <div className="empty">
                          <span className="empty-icon"><SearchX size={18} /></span>
                          <strong>Eşleşen kullanıcı yok</strong>
                          <p>Arama ve rol filtresi birlikte hiçbir kaydı getirmedi.</p>
                          <button className="btn" style={{ marginTop: 10 }} onClick={clearFilters}>
                            Filtreleri temizle
                          </button>
                        </div>
                      ) : (
                        <div className="empty">
                          <span className="empty-icon"><Users size={18} /></span>
                          <strong>Henüz kullanıcı yok</strong>
                          <p>Sisteme erişecek ilk kişiyi ekleyin ve rolünü belirleyin.</p>
                          <button className="btn-ink" style={{ marginTop: 10 }} onClick={() => setIsModalOpen(true)}>
                            <UserPlus size={15} /> Yeni kullanıcı
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredUsers.length > 0 && (
          <div className="table-foot">
            <span><span className="mono">{filteredUsers.length}</span> / {users.length} kullanıcı gösteriliyor</span>
            {isFiltered && <button className="btn-text" onClick={clearFilters}>Filtreleri temizle</button>}
          </div>
        )}
      </section>

      {/* YENİ KULLANICI MODALI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Sisteme kullanıcı ekle" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Sisteme kullanıcı ekle</h2>
                <p>Rol seçimine göre erişim yetkileri anında güncellenir.</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} aria-label="Kapat">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleAddUser} style={{ display: 'contents' }}>
              <div className="modal-body">
                <div className="field">
                  <label htmlFor="u-name">Ad soyad<span className="req">*</span></label>
                  <input
                    id="u-name"
                    type="text"
                    name="full_name"
                    autoFocus
                    autoComplete="off"
                    placeholder="Ahmet Yılmaz"
                    value={formData.full_name}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="u-mail">E-posta<span className="req">*</span></label>
                    <input
                      id="u-mail"
                      type="email"
                      name="email"
                      autoComplete="off"
                      placeholder="ahmet@sirket.com"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                    {formData.email && !isEmail(formData.email) && (
                      <span className="hint" style={{ color: 'var(--danger)' }}>Geçerli bir e-posta girin.</span>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="u-role">Rol</label>
                    <select id="u-role" name="role" value={formData.role} onChange={handleInputChange}>
                      <option value="Süper Admin">Süper Admin</option>
                      <option value="Operatör">Operatör</option>
                      <option value="İzleyici">İzleyici</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="u-pw">Geçici şifre<span className="req">*</span></label>
                  <div className="pw-wrap">
                    <input
                      id="u-pw"
                      type={showPw ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      placeholder="En az 6 karakter"
                      value={formData.password}
                      onChange={handleInputChange}
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <span className="hint">Kullanıcı ilk girişte kendi şifresini belirlemeli.</span>
                </div>

                {/* Rol seçimine göre canlı yetki önizlemesi */}
                <div className="perm-preview">
                  <div className="perm-preview-head">
                    <i className={`role-mark ${MARK[formData.role]}`} /> {formData.role} yetkileri
                  </div>
                  <ul className="perm-list">
                    {CAPS.map((cap) => {
                      const allowed = cap.roles.includes(formData.role);
                      return (
                        <li key={cap.label} className={allowed ? '' : 'off'}>
                          {allowed ? <Check size={13} strokeWidth={2.6} /> : <span>—</span>}
                          {cap.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                <button type="submit" className="btn-ink" disabled={!formValid || isSaving}>
                  {isSaving ? <><Loader2 size={14} className="spin" /> Ekleniyor</> : 'Kullanıcıyı ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}