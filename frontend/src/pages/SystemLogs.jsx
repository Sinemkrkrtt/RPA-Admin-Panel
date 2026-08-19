import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Search, Filter, AlertTriangle, 
  Info, CheckCircle, Bug, Trash2, Download, 
  ChevronDown, ChevronUp, Eraser, Loader
} from 'lucide-react';
import './SystemLogs.css';

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Arama ve Filtreleme
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  // Terminal ve UI Durumları
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [clearedUntil, setClearedUntil] = useState(null); // Terminal temizleme referansı
  const [expandedRows, setExpandedRows] = useState({}); // Tablodaki açık stack_trace satırları
  
  const terminalEndRef = useRef(null);

  useEffect(() => {
    fetchLogs();
    
    const interval = setInterval(() => {
      if(isLiveActive) fetchLogs(false); // Canlı izlemede arkaplan yenilemesi yaparken loading gösterme
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isLiveActive]);

  useEffect(() => {
    if (isLiveActive) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isLiveActive, clearedUntil]);

  const fetchLogs = async (showLoading = true) => {
    if (showLoading && logs.length === 0) setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.reverse()); // Eskiden yeniye sıralı
      }
    } catch (error) {
      console.error("Loglar çekilemedi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Logları TXT formatında indir (Export)
  const handleDownloadLogs = () => {
    const fileData = displayLogs.map(l => `[${l.created_at}] [${l.log_type.toUpperCase()}] ${l.bot_name}: ${l.message} ${l.stack_trace ? '\nStack: ' + l.stack_trace : ''}`).join('\n\n');
    const blob = new Blob([fileData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPA_System_Logs_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
  };

  // Sadece arayüzdeki terminal ekranını temizler (Veritabanından silmez)
  const handleClearTerminal = () => {
    setClearedUntil(Date.now());
  };

  // Tablodaki satırı aç/kapat (Stack trace için)
  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- VERİ HAZIRLIĞI ---
  const displayLogs = [...logs].reverse(); // Tablo için en yeniler üstte
  
  const filteredLogs = displayLogs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.bot_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || log.log_type === filterType;
    return matchesSearch && matchesFilter;
  });

  // Terminal Performansı: Son 100 logu göster, temizleme butonuna basıldıysa ondan sonrakileri göster
  const terminalLogs = logs
    .filter(log => !clearedUntil || new Date(log.created_at).getTime() > clearedUntil)
    .slice(-100); 

  const getLogIcon = (type) => {
    switch (type) {
      case 'Error': return <Bug size={16} className="text-danger" />;
      case 'Warning': return <AlertTriangle size={16} className="text-warning" />;
      case 'Success': return <CheckCircle size={16} className="text-success" />;
      default: return <Info size={16} className="text-info" />;
    }
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader size={40} className="animate-spin text-muted" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      
      <div className="page-header">
        <div>
        
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={handleDownloadLogs} title="Logları İndir">
            <Download size={18} /> Dışa Aktar
          </button>
          <button 
            className={`btn-primary ${isLiveActive ? 'live-active' : ''}`}
            onClick={() => setIsLiveActive(!isLiveActive)}
          >
            <span className={isLiveActive ? 'pulse-dot' : ''}></span>
            {isLiveActive ? 'Canlı İzleme: AÇIK' : 'KAPALI'}
          </button>
        </div>
      </div>

      {/* CANLI TERMİNAL EKRANI */}
      <div className="terminal-container">
        <div className="terminal-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="window-controls">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="terminal-title">bash - root@rpa-server:~ (Monitoring)</span>
          </div>
          
          <button className="btn-icon-small" onClick={handleClearTerminal} title="Ekranı Temizle" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <Eraser size={16} />
          </button>
        </div>
        <div className="terminal-body">
          {terminalLogs.length === 0 ? (
            <div className="terminal-line" style={{ color: '#64748b' }}>Dinleniyor... (Yeni log bekleniyor)</div>
          ) : (
            terminalLogs.map((log) => (
              <div key={`term-${log.id}`} className={`terminal-line ${log.log_type.toLowerCase()}`}>
                <span className="time">[{log.created_at}]</span> 
                <span className="bot">[{log.bot_name}]</span> 
                <span className="message">{log.message}</span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* GEÇMİŞ TABLOSU VE FİLTRELER */}
      <div className="table-toolbar" style={{ marginTop: '24px' }}>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Log mesajı, bot ismi veya detay ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-chips">
          <button className={`chip ${filterType === 'All' ? 'active' : ''}`} onClick={() => setFilterType('All')}>Tümü</button>
          <button className={`chip ${filterType === 'Error' ? 'active' : ''}`} onClick={() => setFilterType('Error')}>Hatalar</button>
          <button className={`chip ${filterType === 'Warning' ? 'active' : ''}`} onClick={() => setFilterType('Warning')}>Uyarılar</button>
          <button className={`chip ${filterType === 'Info' ? 'active' : ''}`} onClick={() => setFilterType('Info')}>Bilgi</button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table log-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>Tip</th>
              <th style={{ width: '160px' }}>Tarih / Saat</th>
              <th style={{ width: '200px' }}>Bot İsmi</th>
              <th>Mesaj / Olay</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Detay</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <React.Fragment key={`tbl-${log.id}`}>
                  <tr className={`log-row ${expandedRows[log.id] ? 'expanded' : ''}`}>
                    <td>{getLogIcon(log.log_type)}</td>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{log.created_at}</td>
                    <td className="font-semibold">{log.bot_name}</td>
                    <td className={log.log_type === 'Error' ? 'text-main font-medium' : 'text-muted'}>
                      {log.message}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {/* Sadece stack_trace varsa açılır buton göster */}
                      {log.stack_trace && (
                        <button 
                          className="btn-expand"
                          onClick={() => toggleRow(log.id)}
                          title="Hata Detayını Gör"
                        >
                          {expandedRows[log.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      )}
                    </td>
                  </tr>
                  
                  {/* AKORDİYON İÇERİĞİ (STACK TRACE) */}
                  {expandedRows[log.id] && log.stack_trace && (
                    <tr className="stack-trace-row">
                      <td colSpan="5">
                        <div className="stack-trace-box">
                          <strong>Exception Stack Trace:</strong>
                          <pre>{log.stack_trace}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <Search size={32} className="empty-icon" style={{ opacity: 0.5 }} />
                    <h4>Sonuç Bulunamadı</h4>
                    <p>Filtrelerinize uygun herhangi bir sistem kaydı eşleşmedi.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}