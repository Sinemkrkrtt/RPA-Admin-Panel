import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, Play, Square, RotateCw, Trash2, CalendarClock,
  X, Loader2, WifiOff, CheckCircle2, AlertCircle, SearchX, Bot as BotIcon
} from 'lucide-react';
import './BotManagement.css';

const API = 'https://rpa-admin-panel.onrender.com/api/robots';

/* Backend kapalıyken arayüzün boş kalmaması için örnek kayıt */
const FALLBACK = [
  {
    id: 'BOT-001',
    name: 'Fatura_Botu_v2',
    version: '2.1.0',
    last_run: '17.08.2026 14:30',
    status: 'Running',
    schedule: '09:00 (Her gün)',
    description: 'E-fatura portalından günlük fatura indirir ve ERP’ye aktarır.'
  }
];

const STATUSES = [
  { key: 'All', label: 'Tümü' },
  { key: 'Running', label: 'Çalışıyor' },
  { key: 'Idle', label: 'Bekliyor' },
  { key: 'Stopped', label: 'Durduruldu' },
  { key: 'Error', label: 'Hata' }
];

const STATE_LABEL = {
  Running: 'Çalışıyor',
  Idle: 'Bekliyor',
  Stopped: 'Durduruldu',
  Error: 'Hata'
};

