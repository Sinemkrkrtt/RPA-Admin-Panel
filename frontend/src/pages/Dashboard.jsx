import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import {
  Server, Activity, Clock, Target, Bell, Download, RefreshCw,
  AlertTriangle, AlertCircle, Info, Inbox, WifiOff
} from 'lucide-react';
import { io } from 'socket.io-client';

const API = 'http://localhost:5000/api';

const EMPTY = {
  kpi: { totalBots: 0, activeBots: 0, queuedTasks: 0, successRate: 0 },
  weeklyData: [],
  totalData: []
};

const nf = new Intl.NumberFormat('tr-TR');
const fmt = (n) => nf.format(Number(n) || 0);

/* Grafik renkleri temaya göre JS tarafında çözülüyor (SVG'de değişken riski yok) */
const chartTheme = (dark) => ({
  grid: dark ? '#26262b' : '#eceae3',
  axis: dark ? '#74747e' : '#8a8a93',
  ok: dark ? '#8f88ff' : '#4b3fd6',
  fail: dark ? '#f2686c' : '#d1383d'
});

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((p) => (
        <div className="chart-tooltip-row" key={p.dataKey ?? p.name}>
          <span className="series-swatch" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span>
          <span className="v">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <main className="main-content">
      <div className="page-head">
        <div>
          <div className="skel" style={{ width: 190, height: 24 }} />
          <div className="skel" style={{ width: 260, height: 13, marginTop: 10 }} />
        </div>
        <div className="skel" style={{ width: 210, height: 32 }} />
      </div>

      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="kpi-card" key={i}>
            <div className="kpi-header">
              <div className="skel" style={{ width: 96, height: 11 }} />
              <div className="skel" style={{ width: 30, height: 30, borderRadius: 8 }} />
            </div>
            <div>
              <div className="skel" style={{ width: 74, height: 30 }} />
              <div className="skel" style={{ height: 3, marginTop: 12 }} />
              <div className="skel" style={{ width: 130, height: 12, marginTop: 11 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="charts-wrapper">
        <div className="panel"><div className="panel-body pad"><div className="skel" style={{ height: 288 }} /></div></div>
        <div className="panel"><div className="panel-body pad"><div className="skel" style={{ height: 288 }} /></div></div>
      </div>
    </main>
  );
}

export default function Dashboard({ isDarkMode }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [dashRes, logsRes] = await Promise.all([
        fetch(`${API}/dashboard`),
        fetch(`${API}/logs`)
      ]);

      if (!dashRes.ok) throw new Error('dashboard');
      setDashboardData(await dashRes.json());

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(Array.isArray(logsData) ? logsData.slice(0, 5) : []);
      }

      setFailed(false);
      setUpdatedAt(new Date());
    } catch (error) {
      console.error('Veriler çekilemedi:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

useEffect(() => {
    // 1. Sayfa ilk açıldığında verileri normal şekilde çek
    fetchAllData();

    // 2. Backend ile gerçek zamanlı (WebSocket) köprüsü kur
    const socket = io('http://localhost:5000');

    // 3. Backend'den "dashboard_update" sinyali gelirse, verileri sessizce arka planda yenile
    socket.on('dashboard_update', () => {
      console.log('⚡ Gerçek zamanlı veri güncellemesi yakalandı!');
      fetchAllData();
    });

    // 4. Sadece yeni bir log geldiğinde, tabloyu baştan çekmek yerine log listesinin en üstüne ekle
    socket.on('new_log', (newLog) => {
      setLogs((prevLogs) => [newLog, ...prevLogs].slice(0, 5));
    });

    // Sayfa değiştirilirse (Unmount), dinlemeyi bırakarak belleği temizle (Memory Leak önlemi)
    return () => socket.disconnect();
  }, [fetchAllData]);

  const data = dashboardData || EMPTY;
  const t = useMemo(() => chartTheme(isDarkMode), [isDarkMode]);

  const totalData = useMemo(
    () => (data.totalData || []).map((d) => ({
      name: d.name ?? d.label ?? '—',
      value: Number(d.value) || 0
    })),
    [data.totalData]
  );

  const grandTotal = totalData.reduce((s, d) => s + d.value, 0);
  const donutColors = [t.ok, t.fail, t.axis];

  const { totalBots = 0, activeBots = 0, queuedTasks = 0, successRate = 0 } = data.kpi || {};
  const activeRatio = totalBots ? Math.round((activeBots / totalBots) * 100) : 0;
  const idleBots = Math.max(totalBots - activeBots, 0);

  const handleExportCSV = () => {
    if (!data.weeklyData?.length) return;
    let csv = 'Gun,Basarili Islem,Hatali Islem\n';
    data.weeklyData.forEach((row) => {
      csv += `${row.gun},${row.Basarili},${row.Hatali}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Haftalik_Islem_Raporu_${new Date().toLocaleDateString('tr-TR')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <main className="main-content">
      {/* SAYFA BAŞLIĞI */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">Genel Bakış</h1>
          <div className="page-sub">
            <span className={`status-dot ${failed ? 'is-down' : ''}`} />
            {failed
              ? 'Sunucuya bağlanılamıyor'
              : <>Son güncelleme <span className="mono">{updatedAt?.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></>}
          </div>
        </div>

        <div className="head-actions">
          <button className="btn" onClick={fetchAllData} disabled={isRefreshing}>
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            {isRefreshing ? 'Yenileniyor' : 'Yenile'}
          </button>
          <button className="btn-ink" onClick={handleExportCSV} disabled={!data.weeklyData?.length}>
            <Download size={14} /> CSV indir
          </button>
        </div>
      </div>

      {failed && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Veriler {API} adresinden alınamadı. Sunucunun çalıştığını kontrol edin.</span>
          <button className="btn" onClick={fetchAllData}>Tekrar dene</button>
        </div>
      )}

      {/* GÖSTERGE KARTLARI */}
      <div className="kpi-grid">
        <div className="kpi-card rise" style={{ '--d': '60ms' }}>
          <div className="kpi-header">
            <span className="eyebrow">Kayıtlı robot</span>
            <span className="kpi-icon-box blue"><Server size={16} /></span>
          </div>
          <div>
            <div className="kpi-value num">{fmt(totalBots)}</div>
            <div className="kpi-meter"><span style={{ width: `${activeRatio}%` }} /></div>
            <div className="kpi-foot"><b>{fmt(activeBots)}</b> çalışıyor · <b>{fmt(idleBots)}</b> beklemede</div>
          </div>
        </div>

        <div className="kpi-card rise" style={{ '--d': '110ms' }}>
          <div className="kpi-header">
            <span className="eyebrow">Anlık çalışan</span>
            <span className="kpi-icon-box green"><Activity size={16} /></span>
          </div>
          <div>
            <div className="kpi-value num">{fmt(activeBots)}</div>
            <div className="kpi-meter ok"><span style={{ width: `${activeRatio}%` }} /></div>
            <div className="kpi-foot">Filonun <b>%{activeRatio}</b>'i aktif</div>
          </div>
        </div>

        <div className="kpi-card rise" style={{ '--d': '160ms' }}>
          <div className="kpi-header">
            <span className="eyebrow">İş kuyruğu</span>
            <span className="kpi-icon-box orange"><Clock size={16} /></span>
          </div>
          <div>
            <div className="kpi-value num">{fmt(queuedTasks)}</div>
            <div className="kpi-meter warn"><span style={{ width: queuedTasks > 0 ? '100%' : '0%' }} /></div>
            <div className="kpi-foot">{queuedTasks > 0 ? 'İşlenmeyi bekleyen görev' : 'Kuyruk boş'}</div>
          </div>
        </div>

        <div className="kpi-card rise" style={{ '--d': '210ms' }}>
          <div className="kpi-header">
            <span className="eyebrow">Başarı oranı</span>
            <span className="kpi-icon-box red"><Target size={16} /></span>
          </div>
          <div>
            <div className="kpi-value num">{successRate}<span className="unit">%</span></div>
            <div className={`kpi-meter ${successRate >= 90 ? 'ok' : successRate >= 70 ? 'warn' : ''}`}>
              <span style={{ width: `${Math.min(Math.max(successRate, 0), 100)}%` }} />
            </div>
            <div className="kpi-foot">Tamamlanan tüm işlemler</div>
          </div>
        </div>
      </div>

      {/* GRAFİKLER */}
      <div className="charts-wrapper">
        <section className="panel rise" style={{ '--d': '260ms' }}>
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Haftalık işlem hacmi</h2>
              <p className="panel-desc">Son 7 günün gün bazlı sonuçları</p>
            </div>
            <div className="series-keys">
              <span className="series-key"><i className="series-swatch" style={{ background: t.ok }} /> Başarılı</span>
              <span className="series-key"><i className="series-swatch" style={{ background: t.fail }} /> Hatalı</span>
            </div>
          </div>

          <div className="panel-body">
            <div style={{ width: '100%', height: 292 }}>
              <ResponsiveContainer>
                <BarChart data={data.weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={5}>
                  <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
                  <XAxis
                    dataKey="gun"
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    tick={{ fill: t.axis, fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    tick={{ fill: t.axis, fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: t.grid, opacity: 0.35 }} />
                  <Bar dataKey="Basarili" name="Başarılı" fill={t.ok} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="Hatali" name="Hatalı" fill={t.fail} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="panel rise" style={{ '--d': '310ms' }}>
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Tüm zamanlar</h2>
              <p className="panel-desc">Toplam işlem dağılımı</p>
            </div>
          </div>

          <div className="panel-body pad">
            <div className="donut-wrap" style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={totalData}
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {totalData.map((entry, i) => (
                      <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="donut-center">
                <strong>{fmt(grandTotal)}</strong>
                <span className="eyebrow">Toplam işlem</span>
              </div>
            </div>

            <div className="readout">
              {totalData.map((entry, i) => (
                <div className="readout-row" key={entry.name}>
                  <i className="series-swatch" style={{ background: donutColors[i % donutColors.length] }} />
                  <span>{entry.name}</span>
                  <span className="v">{fmt(entry.value)}</span>
                  <span className="p">%{grandTotal ? ((entry.value / grandTotal) * 100).toFixed(1) : '0.0'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* SİSTEM KAYITLARI */}
      <section className="panel rise" style={{ '--d': '360ms' }}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><Bell size={15} /> Sistem kayıtları</h2>
            <p className="panel-desc">En son gelen 5 uyarı</p>
          </div>
          <Link className="btn" to="/logs">Tüm loglar</Link>
        </div>

        {logs.length > 0 ? (
          <ul className="log-list">
            {logs.map((log, i) => {
              const type = String(log.log_type || '').toLowerCase();
              const level = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
              const Icon = level === 'error' ? AlertTriangle : level === 'warning' ? AlertCircle : Info;

              return (
                <li className={`log-row ${level}`} key={log.id ?? i}>
                  <span className="log-rail" />
                  <span className="log-icon"><Icon size={16} /></span>
                  <div className="log-body">
                    <div className="log-top">
                      <span className="log-bot">{log.bot_name}</span>
                      <span className={`tag ${level}`}>{log.log_type}</span>
                    </div>
                    <div className="log-msg" title={log.message}>{log.message}</div>
                  </div>
                  <span className="log-time">{log.created_at}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">
            <span className="empty-icon"><Inbox size={18} /></span>
            <strong>Kayıt yok</strong>
            <p>Robotlar son çalışmalarında uyarı üretmedi. Yeni kayıtlar burada görünecek.</p>
          </div>
        )}
      </section>
    </main>
  );
}