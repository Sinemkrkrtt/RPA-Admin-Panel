import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, X, ShieldCheck, RefreshCcw, Download, Plus, PenLine, Trash2,
  LogIn, Activity, AlertCircle, CheckCircle2, SearchX, WifiOff
} from 'lucide-react';
import './AuditLogs.css';

const API = 'https://rpa-admin-panel.onrender.com/api/audit-logs';

/* Eylem metninden kategori çıkarımı — backend'de tip alanı yok */
const CATEGORIES = [
  { key: 'create', label: 'Oluşturma', icon: Plus, patterns: [/ekle/i, /oluştur/i, /tanımla/i, /create/i, /add/i] },
  { key: 'delete', label: 'Silme', icon: Trash2, patterns: [/sil/i, /kaldır/i, /delete/i, /remove/i] },
  { key: 'auth', label: 'Oturum ve yetki', icon: LogIn, patterns: [/giriş/i, /çıkış/i, /login/i, /logout/i, /yetki/i, /rol/i, /şifre/i] },
  { key: 'update', label: 'Güncelleme', icon: PenLine, patterns: [/güncelle/i, /değiş/i, /düzenle/i, /başlat/i, /durdur/i, /update/i, /edit/i] },
  { key: 'other', label: 'Diğer', icon: Activity, patterns: [] }
];

const categorize = (action) => {
  const text = String(action || '');
  for (const cat of CATEGORIES) {
    if (cat.patterns.some((p) => p.test(text))) return cat;
  }
  return CATEGORIES[CATEGORIES.length - 1];
};

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
};

const tint = (seed) => {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 5;
};

