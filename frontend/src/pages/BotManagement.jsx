import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Filter, Play, Square, RotateCw, 
  Trash2, CalendarClock, Server, ChevronDown, X, AlertCircle
} from 'lucide-react';
import './BotManagement.css';

// Backend kapalıyken uygulamanın çökmemesi için yedek veri (Fallback)
const fallbackBots = [
  { id: 'BOT-001', name: 'Fatura_Botu_v2', version: '2.1.0', lastRun: '2026-08-17 14:30', status: 'Running', schedule: '09:00 (Her gün)' }
];

export default function BotManagement() {
  const [bots, setBots] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  
  // --- YENİ: GELİŞMİŞ FORM STATE'İ ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    version: '1.0.0',
    schedule: 'Yok',
    description: ''
  });

  // --- API (BACKEND) ENTEGRASYONLARI ---

  // 1. Sayfa yüklendiğinde verileri çek (GET)
  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      // Backend API adresimiz
      const response = await fetch('http://localhost:5000/api/robots');
      if (response.ok) {
        const data = await response.json();
        setBots(data);
      } else {
        setBots(fallbackBots);
      }
    } catch (error) {
      console.error("Backend bağlantı hatası:", error);
      setBots(fallbackBots); // Backend ayakta değilse yedek veriyi göster
    }
  };

  const handleAddBot = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const response = await fetch('http://localhost:5000/api/robots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      // YENİ EKLENEN KONTROL: Eğer cevap başarılı değilse (500 vs.) işlemi durdur!
      if (!response.ok) {
        throw new Error("Sunucu hatası: Bot kaydedilemedi!");
      }

      const savedBot = await response.json();

      setBots([savedBot, ...bots]);
      setIsModalOpen(false);
      
      setFormData({ name: '', version: '1.0.0', schedule: 'Yok', description: '' });
      
    } catch (error) {
      // Hata olursa konsola yazdır ama ekranı çökertme
      console.error("Bot eklenirken hata oluştu:", error);
      alert("Bot eklenemedi! Backend terminalini kontrol edin.");
    }
  };

  // 3. Bot Silme (DELETE)
  const handleDeleteBot = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/robots/${id}`, { method: 'DELETE' });
      // Veritabanından silindikten sonra ekrandan da (state) uçuruyoruz
      setBots(bots.filter(bot => bot.id !== id));
    } catch (error) {
      console.error("Bot silinirken hata:", error);
    }
  };

  // 4. Bot Durumunu Değiştirme (Play, Stop, Restart)
  const handleStatusChange = async (bot, newStatus) => {
    // Mevcut son çalışma zamanını koruyalım
    let updatedLastRun = bot.last_run;

    // Eğer bot başlatılıyorsa (Running), o anın tarih ve saatini "Son Çalışma" olarak damgala
    if (newStatus === 'Running') {
      const now = new Date();
      // Örn: 17.08.2026 18:45 formatında güncel zaman oluşturma
      updatedLastRun = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
    }

    try {
      // Backend'deki yeni PUT endpoint'ine istek atıyoruz
      const response = await fetch(`http://localhost:5000/api/robots/${bot.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, last_run: updatedLastRun })
      });

      if (response.ok) {
        const updatedBot = await response.json();
        // Sadece durumu değişen botun verisini günceller, diğerlerini sabit tutar
        setBots(bots.map(b => b.id === bot.id ? updatedBot : b));
      } else {
        alert("Bot durumu güncellenemedi!");
      }
    } catch (error) {
      console.error("Durum güncelleme hatası:", error);
    }
  };

  // Form inputları değiştikçe state'i güncelleyen fonksiyon
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

 

  const filteredBots = bots.filter(bot => {
    // bot.name veya bot.id undefined gelirse string'e çevirip çökmeyi önleriz
    const safeName = bot.name || "";
    const safeId = String(bot.id || "");

    const matchesSearch = safeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          safeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || bot.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Running': return <span className="badge badge-success">Çalışıyor</span>;
      case 'Idle': return <span className="badge badge-neutral">Bekliyor</span>;
      case 'Stopped': return <span className="badge badge-warning">Durduruldu</span>;
      case 'Error': return <span className="badge badge-danger">Hata</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="page-container">
      
      <div className="page-header">
        <div>
         
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Yeni Bot Ekle
        </button>
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Bot ID veya isim ile ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-wrapper">
          <button 
            className={`btn-secondary ${filterStatus !== 'All' ? 'active-filter' : ''}`}
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
          >
            <Filter size={18} /> 
            {filterStatus === 'All' ? 'Tüm Durumlar' : filterStatus} 
            <ChevronDown size={16} />
          </button>
          
          {isFilterDropdownOpen && (
            <div className="filter-dropdown">
              <div className="dropdown-item" onClick={() => { setFilterStatus('All'); setIsFilterDropdownOpen(false); }}>Tümü</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Running'); setIsFilterDropdownOpen(false); }}>Çalışıyor</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Idle'); setIsFilterDropdownOpen(false); }}>Bekliyor</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Stopped'); setIsFilterDropdownOpen(false); }}>Durduruldu</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Error'); setIsFilterDropdownOpen(false); }}>Hata</div>
            </div>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bot ID</th>
              <th>Bot İsmi</th>
              <th>Versiyon</th>
              <th>Son Çalışma</th>
              <th>Durum</th>
              <th>Zamanlama</th>
              <th className="text-right">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {filteredBots.length > 0 ? (
              filteredBots.map((bot) => (
                <tr key={bot.id}>
                  <td className="font-medium text-main">{bot.id}</td>
                  <td className="font-semibold">{bot.name}</td>
                  <td className="text-muted">{bot.version}</td>
                 <td className="text-muted">{bot.last_run}</td>
                  <td>{getStatusBadge(bot.status)}</td>
                  <td className="text-muted">
                    <div className="schedule-cell">
                      <CalendarClock size={16} /> {bot.schedule}
                    </div>
                  </td>
           <td className="text-right">
                    <div className="action-buttons">
                        
                        {/* Başlat Butonu -> Durumu 'Running' Yapar */}
                        <button 
                        className="action-btn play" 
                        title="Başlat" 
                        onClick={() => handleStatusChange(bot, 'Running')}
                        disabled={bot.status === 'Running'} // Zaten çalışıyorsa butonu pasif yap
                        >
                        <Play size={16} />
                        </button>
                        
                        {/* Durdur Butonu -> Durumu 'Stopped' Yapar */}
                        <button 
                        className="action-btn stop" 
                        title="Durdur" 
                        onClick={() => handleStatusChange(bot, 'Stopped')}
                        disabled={bot.status !== 'Running'} // Çalışmıyorsa durdurma butonuna basılamasın
                        >
                        <Square size={16} />
                        </button>
                        
                        {/* Yeniden Başlat Butonu -> Önce durdurup sonra başlatma simülasyonu veya direkt 'Running' */}
                        <button 
                        className="action-btn restart" 
                        title="Yeniden Başlat" 
                        onClick={() => handleStatusChange(bot, 'Running')}
                        >
                        <RotateCw size={16} />
                        </button>
                        
                        <div className="divider"></div>
                        
                        <button className="action-btn schedule" title="Zamanla"><CalendarClock size={16} /></button>
                        
                        <button 
                        className="action-btn delete" 
                        title="Sil" 
                        onClick={() => handleDeleteBot(bot.id)}
                        >
                        <Trash2 size={16} />
                        </button>
                        
                    </div>
                    </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">
                  <div className="empty-state">
                    <AlertCircle size={40} className="empty-icon" />
                    <h3>Kayıt Bulunamadı</h3>
                    <p>Arama kriterlerinize uyan bir bot eşleşmedi. Lütfen filtreleri temizleyin veya aramanızı değiştirin.</p>
                    <button className="btn-secondary mt-3" onClick={() => {setSearchTerm(''); setFilterStatus('All');}}>
                      Filtreleri Temizle
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* YENİ NESİL GELİŞMİŞ MODAL TASARIMI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Yeni RPA Botu Tanımla</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddBot} className="modal-body">
              
              <div className="form-row">
                <div className="form-group">
                  <label>Bot İsmi</label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    placeholder="Örn: Raporlama_Botu" 
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Versiyon</label>
                  <input 
                    type="text" 
                    name="version"
                    placeholder="1.0.0" 
                    value={formData.version}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

            <div className="form-group">
                <label>Zamanlama Planı (Cron)</label>
                <select name="schedule" value={formData.schedule} onChange={handleInputChange}>
                  <option value="Yok">Manuel (Sadece Tıklamayla)</option>
                  <option value="Saat başı">Saat Başı</option>
                  <option value="09:00 (Her gün)">Her Gün Sabah 09:00</option>
                  <option value="23:59 (Her gün)">Her Gece 23:59</option>
                  <option value="Haftalık (Pazartesi)">Haftalık (Pazartesi)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Bot Açıklaması / Amacı</label>
                <textarea 
                  name="description"
                  rows="3"
                  placeholder="Bu botun hangi süreci otomatize ettiğini kısaca yazın..."
                  value={formData.description}
                  onChange={handleInputChange}
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>İptal</button>
                <button type="submit" className="btn-primary">Sisteme Kaydet</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}