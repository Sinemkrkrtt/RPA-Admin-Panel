import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, ListTodo, RefreshCcw, Trash2, 
  CheckCircle, AlertCircle, Clock, PlayCircle, 
  ArrowUp, ArrowRight, ArrowDown, ChevronDown, Plus, X, Download
} from 'lucide-react';
import './QueueManagement.css';

export default function QueueManagement() {
  const [tasks, setTasks] = useState([]);
  const [availableBots, setAvailableBots] = useState([]); // Veritabanındaki botları tutar
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    bot_name: '', // Dinamik bot listesinden seçilecek
    description: '',
    priority: 'Normal'
  });

  // --- SAYFA YÜKLENDİĞİNDE VERİLERİ ÇEK ---
  useEffect(() => {
    fetchTasks();
    fetchBotsForDropdown();
  }, []);

  // 1. İşleri Backend'den Çek
  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("İşler çekilemedi:", error);
    }
  };

  // 2. Açılır menü (select) için Robotları Backend'den Çek
  const fetchBotsForDropdown = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/robots');
      if (response.ok) {
        const data = await response.json();
        setAvailableBots(data);
        // Eğer veritabanında bot varsa, formun varsayılan değerini ilk bot yap
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, bot_name: data[0].name }));
        }
      }
    } catch (error) {
      console.error("Botlar çekilemedi:", error);
    }
  };

  // --- API BAĞLANTILI AKSİYONLAR ---

  // Yeni İş Ekle (POST)
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    const now = new Date();
    const timeString = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
    
    const newTaskPayload = {
      bot_name: formData.bot_name,
      description: formData.description,
      priority: formData.priority,
      created_at: timeString
    };

    try {
      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTaskPayload)
      });

      if (response.ok) {
        const savedTask = await response.json();
        setTasks([savedTask, ...tasks]);
        setIsModalOpen(false);
        setFormData({ ...formData, description: '', priority: 'Normal' });
      }
    } catch (error) {
      console.error("Görev eklenirken hata:", error);
    }
  };

  // İş Durumunu Değiştirme (Pending -> Processing -> Completed)
  const handleTaskStatusChange = async (task, newStatus) => {
    try {
      // 1. Önce Görevin (Task) durumunu güncelle
      const response = await fetch(`http://localhost:5000/api/tasks/${task.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));

        // 2. Şimdi bu işi yapan BOT'un durumunu güncellemek için
        const targetBot = availableBots.find(b => b.name === task.bot_name);
        
        if (targetBot) {
          let botNewStatus = 'Idle';
          if (newStatus === 'Processing') botNewStatus = 'Running';

          const now = new Date();
          const timeString = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;

          await fetch(`http://localhost:5000/api/robots/${targetBot.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: botNewStatus, last_run: timeString })
          });
        }
      }
    } catch (error) {
      console.error("Durum güncellenirken hata:", error);
    }
  };

  // İşi Sil (DELETE)
  const handleDeleteTask = async (taskId) => {
    try {
      await fetch(`http://localhost:5000/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error("Görev silinirken hata:", error);
    }
  };

  // Filtreleme (Frontend tarafında güvenli arama)
  const filteredTasks = tasks.filter(task => {
    const safeDesc = task.description || "";
    const safeBot = task.bot_name || "";
    const safeId = String(task.id || "");

    const matchesSearch = safeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          safeDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          safeBot.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'All' || task.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // --- YENİ EKLENEN: İŞ KUYRUĞUNU CSV OLARAK İNDİRME ---
  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      alert("İndirilecek veri bulunamadı!");
      return;
    }

    // CSV formatında başlıklar
    let csvContent = "Gorev ID,Bagli Bot,Is Detayi,Oncelik,Olusturulma Tarihi,Durum\n";

    // Tablodaki filtreli verileri CSV formatına çeviriyoruz
    filteredTasks.forEach(task => {
      // Açıklama içindeki virgül veya satır atlamaları CSV'yi bozmasın diye temizliyoruz
      const safeDesc = task.description ? task.description.replace(/,/g, " ").replace(/\n/g, " ") : "";
      csvContent += `TASK-${task.id},${task.bot_name},${safeDesc},${task.priority},${task.created_at},${task.status}\n`;
    });

    // Blob objesi oluşturma (Türkçe karakterler bozulmasın diye \uFEFF ekliyoruz)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Is_Kuyrugu_Raporu_${new Date().toLocaleDateString('tr-TR')}.csv`);
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  // --------------------------------------------------------

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending': return <span className="badge badge-neutral"><Clock size={14}/> Bekliyor</span>;
      case 'Processing': return <span className="badge badge-primary"><PlayCircle size={14}/> İşleniyor</span>;
      case 'Completed': return <span className="badge badge-success"><CheckCircle size={14}/> Tamamlandı</span>;
      case 'Failed': return <span className="badge badge-danger"><AlertCircle size={14}/> Hatalı</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getPriorityDisplay = (priority) => {
    switch (priority) {
      case 'Yüksek': return <span className="priority high"><ArrowUp size={16} /> Yüksek</span>;
      case 'Normal': return <span className="priority normal"><ArrowRight size={16} /> Normal</span>;
      case 'Düşük': return <span className="priority low"><ArrowDown size={16} /> Düşük</span>;
      default: return priority;
    }
  };

  return (
    <div className="page-container">
      
    <div className="page-header">
      <div>
        <h2>İş Kuyruğu ve Görev Yönetimi</h2>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* YENİ EKLENEN İNDİR BUTONU */}
        <button className="btn-secondary" onClick={handleExportCSV} title="Kuyruğu İndir (CSV)">
          <Download size={18} /> İndir
        </button>
        <button className="btn-secondary" onClick={fetchTasks} title="Kuyruğu Yenile">
          <RefreshCcw size={18} />
        </button>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Yeni İş Ata
        </button>
      </div>
    </div>

      <div className="table-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Görev ID, bot veya detay ile ara..." 
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
              <div className="dropdown-item" onClick={() => { setFilterStatus('Pending'); setIsFilterDropdownOpen(false); }}>Bekleyenler</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Processing'); setIsFilterDropdownOpen(false); }}>İşlenenler</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Completed'); setIsFilterDropdownOpen(false); }}>Tamamlananlar</div>
              <div className="dropdown-item" onClick={() => { setFilterStatus('Failed'); setIsFilterDropdownOpen(false); }}>Hatalı Olanlar</div>
            </div>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Görev ID</th>
              <th>Bağlı Bot</th>
              <th>İş Detayı / Açıklama</th>
              <th>Öncelik</th>
              <th>Oluşturulma</th>
              <th>Durum</th>
              <th className="text-right">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                let rowStatusClass = '';
                if (task.status === 'Processing') rowStatusClass = 'row-processing';
                if (task.status === 'Completed') rowStatusClass = 'row-completed';
                if (task.status === 'Failed') rowStatusClass = 'row-failed';

                return (
                  <tr key={task.id} className={rowStatusClass}>
                    <td className="font-medium text-main">TASK-{task.id}</td>
                    <td className="font-semibold">{task.bot_name}</td>
                    <td className="text-muted">{task.description}</td>
                    <td>{getPriorityDisplay(task.priority)}</td>
                    <td className="text-muted">{task.created_at}</td>
                    <td>{getStatusBadge(task.status)}</td>
                    <td className="text-right">
                      <div className="action-buttons">
                        <button 
                          className="action-btn play" 
                          title="İşi Başlat"
                          onClick={() => handleTaskStatusChange(task, 'Processing')}
                          disabled={task.status === 'Processing' || task.status === 'Completed'}
                          style={{ opacity: (task.status === 'Processing' || task.status === 'Completed') ? 0.3 : 1 }}
                        >
                          <PlayCircle size={16} />
                        </button>

                        <button 
                          className="action-btn stop" 
                          title="İşi Tamamla"
                          onClick={() => handleTaskStatusChange(task, 'Completed')}
                          disabled={task.status !== 'Processing'}
                          style={{ opacity: task.status !== 'Processing' ? 0.3 : 1 }}
                        >
                          <CheckCircle size={16} />
                        </button>
                        
                        <div className="divider"></div>

                        <button 
                          className="action-btn delete" 
                          title="Görevi Sil" 
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7">
                  <div className="empty-state">
                    <ListTodo size={40} className="empty-icon" />
                    <h3>Görev Bulunamadı</h3>
                    <p>Şu anda kuyrukta belirtilen kriterlere uygun bir iş bulunmuyor.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* İŞ ATAMA MODALI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Kuyruğa Yeni İş Ekle</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddTask} className="modal-body">
              <div className="form-group">
                <label>Görevi Yapacak Bot</label>
                <select name="bot_name" value={formData.bot_name} onChange={handleInputChange} required>
                  {availableBots.length > 0 ? (
                    availableBots.map(bot => (
                      <option key={bot.id} value={bot.name}>{bot.name}</option>
                    ))
                  ) : (
                    <option value="">Önce sistemde bot oluşturun</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>İş Önceliği</label>
                <select name="priority" value={formData.priority} onChange={handleInputChange}>
                  <option value="Düşük">Düşük</option>
                  <option value="Normal">Normal</option>
                  <option value="Yüksek">Yüksek</option>
                </select>
              </div>

              <div className="form-group">
                <label>Görev Detayı / Açıklama</label>
                <textarea 
                  name="description"
                  rows="3"
                  required
                  placeholder="Örn: INV-2026-095 nolu faturayı CRM'e işle..."
                  value={formData.description}
                  onChange={handleInputChange}
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>İptal</button>
                <button type="submit" className="btn-primary" disabled={availableBots.length === 0}>
                  Kuyruğa Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}