const dayKey = (value) => String(value || '').split(' ')[0] || 'Bilinmeyen';
const timePart = (value) => {
  const parts = String(value || '').split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '--:--';
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [toast, setToast] = useState(null);

  const notify = useCallback((tone, text) => setToast({ tone, text }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(id);
  }, [toast]);

  const fetchAuditLogs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('audit');
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
      setIsOffline(false);
    } catch (error) {
      console.error('Denetim izleri çekilemedi:', error);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

  /* ---------------- TÜRETİLEN VERİ ---------------- */
  const catCounts = useMemo(() => {
    const base = { create: 0, delete: 0, auth: 0, update: 0, other: 0 };
    logs.forEach((l) => { base[categorize(l.action).key] += 1; });
    return base;
  }, [logs]);

  const actors = useMemo(() => {
    const map = new Map();
    logs.forEach((l) => {
      const name = l.user_name || 'Bilinmeyen';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const hit = !q
        || String(log.user_name || '').toLowerCase().includes(q)
        || String(log.action || '').toLowerCase().includes(q)
        || String(log.details || '').toLowerCase().includes(q);
      const catOk = catFilter === 'All' || categorize(log.action).key === catFilter;
      const actorOk = actorFilter === 'All' || (log.user_name || 'Bilinmeyen') === actorFilter;
      return hit && catOk && actorOk;
    });
  }, [logs, searchTerm, catFilter, actorFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    filteredLogs.forEach((log) => {
      const key = dayKey(log.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(log);
    });
    return [...map.entries()];
  }, [filteredLogs]);

  const todayKey = new Date().toLocaleDateString('tr-TR');
  const yesterdayKey = new Date(Date.now() - 86400000).toLocaleDateString('tr-TR');

  const dayLabel = (key) => {
    if (key === todayKey) return 'Bugün';
    if (key === yesterdayKey) return 'Dün';
    const m = key.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${Number(m[1])} ${MONTHS[Number(m[2]) - 1] || ''} ${m[3]}`;
    return key;
  };

  const isFiltered = searchTerm.trim() !== '' || catFilter !== 'All' || actorFilter !== 'All';
  const clearFilters = () => { setSearchTerm(''); setCatFilter('All'); setActorFilter('All'); };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      notify('error', 'Dışa aktarılacak kayıt yok.');
      return;
    }
    let csv = 'Log ID,Tarih,Kullanici,Eylem,Detay\n';
    filteredLogs.forEach((log) => {
      const safe = (v) => String(v ?? '').replace(/[,\n]/g, ' ');
      csv += `LOG-${log.id},${safe(log.created_at)},${safe(log.user_name)},${safe(log.action)},${safe(log.details)}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Denetim_Izleri_${new Date().toLocaleDateString('tr-TR')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('ok', `${filteredLogs.length} kayıt indirildi.`);
  };

  return (
    <main className="main-content">
      {/* BAŞLIK — tek satır */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">Denetim İzleri</h1>
          <div className="page-sub">
            <span className={`status-dot ${isOffline ? 'is-down' : ''}`} />
            <span className="count">{logs.length}</span> kayıt
            {catCounts.delete > 0 && (
              <>
                <span className="sep">·</span>
                <span className="count bad">{catCounts.delete}</span> silme işlemi
              </>
            )}
          </div>
        </div>

        <div className="head-actions">
          <button className="btn icon-only" onClick={fetchAuditLogs} disabled={isRefreshing} title="Yenile" aria-label="Yenile">
            <RefreshCcw size={15} className={isRefreshing ? 'spin' : ''} />
          </button>
          <button className="btn" onClick={handleExport}>
            <Download size={15} /> CSV indir
          </button>
        </div>
      </div>

      {isOffline && !isLoading && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Denetim kayıtları {API} adresinden alınamadı.</span>
          <button className="btn" onClick={fetchAuditLogs}>Tekrar dene</button>
        </div>
      )}

      <section className="panel rise" style={{ '--d': '70ms' }}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Eylem geçmişi</h2>
            <p className="panel-desc">Kim, ne zaman, neyi değiştirdi</p>
          </div>
          <span className="readonly-chip"><ShieldCheck size={12} /> Salt okunur</span>
        </div>

        <div className="aud-toolbar">
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Kullanıcı, eylem veya detay ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Denetim kaydı ara"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')} aria-label="Aramayı temizle">
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className={`aud-select ${catFilter !== 'All' ? 'on' : ''}`}
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Eylem türü"
          >
            <option value="All">Tüm eylemler ({logs.length})</option>
            {CATEGORIES.filter((c) => catCounts[c.key] > 0).map((c) => (
              <option key={c.key} value={c.key}>{c.label} ({catCounts[c.key]})</option>
            ))}
          </select>

          <select
            className={`aud-select ${actorFilter !== 'All' ? 'on' : ''}`}
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            aria-label="Kullanıcı"
          >
            <option value="All">Tüm kullanıcılar ({actors.length})</option>
            {actors.map(([name, n]) => (
              <option key={name} value={name}>{name} ({n})</option>
            ))}
          </select>
        </div>

        {/* KAYIT DEFTERİ */}
        {isLoading ? (
          <div className="ledger" style={{ paddingTop: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="entry" key={i}>
                <span className="skel" style={{ width: 36, height: 11, marginTop: 8, marginLeft: 'auto' }} />
                <span className="skel" style={{ width: 9, height: 9, borderRadius: 9, marginTop: 10 }} />
                <div>
                  <div className="skel" style={{ width: `${40 + (i % 3) * 12}%`, height: 13 }} />
                  <div className="skel" style={{ width: '62%', height: 11, marginTop: 7 }} />
                </div>
                <span />
              </div>
            ))}
          </div>
        ) : groups.length > 0 ? (
          <div className="ledger">
            {groups.map(([key, entries]) => (
              <div className="day-block" key={key}>
                <div className="day-head">
                  <span className="day-name">{dayLabel(key)}</span>
                  {dayLabel(key) !== key && <span className="day-raw">{key}</span>}
                  <span className="day-count">{entries.length} kayıt</span>
                </div>

                {entries.map((log) => {
                  const cat = categorize(log.action);
                  const Icon = cat.icon;

                  return (
                    <div className="entry" key={log.id}>
                      <span className="entry-time">{timePart(log.created_at)}</span>
                      <span className="spine"><i className={`node ${cat.key}`} /></span>

                      <div className="entry-body">
                        <div className="entry-line">
                          <span className={`aud-avatar tint-${tint(log.user_name)}`}>{initials(log.user_name)}</span>
                          <span className="actor">{log.user_name || 'Bilinmeyen'}</span>
                          <span className={`act-chip ${cat.key}`}><Icon size={11} /> {log.action}</span>
                        </div>
                        {log.details && <p className="entry-detail">{log.details}</p>}
                      </div>

                      <span className="entry-id">LOG-{log.id}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '8px 0 4px' }}>
            {isFiltered ? (
              <div className="empty">
                <span className="empty-icon"><SearchX size={18} /></span>
                <strong>Eşleşen kayıt yok</strong>
                <p>Seçili filtreler birlikte hiçbir denetim kaydı getirmedi.</p>
                <button className="btn" style={{ marginTop: 10 }} onClick={clearFilters}>Filtreleri temizle</button>
              </div>
            ) : (
              <div className="empty">
                <span className="empty-icon"><ShieldCheck size={18} /></span>
                <strong>Henüz denetim kaydı yok</strong>
                <p>Kullanıcılar sistemde işlem yaptıkça eylemler buraya kronolojik olarak yazılır.</p>
              </div>
            )}
          </div>
        )}

        {!isLoading && filteredLogs.length > 0 && (
          <div className="table-foot">
            <span><span className="mono">{filteredLogs.length}</span> / {logs.length} kayıt gösteriliyor</span>
            {isFiltered && <button className="btn-text" onClick={clearFilters}>Filtreleri temizle</button>}
          </div>
        )}
      </section>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}