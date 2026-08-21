import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, Plus, RefreshCcw, Download, Trash2, PlayCircle, CheckCircle2,
  AlertCircle, Clock, Loader2, ChevronRight, Bot as BotIcon, ListTodo,
  SearchX, WifiOff, Flag
} from 'lucide-react';
import './QueueManagement.css';

const API = 'https://rpa-admin-panel.onrender.com/api';

const STAGES = [
  { key: 'All', label: 'Tümü', icon: ListTodo },
  { key: 'Pending', label: 'Bekliyor', icon: Clock },
  { key: 'Processing', label: 'İşleniyor', icon: PlayCircle },
  { key: 'Completed', label: 'Tamamlandı', icon: CheckCircle2 },
  { key: 'Failed', label: 'Hatalı', icon: AlertCircle }
];

const STATUS_META = {
  Pending: { label: 'Bekliyor', cls: 'pending' },
  Processing: { label: 'İşleniyor', cls: 'processing' },
  Completed: { label: 'Tamamlandı', cls: 'completed' },
  Failed: { label: 'Hatalı', cls: 'failed' }
};

const PRIO_RANK = { 'Yüksek': 3, 'Normal': 2, 'Düşük': 1 };
const PRIO_CLS = { 'Yüksek': 'high', 'Normal': 'normal', 'Düşük': 'low' };

