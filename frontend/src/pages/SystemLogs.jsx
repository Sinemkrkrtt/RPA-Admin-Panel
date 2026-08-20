import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, X, Download, Eraser, ChevronDown, ChevronUp, ArrowDown,
  Copy, AlertCircle, CheckCircle2, SearchX, ScrollText, WifiOff
} from 'lucide-react';
import './SystemLogs.css';

const API = 'http://localhost:5000/api/logs';
const POLL_MS = 5000;
const STREAM_LIMIT = 120;
const STRIP_LIMIT = 64;

const LEVELS = [
  { key: 'All', label: 'Tümü', cls: 'all' },
  { key: 'Error', label: 'Hata', cls: 'error' },
  { key: 'Warning', label: 'Uyarı', cls: 'warning' },
  { key: 'Info', label: 'Bilgi', cls: 'info' },
  { key: 'Success', label: 'Başarılı', cls: 'success' }
];

const ABBR = { Error: 'ERR', Warning: 'WRN', Info: 'INF', Success: 'OK' };
const LABEL = { Error: 'Hata', Warning: 'Uyarı', Info: 'Bilgi', Success: 'Başarılı' };

const lvl = (log) => String(log?.log_type || 'Info');
const cls = (log) => lvl(log).toLowerCase();
const clock = (value) => {
  const s = String(value || '');
  return s.includes(' ') ? s.split(' ').pop() : s || '--:--';
};

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isLive, setIsLive] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [clearedIds, setClearedIds] = useState(() => new Set());
  const [expanded, setExpanded] = useState({});
  const [hasNew, setHasNew] = useState(false);
  const [toast, setToast] = useState(null);

  const bodyRef = useRef(null);
  const pinnedRef = useRef(true);
  const lastCountRef = useRef(0);

  const notify = useCallback((tone, text) => setToast({ tone, text }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- VERİ ---------------- */
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('logs');
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []); // API en yeniden eskiye döner
      setIsOffline(false);
    } catch (error) {
      console.error('Loglar çekilemedi:', error);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchLogs, POLL_MS);
    return () => clearInterval(id);
  }, [isLive, fetchLogs]);

  /* ---------------- TÜRETİLEN VERİ ---------------- */
  const counts = useMemo(() => {
    const base = { All: logs.length, Error: 0, Warning: 0, Info: 0, Success: 0 };
    logs.forEach((l) => { if (base[lvl(l)] !== undefined) base[lvl(l)] += 1; });
    return base;
  }, [logs]);

  /* Konsol: eskiden yeniye, temizlenenler hariç */
  const streamLogs = useMemo(
    () => logs.filter((l) => !clearedIds.has(l.id)).slice(0, STREAM_LIMIT).reverse(),
    [logs, clearedIds]
  );

  const stripLogs = useMemo(() => streamLogs.slice(-STRIP_LIMIT), [streamLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const hit = !q
        || String(log.message || '').toLowerCase().includes(q)
        || String(log.bot_name || '').toLowerCase().includes(q)
        || String(log.stack_trace || '').toLowerCase().includes(q);
      return hit && (filterType === 'All' || lvl(log) === filterType);
    });
  }, [logs, searchTerm, filterType]);

  const isFiltered = searchTerm.trim() !== '' || filterType !== 'All';

  /* ---------------- KONSOL KAYDIRMA ---------------- */
  const scrollToEnd = useCallback((smooth = true) => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    pinnedRef.current = true;
    setHasNew(false);
  }, []);

  const handleConsoleScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
    if (pinnedRef.current) setHasNew(false);
  };

  /* Yeni satır geldiğinde: kullanıcı en alttaysa takip et, değilse rozet göster */
  useEffect(() => {
    if (streamLogs.length === lastCountRef.current) return;
    const grew = streamLogs.length > lastCountRef.current;
    lastCountRef.current = streamLogs.length;
    if (pinnedRef.current) scrollToEnd(!isLoading);
    else if (grew) setHasNew(true);
  }, [streamLogs, isLoading, scrollToEnd]);

  /* ---------------- AKSİYONLAR ---------------- */
  const handleClearConsole = () => {
    setClearedIds(new Set(logs.map((l) => l.id)));
    setHasNew(false);
    pinnedRef.current = true;
    notify('ok', 'Konsol temizlendi. Kayıtlar veritabanında duruyor.');
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      notify('error', 'Dışa aktarılacak kayıt yok.');
      return;
    }
    const text = filteredLogs
      .map((l) => `[${l.created_at}] [${lvl(l).toUpperCase()}] ${l.bot_name}: ${l.message}${l.stack_trace ? `\n    ${String(l.stack_trace).replace(/\n/g, '\n    ')}` : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPA_Loglar_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('ok', `${filteredLogs.length} kayıt indirildi.`);
  };

  const copyTrace = async (trace) => {
    try {
      await navigator.clipboard.writeText(trace);
      notify('ok', 'Stack trace panoya kopyalandı.');
    } catch {
      notify('error', 'Kopyalanamadı. Metni elle seçebilirsiniz.');
    }
  };

  const toggleRow = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <main className="main-content">
      {/* BAŞLIK — tek satır */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">Loglar</h1>
          <div className="page-sub">
            <span className={`status-dot ${counts.Error > 0 || isOffline ? 'is-down' : ''}`} />
            <span className="count">{counts.All}</span> kayıt
            {counts.Error > 0 && (
              <>
                <span className="sep">·</span>
                <span className="count bad">{counts.Error}</span> hata
              </>
            )}
            <span className="sep">·</span>
            {isLive ? `${POLL_MS / 1000} sn'de bir yenileniyor` : 'yenileme duraklatıldı'}
          </div>
        </div>

        <div className="head-actions">
          <button className="btn" onClick={handleExport}>
            <Download size={15} /> Dışa aktar
          </button>
          <button
            className={`live-toggle ${isLive ? 'on' : ''}`}
            onClick={() => setIsLive((v) => !v)}
            aria-pressed={isLive}
          >
            <span className="live-dot" />
            {isLive ? 'Canlı izleme açık' : 'Canlı izleme kapalı'}
          </button>
        </div>
      </div>

      {isOffline && !isLoading && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Log akışı {API} adresinden alınamadı.</span>
          <button className="btn" onClick={fetchLogs}>Tekrar dene</button>
        </div>
      )}

      {/* KONSOL */}
      <section className="panel rise" style={{ '--d': '70ms' }}>
        <div className="console-head">
          <h2 className="panel-title">Canlı akış</h2>
          <div className="console-meta">
            <span>{streamLogs.length} satır</span>
            <span className="sep">·</span>
            <span>son {stripLogs.length} kayıt</span>
            <button className="btn-expand" onClick={handleClearConsole} title="Konsolu temizle" aria-label="Konsolu temizle">
              <Eraser size={14} />
            </button>
          </div>
        </div>

        {/* Yoğunluk şeridi: her tik bir kayıt, rengi seviyesi */}
        <div className={`strip ${isLive ? '' : 'paused'}`} aria-hidden="true">
          {stripLogs.length === 0
            ? <span className="strip-tick" style={{ opacity: .25 }} />
            : stripLogs.map((log) => (
                <span
                  key={`tick-${log.id}`}
                  className={`strip-tick ${cls(log)}`}
                  title={`${clock(log.created_at)} · ${log.bot_name} · ${LABEL[lvl(log)] || lvl(log)}`}
                />
              ))}
        </div>
        <div className="strip-axis">
          <span>eski</span>
          <span>{isLive ? 'canlı' : 'duraklatıldı'}</span>
        </div>

        <div className="console-wrap">
          <div className="console-body" ref={bodyRef} onScroll={handleConsoleScroll}>
            {isLoading ? (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <div className="console-line" key={i}>
                  <span className="skel" style={{ width: 44, height: 11 }} />
                  <span className="skel" style={{ width: 24, height: 11 }} />
                  <span className="skel" style={{ width: 96, height: 11 }} />
                  <span className="skel" style={{ width: `${45 + (i % 3) * 15}%`, height: 11 }} />
                </div>
              ))
            ) : streamLogs.length === 0 ? (
              <div className="console-idle">
                <span className="caret" />
                {clearedIds.size > 0 ? 'Konsol temizlendi, yeni kayıt bekleniyor.' : 'Yeni kayıt bekleniyor.'}
              </div>
            ) : (
              streamLogs.map((log) => (
                <div className={`console-line ${cls(log)}`} key={`term-${log.id}`}>
                  <span className="cl-time">{clock(log.created_at)}</span>
                  <span className="cl-level">{ABBR[lvl(log)] || 'LOG'}</span>
                  <span className="cl-bot">{log.bot_name}</span>
                  <span className="cl-msg">{log.message}</span>
                </div>
              ))
            )}
          </div>

          {hasNew && (
            <button className="jump-btn" onClick={() => scrollToEnd()}>
              <ArrowDown size={13} /> Yeni kayıtlar
            </button>
          )}
        </div>
      </section>

      {/* GEÇMİŞ TABLOSU */}
      <section className="panel rise" style={{ '--d': '120ms' }}>
        <div className="panel-head toolbar">
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Mesaj, bot veya stack trace ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Log ara"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')} aria-label="Aramayı temizle">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="lvl-chips">
            {LEVELS.map((level) => (
              <button
                key={level.key}
                className={`lvl-chip ${level.cls} ${filterType === level.key ? 'on' : ''}`}
                onClick={() => setFilterType(level.key)}
                aria-pressed={filterType === level.key}
              >
                <i /> {level.label} <span className="c">{counts[level.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table log-table">
            <thead>
              <tr>
                <th style={{ width: 96 }}>Seviye</th>
                <th style={{ width: 150 }}>Zaman</th>
                <th style={{ width: 180 }}>Robot</th>
                <th>Mesaj</th>
                <th style={{ width: 56 }} aria-label="Detay" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td><div className="skel" style={{ width: 62, height: 16 }} /></td>
                    <td><div className="skel" style={{ width: 108, height: 12 }} /></td>
                    <td><div className="skel" style={{ width: 120, height: 12 }} /></td>
                    <td><div className="skel" style={{ width: '70%', height: 12 }} /></td>
                    <td />
                  </tr>
                ))
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const level = cls(log);
                  const open = !!expanded[log.id];
                  const hasTrace = !!log.stack_trace;

                  return (
                    <React.Fragment key={`tbl-${log.id}`}>
                      <tr
                        className={`lg-row level-${level} ${hasTrace ? 'has-trace' : ''} ${open ? 'open' : ''}`}
                        onClick={hasTrace ? () => toggleRow(log.id) : undefined}
                      >
                        <td><span className={`tag ${level}`}>{LABEL[lvl(log)] || lvl(log)}</span></td>
                        <td className="c-time c-muted">{log.created_at}</td>
                        <td className="c-id" style={{ color: 'var(--ink-2)' }}>{log.bot_name}</td>
                        <td><div className="lg-msg">{log.message}</div></td>
                        <td>
                          {hasTrace && (
                            <button
                              className="btn-expand"
                              onClick={(e) => { e.stopPropagation(); toggleRow(log.id); }}
                              aria-expanded={open}
                              title={open ? 'Detayı kapat' : 'Hata detayını aç'}
                            >
                              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                        </td>
                      </tr>

                      {open && hasTrace && (
                        <tr className="trace-row">
                          <td colSpan="5">
                            <div className="trace-box">
                              <div className="trace-head">
                                <span>Stack trace</span>
                                <button className="copy-btn" onClick={() => copyTrace(log.stack_trace)}>
                                  <Copy size={11} /> Kopyala
                                </button>
                              </div>
                              <pre>{log.stack_trace}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="table-empty">
                      {isFiltered ? (
                        <div className="empty">
                          <span className="empty-icon"><SearchX size={18} /></span>
                          <strong>Eşleşen kayıt yok</strong>
                          <p>Seçili seviye ve arama birlikte hiçbir kaydı getirmedi.</p>
                          <button
                            className="btn"
                            style={{ marginTop: 10 }}
                            onClick={() => { setSearchTerm(''); setFilterType('All'); }}
                          >
                            Filtreleri temizle
                          </button>
                        </div>
                      ) : (
                        <div className="empty">
                          <span className="empty-icon"><ScrollText size={18} /></span>
                          <strong>Henüz log yok</strong>
                          <p>Robotlar çalışmaya başladığında kayıtlar buraya düşecek.</p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredLogs.length > 0 && (
          <div className="table-foot">
            <span><span className="mono">{filteredLogs.length}</span> / {counts.All} kayıt gösteriliyor</span>
            {isFiltered && (
              <button className="btn-text" onClick={() => { setSearchTerm(''); setFilterType('All'); }}>
                Filtreleri temizle
              </button>
            )}
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