const stamp = () => {
  const now = new Date();
  return `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
};

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <tr key={i}>
          <td><div className="skel" style={{ width: 62, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 150, height: 13 }} /></td>
          <td><div className="skel" style={{ width: 48, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 108, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 76, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 118, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 120, height: 12, marginLeft: 'auto' }} /></td>
        </tr>
      ))}
    </>
  );
}

export default function BotManagement() {
  const [bots, setBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', version: '1.0.0', schedule: 'Yok', description: ''
  });

  const notify = useCallback((tone, text) => setToast({ tone, text }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- VERİ ---------------- */
  const fetchBots = useCallback(async () => {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('sunucu');
      setBots(await response.json());
      setIsOffline(false);
    } catch (error) {
      console.error('Backend bağlantı hatası:', error);
      setBots(FALLBACK);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const handleAddBot = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('kaydedilemedi');

      const savedBot = await response.json();
      setBots((prev) => [savedBot, ...prev]);
      setIsModalOpen(false);
      setFormData({ name: '', version: '1.0.0', schedule: 'Yok', description: '' });
      notify('ok', `${savedBot.name} sisteme eklendi.`);
    } catch (error) {
      console.error('Bot eklenirken hata oluştu:', error);
      notify('error', 'Robot kaydedilemedi. Backend terminalini kontrol edin.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBot = async (bot) => {
    setConfirmId(null);
    setBusyId(bot.id);
    try {
      const response = await fetch(`${API}/${bot.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('silinemedi');
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      notify('ok', `${bot.name} silindi.`);
    } catch (error) {
      console.error('Bot silinirken hata:', error);
      notify('error', 'Robot silinemedi. Bağlantıyı kontrol edin.');
    } finally {
      setBusyId(null);
    }
  };

  const pushStatus = async (bot, newStatus) => {
    const response = await fetch(`${API}/${bot.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        last_run: newStatus === 'Running' ? stamp() : bot.last_run
      })
    });
    if (!response.ok) throw new Error('durum');
    return response.json();
  };

  const handleStatusChange = async (bot, newStatus) => {
    setBusyId(bot.id);
    try {
      const updated = await pushStatus(bot, newStatus);
      setBots((prev) => prev.map((b) => (b.id === bot.id ? updated : b)));
    } catch (error) {
      console.error('Durum güncelleme hatası:', error);
      notify('error', `${bot.name} için durum güncellenemedi.`);
    } finally {
      setBusyId(null);
    }
  };

  /* Gerçek yeniden başlatma: önce durdur, sonra çalıştır */
  const handleRestart = async (bot) => {
    setBusyId(bot.id);
    try {
      await pushStatus(bot, 'Stopped');
      const updated = await pushStatus(bot, 'Running');
      setBots((prev) => prev.map((b) => (b.id === bot.id ? updated : b)));
      notify('ok', `${bot.name} yeniden başlatıldı.`);
    } catch (error) {
      console.error('Yeniden başlatma hatası:', error);
      notify('error', `${bot.name} yeniden başlatılamadı.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleInputChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  /* Modal: Esc ile kapan + arka planı kilitle */
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
  const counts = useMemo(() => {
    const base = { All: bots.length, Running: 0, Idle: 0, Stopped: 0, Error: 0 };
    bots.forEach((b) => { if (base[b.status] !== undefined) base[b.status] += 1; });
    return base;
  }, [bots]);

  const filteredBots = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bots.filter((bot) => {
      const hit = !q
        || String(bot.name || '').toLowerCase().includes(q)
        || String(bot.id || '').toLowerCase().includes(q);
      return hit && (filterStatus === 'All' || bot.status === filterStatus);
    });
  }, [bots, searchTerm, filterStatus]);

  const isFiltered = searchTerm.trim() !== '' || filterStatus !== 'All';

  return (
    <main className="main-content">
      {/* BAŞLIK — tek satır, boşluk yok */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">Robotlar</h1>
          <div className="page-sub">
            <span className={`status-dot ${counts.Error > 0 || isOffline ? 'is-down' : ''}`} />
            <span className="count">{counts.All}</span> robot
            <span className="sep">·</span>
            <span className="count">{counts.Running}</span> çalışıyor
            {counts.Error > 0 && (
              <>
                <span className="sep">·</span>
                <span className="count bad">{counts.Error}</span> hata
              </>
            )}
          </div>
        </div>

        <div className="head-actions">
          <button className="btn-ink" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> Yeni robot
          </button>
        </div>
      </div>

      {isOffline && !isLoading && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Sunucuya bağlanılamadı, örnek kayıt gösteriliyor. Yaptığınız değişiklikler kaydedilmez.</span>
          <button className="btn" onClick={fetchBots}>Tekrar dene</button>
        </div>
      )}

      {/* TABLO PANELİ */}
      <section className="panel rise" style={{ '--d': '80ms' }}>
        <div className="panel-head toolbar">
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Robot adı veya ID ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Robot ara"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')} aria-label="Aramayı temizle">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="seg" role="tablist" aria-label="Duruma göre filtrele">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={filterStatus === s.key}
                className={filterStatus === s.key ? 'on' : ''}
                onClick={() => setFilterStatus(s.key)}
              >
                {s.label} <span className="c">{counts[s.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Robot ID</th>
                <th>İsim</th>
                <th>Versiyon</th>
                <th>Son çalışma</th>
                <th>Durum</th>
                <th>Zamanlama</th>
                <th className="text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : filteredBots.length > 0 ? (
                filteredBots.map((bot) => {
                  const busy = busyId === bot.id;
                  const level = String(bot.status || '').toLowerCase();

                  return (
                    <tr key={bot.id} className={busy ? 'is-busy' : ''}>
                      <td className="c-id">{bot.id}</td>
                      <td>
                        <div className="c-name">{bot.name}</div>
                        {bot.description && <div className="c-desc" title={bot.description}>{bot.description}</div>}
                      </td>
                      <td><span className="chip-v">v{bot.version}</span></td>
                      <td className="c-time">{bot.last_run || <span className="c-muted">—</span>}</td>
                      <td>
                        <span className={`state ${level}`}>
                          <i className="state-dot" />
                          {STATE_LABEL[bot.status] || bot.status}
                        </span>
                      </td>
                      <td>
                        {bot.schedule && bot.schedule !== 'Yok' ? (
                          <span className="schedule-cell"><CalendarClock size={14} /> {bot.schedule}</span>
                        ) : (
                          <span className="schedule-cell c-muted"><CalendarClock size={14} /> Manuel</span>
                        )}
                      </td>
                      <td className="text-right">
                        {confirmId === bot.id ? (
                          <div className="confirm">
                            <span>Bu robot silinsin mi?</span>
                            <button className="mini danger" onClick={() => handleDeleteBot(bot)}>Sil</button>
                            <button className="mini" onClick={() => setConfirmId(null)}>Vazgeç</button>
                          </div>
                        ) : (
                          <div className="row-actions">
                            {busy ? (
                              <Loader2 size={15} className="spin" style={{ color: 'var(--ink-3)' }} />
                            ) : (
                              <>
                                <button
                                  className="action-btn play"
                                  title="Başlat"
                                  onClick={() => handleStatusChange(bot, 'Running')}
                                  disabled={bot.status === 'Running'}
                                >
                                  <Play size={15} />
                                </button>
                                <button
                                  className="action-btn stop"
                                  title="Durdur"
                                  onClick={() => handleStatusChange(bot, 'Stopped')}
                                  disabled={bot.status !== 'Running'}
                                >
                                  <Square size={15} />
                                </button>
                                <button
                                  className="action-btn restart"
                                  title="Yeniden başlat"
                                  onClick={() => handleRestart(bot)}
                                  disabled={bot.status !== 'Running'}
                                >
                                  <RotateCw size={15} />
                                </button>

                                <span className="action-divider" />

                                <button
                                  className="action-btn delete"
                                  title="Sil"
                                  onClick={() => setConfirmId(bot.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7">
                    <div className="table-empty">
                      {isFiltered ? (
                        <div className="empty">
                          <span className="empty-icon"><SearchX size={18} /></span>
                          <strong>Eşleşen robot yok</strong>
                          <p>Arama ve filtre birlikte hiçbir kaydı getirmedi.</p>
                          <button
                            className="btn"
                            style={{ marginTop: 10 }}
                            onClick={() => { setSearchTerm(''); setFilterStatus('All'); }}
                          >
                            Filtreleri temizle
                          </button>
                        </div>
                      ) : (
                        <div className="empty">
                          <span className="empty-icon"><BotIcon size={18} /></span>
                          <strong>Henüz robot yok</strong>
                          <p>İlk robotu tanımlayın; durumu ve çalışma geçmişi burada listelenecek.</p>
                          <button className="btn-ink" style={{ marginTop: 10 }} onClick={() => setIsModalOpen(true)}>
                            <Plus size={15} /> Yeni robot
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

        {!isLoading && filteredBots.length > 0 && (
          <div className="table-foot">
            <span><span className="mono">{filteredBots.length}</span> / {counts.All} kayıt gösteriliyor</span>
            {isFiltered && (
              <button className="btn-text" onClick={() => { setSearchTerm(''); setFilterStatus('All'); }}>
                Filtreleri temizle
              </button>
            )}
          </div>
        )}
      </section>

      {/* YENİ ROBOT MODALI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Yeni robot tanımla" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Yeni robot tanımla</h2>
                <p>Robot kaydedildikten sonra tablodan başlatabilirsiniz.</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} aria-label="Kapat">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleAddBot} style={{ display: 'contents' }}>
              <div className="modal-body">
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="bot-name">Robot adı<span className="req">*</span></label>
                    <input
                      id="bot-name"
                      type="text"
                      name="name"
                      required
                      autoFocus
                      autoComplete="off"
                      placeholder="Raporlama_Botu"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                    <span className="hint">Boşluk yerine alt çizgi kullanın.</span>
                  </div>
                  <div className="field">
                    <label htmlFor="bot-version">Versiyon</label>
                    <input
                      id="bot-version"
                      type="text"
                      name="version"
                      placeholder="1.0.0"
                      value={formData.version}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="bot-schedule">Çalışma zamanı</label>
                  <select id="bot-schedule" name="schedule" value={formData.schedule} onChange={handleInputChange}>
                    <option value="Yok">Manuel — yalnızca elle başlatılır</option>
                    <option value="Saat başı">Her saat başı</option>
                    <option value="09:00 (Her gün)">Her gün 09:00</option>
                    <option value="23:59 (Her gün)">Her gece 23:59</option>
                    <option value="Haftalık (Pazartesi)">Her pazartesi</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="bot-desc">Açıklama</label>
                  <textarea
                    id="bot-desc"
                    name="description"
                    rows="3"
                    placeholder="Bu robotun hangi süreci otomatikleştirdiğini yazın."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                  <span className="hint">Tabloda robot adının altında görünür.</span>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                <button type="submit" className="btn-ink" disabled={isSaving || !formData.name.trim()}>
                  {isSaving ? <><Loader2 size={14} className="spin" /> Kaydediliyor</> : 'Robotu kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}