const stamp = () => {
  const now = new Date();
  return `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
};

function PriorityBars({ value }) {
  return (
    <span className={`prio ${PRIO_CLS[value] || 'low'}`}>
      <span className="bars"><i /><i /><i /></span>
      {value}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <tr key={i}>
          <td className="rail-cell" />
          <td><div className="skel" style={{ width: 240, height: 13 }} /></td>
          <td><div className="skel" style={{ width: 108, height: 20, borderRadius: 20 }} /></td>
          <td><div className="skel" style={{ width: 70, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 106, height: 12 }} /></td>
          <td><div className="skel" style={{ width: 82, height: 16 }} /></td>
          <td><div className="skel" style={{ width: 90, height: 12, marginLeft: 'auto' }} /></td>
        </tr>
      ))}
    </>
  );
}

export default function QueueManagement() {
  const [tasks, setTasks] = useState([]);
  const [availableBots, setAvailableBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('priority');

  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ bot_name: '', description: '', priority: 'Normal' });

  const notify = useCallback((tone, text) => setToast({ tone, text }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- VERİ ---------------- */
  const fetchTasks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API}/tasks`);
      if (!response.ok) throw new Error('tasks');
      setTasks(await response.json());
      setIsOffline(false);
    } catch (error) {
      console.error('İşler çekilemedi:', error);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchBots = useCallback(async () => {
    try {
      const response = await fetch(`${API}/robots`);
      if (!response.ok) throw new Error('robots');
      const data = await response.json();
      setAvailableBots(data);
      if (data.length > 0) {
        setFormData((prev) => (prev.bot_name ? prev : { ...prev, bot_name: data[0].name }));
      }
    } catch (error) {
      console.error('Botlar çekilemedi:', error);
    }
  }, []);

  useEffect(() => { fetchTasks(); fetchBots(); }, [fetchTasks, fetchBots]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!formData.description.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, created_at: stamp() })
      });
      if (!response.ok) throw new Error('kaydedilemedi');

      const savedTask = await response.json();
      setTasks((prev) => [savedTask, ...prev]);
      setIsModalOpen(false);
      setFormData((prev) => ({ ...prev, description: '', priority: 'Normal' }));
      notify('ok', 'Görev kuyruğa eklendi.');
    } catch (error) {
      console.error('Görev eklenirken hata:', error);
      notify('error', 'Görev kuyruğa eklenemedi. Backend terminalini kontrol edin.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTaskStatusChange = async (task, newStatus) => {
    setBusyId(task.id);
    try {
      const response = await fetch(`${API}/tasks/${task.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('durum');

      const updatedTask = await response.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));

      /* Görevi yürüten robotun durumunu da senkronla */
      const targetBot = availableBots.find((b) => b.name === task.bot_name);
      if (targetBot) {
        await fetch(`${API}/robots/${targetBot.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus === 'Processing' ? 'Running' : 'Idle',
            last_run: stamp()
          })
        });
      }
    } catch (error) {
      console.error('Durum güncellenirken hata:', error);
      notify('error', 'Görev durumu güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTask = async (task) => {
    setConfirmId(null);
    setBusyId(task.id);
    try {
      const response = await fetch(`${API}/tasks/${task.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('silinemedi');
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      notify('ok', `TASK-${task.id} kuyruktan silindi.`);
    } catch (error) {
      console.error('Görev silinirken hata:', error);
      notify('error', 'Görev silinemedi. Bağlantıyı kontrol edin.');
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
  const counts = useMemo(() => {
    const base = { All: tasks.length, Pending: 0, Processing: 0, Completed: 0, Failed: 0 };
    tasks.forEach((t) => { if (base[t.status] !== undefined) base[t.status] += 1; });
    return base;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = tasks.filter((task) => {
      const hit = !q
        || String(task.description || '').toLowerCase().includes(q)
        || String(task.bot_name || '').toLowerCase().includes(q)
        || String(task.id || '').toLowerCase().includes(q);
      return hit && (filterStatus === 'All' || task.status === filterStatus);
    });

    return list.sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = (PRIO_RANK[b.priority] || 0) - (PRIO_RANK[a.priority] || 0);
        if (diff !== 0) return diff;
      }
      return Number(b.id) - Number(a.id);
    });
  }, [tasks, searchTerm, filterStatus, sortBy]);

  const isFiltered = searchTerm.trim() !== '' || filterStatus !== 'All';
  const clearFilters = () => { setSearchTerm(''); setFilterStatus('All'); };

  const handleExportCSV = () => {
    if (visibleTasks.length === 0) {
      notify('error', 'Dışa aktarılacak görev yok.');
      return;
    }
    let csv = 'Gorev ID,Bagli Bot,Is Detayi,Oncelik,Olusturulma,Durum\n';
    visibleTasks.forEach((task) => {
      const safeDesc = String(task.description || '').replace(/[,\n]/g, ' ');
      csv += `TASK-${task.id},${task.bot_name},${safeDesc},${task.priority},${task.created_at},${task.status}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Is_Kuyrugu_${new Date().toLocaleDateString('tr-TR')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('ok', `${visibleTasks.length} görev CSV olarak indirildi.`);
  };

  return (
    <main className="main-content">
      {/* BAŞLIK — tek satır */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">İş Kuyruğu</h1>
          <div className="page-sub">
            <span className={`status-dot ${counts.Failed > 0 || isOffline ? 'is-down' : ''}`} />
            <span className="count">{counts.Pending}</span> bekliyor
            <span className="sep">·</span>
            <span className="count">{counts.Processing}</span> işleniyor
            {counts.Failed > 0 && (
              <>
                <span className="sep">·</span>
                <span className="count bad">{counts.Failed}</span> hatalı
              </>
            )}
          </div>
        </div>

        <div className="head-actions">
          <button className="btn icon-only" onClick={fetchTasks} disabled={isRefreshing} title="Kuyruğu yenile" aria-label="Kuyruğu yenile">
            <RefreshCcw size={15} className={isRefreshing ? 'spin' : ''} />
          </button>
          <button className="btn" onClick={handleExportCSV}>
            <Download size={15} /> CSV indir
          </button>
          <button className="btn-ink" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> Yeni iş ata
          </button>
        </div>
      </div>

      {isOffline && !isLoading && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Kuyruk verisi {API}/tasks adresinden alınamadı.</span>
          <button className="btn" onClick={fetchTasks}>Tekrar dene</button>
        </div>
      )}

      {/* KUYRUK HATTI — hem özet hem filtre */}
      <div className="pipeline rise" style={{ '--d': '70ms' }} role="tablist" aria-label="Aşamaya göre filtrele">
        {STAGES.map((stage, i) => {
          const value = counts[stage.key];
          const share = counts.All ? Math.round((value / counts.All) * 100) : 0;
          const Icon = stage.icon;

          return (
            <React.Fragment key={stage.key}>
              {(i === 2 || i === 3) && (
                <span className="stage-arrow" aria-hidden="true"><ChevronRight size={15} /></span>
              )}
              <button
                role="tab"
                aria-selected={filterStatus === stage.key}
                className={`stage ${stage.key.toLowerCase()} ${filterStatus === stage.key ? 'on' : ''} ${value === 0 ? 'is-empty' : ''}`}
                onClick={() => setFilterStatus(stage.key)}
              >
                <span className="stage-label"><Icon size={12} /> {stage.label}</span>
                <span className="stage-count">{value}</span>
                <span className="stage-meter">
                  <span style={{ width: `${stage.key === 'All' ? 100 : share}%` }} />
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* TABLO */}
      <section className="panel rise" style={{ '--d': '110ms' }}>
        <div className="panel-head toolbar">
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Görev, bot veya ID ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Görev ara"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')} aria-label="Aramayı temizle">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="toolbar-right">
            <span className="sort-label">Sırala</span>
            <div className="seg">
              <button className={sortBy === 'priority' ? 'on' : ''} onClick={() => setSortBy('priority')}>Öncelik</button>
              <button className={sortBy === 'newest' ? 'on' : ''} onClick={() => setSortBy('newest')}>En yeni</button>
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="rail-cell" aria-label="Durum rayı" />
                <th>Görev</th>
                <th>Bağlı robot</th>
                <th>Öncelik</th>
                <th>Oluşturulma</th>
                <th>Durum</th>
                <th className="text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : visibleTasks.length > 0 ? (
                visibleTasks.map((task) => {
                  const busy = busyId === task.id;
                  const meta = STATUS_META[task.status] || { label: task.status, cls: 'pending' };

                  return (
                    <tr key={task.id} className={`${busy ? 'is-busy' : ''} ${task.status === 'Completed' ? 'is-done' : ''}`}>
                      <td className="rail-cell"><span className={`q-rail ${meta.cls}`} /></td>

                      <td>
                        <div className="task-desc" title={task.description}>{task.description}</div>
                        <div className="task-meta">TASK-{task.id}</div>
                      </td>

                      <td>
                        <span className="bot-chip"><BotIcon size={13} /> {task.bot_name}</span>
                      </td>

                      <td><PriorityBars value={task.priority} /></td>

                      <td className="c-time c-muted">{task.created_at || '—'}</td>

                      <td>
                        <span className={`tag ${meta.cls}`}>
                          {task.status === 'Processing' && <Loader2 size={11} className="spin" />}
                          {meta.label}
                        </span>
                      </td>

                      <td className="text-right">
                        {confirmId === task.id ? (
                          <div className="confirm">
                            <span>Görev silinsin mi?</span>
                            <button className="mini danger" onClick={() => handleDeleteTask(task)}>Sil</button>
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
                                  title="İşi başlat"
                                  onClick={() => handleTaskStatusChange(task, 'Processing')}
                                  disabled={task.status === 'Processing' || task.status === 'Completed'}
                                >
                                  <PlayCircle size={15} />
                                </button>
                                <button
                                  className="action-btn restart"
                                  title="Tamamlandı olarak işaretle"
                                  onClick={() => handleTaskStatusChange(task, 'Completed')}
                                  disabled={task.status !== 'Processing'}
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                                <button
                                  className="action-btn stop"
                                  title="Hatalı olarak işaretle"
                                  onClick={() => handleTaskStatusChange(task, 'Failed')}
                                  disabled={task.status !== 'Processing'}
                                >
                                  <Flag size={15} />
                                </button>

                                <span className="action-divider" />

                                <button
                                  className="action-btn delete"
                                  title="Görevi sil"
                                  onClick={() => setConfirmId(task.id)}
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
                          <strong>Eşleşen görev yok</strong>
                          <p>Seçili aşama ve arama birlikte hiçbir görevi getirmedi.</p>
                          <button className="btn" style={{ marginTop: 10 }} onClick={clearFilters}>
                            Filtreleri temizle
                          </button>
                        </div>
                      ) : (
                        <div className="empty">
                          <span className="empty-icon"><ListTodo size={18} /></span>
                          <strong>Kuyruk boş</strong>
                          <p>Bir robota iş atayın; görev buradan yürütülüp izlenebilir.</p>
                          <button className="btn-ink" style={{ marginTop: 10 }} onClick={() => setIsModalOpen(true)}>
                            <Plus size={15} /> Yeni iş ata
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

        {!isLoading && visibleTasks.length > 0 && (
          <div className="table-foot">
            <span><span className="mono">{visibleTasks.length}</span> / {counts.All} görev gösteriliyor</span>
            {isFiltered && <button className="btn-text" onClick={clearFilters}>Filtreleri temizle</button>}
          </div>
        )}
      </section>

      {/* YENİ İŞ MODALI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Kuyruğa yeni iş ekle" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Kuyruğa yeni iş ekle</h2>
                <p>Görev “Bekliyor” aşamasında oluşturulur.</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} aria-label="Kapat">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleAddTask} style={{ display: 'contents' }}>
              <div className="modal-body">
                {availableBots.length === 0 && (
                  <div className="modal-note">
                    <AlertCircle size={15} />
                    <span>Sistemde tanımlı robot yok. Önce <Link to="/bots">Robotlar</Link> sayfasından bir robot ekleyin.</span>
                  </div>
                )}

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="task-bot">Görevi yürütecek robot<span className="req">*</span></label>
                    <select
                      id="task-bot"
                      name="bot_name"
                      value={formData.bot_name}
                      onChange={handleInputChange}
                      required
                      disabled={availableBots.length === 0}
                    >
                      {availableBots.map((bot) => (
                        <option key={bot.id} value={bot.name}>{bot.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="task-prio">Öncelik</label>
                    <select id="task-prio" name="priority" value={formData.priority} onChange={handleInputChange}>
                      <option value="Yüksek">Yüksek</option>
                      <option value="Normal">Normal</option>
                      <option value="Düşük">Düşük</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="task-desc">Görev detayı<span className="req">*</span></label>
                  <textarea
                    id="task-desc"
                    name="description"
                    rows="3"
                    required
                    autoFocus
                    placeholder="INV-2026-095 numaralı faturayı CRM'e işle."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                  <span className="hint">Robotun ne yapacağını tek cümleyle yazın; tabloda bu metin görünür.</span>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                <button
                  type="submit"
                  className="btn-ink"
                  disabled={isSaving || availableBots.length === 0 || !formData.description.trim()}
                >
                  {isSaving ? <><Loader2 size={14} className="spin" /> Ekleniyor</> : 'Kuyruğa ekle'}
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