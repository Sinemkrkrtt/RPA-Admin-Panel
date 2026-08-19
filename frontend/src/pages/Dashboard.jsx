import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Activity, Server, Clock, AlertTriangle, 
  CheckCircle, Bell, TrendingUp, TrendingDown, Loader, Download // Download ikonu eklendi
} from 'lucide-react';

const PIE_COLORS = ['#6366f1', '#94a3b8']; 

export default function Dashboard({ isDarkMode }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error("Dashboard verisi çekilemedi:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // --- YENİ EKLENEN: CSV OLARAK DIŞA AKTARMA FONKSİYONU ---
  const handleExportCSV = () => {
    if (!dashboardData) return;

    // CSV formatında başlıklar
    let csvContent = "Gun,Basarili Islem,Hatali Islem\n";

    // Tablodaki her bir haftalık veri satırını CSV formatına çeviriyoruz
    dashboardData.weeklyData.forEach(row => {
      csvContent += `${row.gun},${row.Basarili},${row.Hatali}\n`;
    });

    // Blob objesi oluşturma (Türkçe karakter sorunu olmasın diye \uFEFF ekliyoruz)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Tarayıcıda sahte bir indirme linki (a tag) oluşturup tıklatıyoruz
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Haftalik_Islem_Raporu_${new Date().toLocaleDateString('tr-TR')}.csv`);
    
    document.body.appendChild(link);
    link.click();
    
    // İşlem bitince sahte linki temizle
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  // --------------------------------------------------------

  if (isLoading) {
    return (
      <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
          <Loader size={40} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <p>Dashboard verileri yükleniyor...</p>
        </div>
      </main>
    );
  }

  const data = dashboardData || {
    kpi: { totalBots: 0, activeBots: 0, queuedTasks: 0, successRate: 0 },
    weeklyData: [],
    totalData: []
  };

  return (
    <main className="main-content">
      {/* KPI KARTLARI */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>Toplam Bot Sayısı</h3>
            <div className="kpi-icon-box blue"><Server size={22} /></div>
          </div>
          <div className="kpi-body">
            <h2>{data.kpi.totalBots}</h2>
            <span className="trend positive"><TrendingUp size={16}/> Güncel Veri</span>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>Aktif / Çalışan</h3>
            <div className="kpi-icon-box green"><Activity size={22} /></div>
          </div>
          <div className="kpi-body">
            <h2>{data.kpi.activeBots}</h2>
            <span className="trend neutral">Canlı İzleme</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <h3>Kuyruktaki İşler</h3>
            <div className="kpi-icon-box orange"><Clock size={22} /></div>
          </div>
          <div className="kpi-body">
            <h2>{data.kpi.queuedTasks}</h2>
            <span className="trend negative"><TrendingDown size={16}/> Tahmini</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <h3>Genel Başarı Oranı</h3>
            <div className="kpi-icon-box red"><CheckCircle size={22} /></div>
          </div>
          <div className="kpi-body">
            <h2>%{data.kpi.successRate}</h2>
            <span className="trend positive"><TrendingUp size={16}/> Sistem Ortalaması</span>
          </div>
        </div>
      </div>

      {/* GRAFİKLER ALANI */}
      <div className="charts-wrapper">
        <div className="chart-box main-chart">
          {/* YENİ EKLENEN: Başlık ve İndirme Butonu Yanyana */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Haftalık İşlem Özeti</h2>
            <button 
              className="btn-primary" 
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}
            >
              <Download size={16} /> Raporu İndir (CSV)
            </button>
          </div>
          {/* ------------------------------------------- */}
          
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.weeklyData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="gun" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#a1a1aa' : '#64748b', fontSize: 13 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#a1a1aa' : '#64748b', fontSize: 13 }} />
                <Tooltip 
                  cursor={{fill: 'transparent'}} 
                  contentStyle={{ backgroundColor: isDarkMode ? '#141415' : '#ffffff', border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`, borderRadius: '12px', color: isDarkMode ? '#f8fafc' : '#0f172a', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 14 }} />
                <Bar dataKey="Basarili" name="Başarılı" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={26} />
                <Bar dataKey="Hatali" name="Hatalı" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-box side-chart">
          <h2 className="section-title">Tüm Zamanlar</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.totalData}
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.totalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: isDarkMode ? '#141415' : '#ffffff', border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`, borderRadius: '12px', color: isDarkMode ? '#f8fafc' : '#0f172a' }}
                />
                <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: 14 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {/* SİSTEM BİLDİRİMLERİ (LOG) */}
      <div className="alerts-section">
        <div className="section-header">
          <h2 className="section-title"><Bell size={20} /> Sistem Kayıtları & Uyarılar</h2>
          <button className="btn-text">Tümünü Gör</button>
        </div>
        
        <ul className="alerts-list">
          <li className="alert-item error">
            <div className="alert-icon"><AlertTriangle size={18} /></div>
            <div className="alert-content">
              <strong>Kritik Gecikme</strong>
              <p>Fatura_Botu_v2 45 dakikadır sunucuya yanıt vermiyor. Lütfen port bağlantılarını kontrol edin.</p>
            </div>
            <span className="alert-time">10 dk önce</span>
          </li>
          
          <li className="alert-item warning">
            <div className="alert-icon"><Clock size={18} /></div>
            <div className="alert-content">
              <strong>Yüksek İş Kuyruğu</strong>
              <p>İK_İşe_Alım_Süreci kuyruğunda 50'den fazla bekleyen işlem birikti.</p>
            </div>
            <span className="alert-time">1 saat önce</span>
          </li>

          <li className="alert-item info">
            <div className="alert-icon"><Activity size={18} /></div>
            <div className="alert-content">
              <strong>Sistem Güncellemesi</strong>
              <p>Yeni RPA çekirdek güncellemesi (v1.4.2) başarıyla tamamlandı.</p>
            </div>
            <span className="alert-time">Dün, 14:30</span>
          </li>
        </ul>
      </div>
    </main>
  );
}