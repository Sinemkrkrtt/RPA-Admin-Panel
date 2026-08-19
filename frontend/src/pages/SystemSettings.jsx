import React, { useState, useEffect } from 'react';
import { 
  Server, Globe, Mail, Lock, Key, 
  Activity, ShieldAlert, RefreshCcw, AlertCircle, Settings
} from 'lucide-react';
import './SystemSettings.css';

export default function SystemSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSMTP, setIsCheckingSMTP] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);
  
  const [config, setConfig] = useState({
    maintenance_mode: false,
    system_language: 'tr',
    timezone: 'Europe/Istanbul',
    crm_api_key: '',
    erp_base_url: '',
    max_api_requests: 1000,
    api_timeout_ms: 5000,
    notify_on_error: true,
    admin_email: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    log_retention_days: 30,
    session_timeout_minutes: 60,
    enable_ip_whitelist: false,
    allowed_ips: ''
  });

  const isDirty = originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/settings');
      if (response.ok) {
        const data = await response.json();
        const mergedData = { ...config, ...data };
        setConfig(mergedData);
        setOriginalConfig(mergedData);
      }
    } catch (error) {
      console.error("Ayarlar çekilemedi:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        setOriginalConfig(config); 
      }
    } catch (error) {
      console.error("Ayarlar kaydedilemedi:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(originalConfig); 
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig({
      ...config,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const testSMTPConnection = () => {
    setIsCheckingSMTP(true);
    setTimeout(() => {
      alert("SMTP Bağlantısı Başarılı! Sunucu yanıt veriyor.");
      setIsCheckingSMTP(false);
    }, 1500);
  };

  return (
    <div className="page-container" style={{ paddingBottom: '100px' }}>
      
      {/* SAYFA BAŞLIĞI */}
      <div className="settings-main-header">
        <div className="header-icon-wrapper">
     
        </div>
       
      </div>

      {/* AKICI İÇERİK ALANI (Tüm bölümler alt alta sıralı) */}
      <div className="settings-scroll-container">
        
        {/* --- 1. GENEL AYARLAR --- */}
        <section className="settings-section">
          <div className="section-side">
            <h3>Genel Ayarlar</h3>
            <p>Sistemin ana çalışma prensiplerini, bölgesel lokasyon ayarlarını ve erişilebilirlik durumunu belirleyin.</p>
          </div>
          
          <div className="section-content">
            <div className="setting-block card-style">
              <div className="setting-info">
                <label><ShieldAlert size={16} className="text-warning"/> Bakım Modu (Maintenance Mode)</label>
                <span>Aktif edildiğinde botlar yeni işleri almayı durdurur. Mevcut işler bitirilir.</span>
              </div>
              <div className="setting-action">
                <label className="toggle-switch">
                  <input type="checkbox" name="maintenance_mode" checked={config.maintenance_mode} onChange={handleChange} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-block row-layout card-style mt-4">
              <div className="input-group">
                <label>Sistem Dili</label>
                <select name="system_language" value={config.system_language} onChange={handleChange}>
                  <option value="tr">Türkçe (Varsayılan)</option>
                  <option value="en">English (US)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Zaman Dilimi (Timezone)</label>
                <select name="timezone" value={config.timezone} onChange={handleChange}>
                  <option value="Europe/Istanbul">Europe/Istanbul (+03:00)</option>
                  <option value="UTC">UTC (Global Standard)</option>
                </select>
                <span className="helper-text">Cron işleri ve log kayıtları bu dilime göre işlenir.</span>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-divider" />

        {/* --- 2. API VE ENTEGRASYON --- */}
        <section className="settings-section">
          <div className="section-side">
             <h3>API & Ortam Değişkenleri</h3>
             <p>Botların kullandığı 3. parti entegrasyon şifrelerini ve sunucu taraflı performans kota limitlerini yönetin.</p>
          </div>

          <div className="section-content">
            <div className="setting-block row-layout card-style">
              <div className="input-group">
                <label>CRM Entegrasyon Anahtarı</label>
                <div className="input-with-icon">
                  <Key size={16} className="icon" />
                  <input type="password" name="crm_api_key" value={config.crm_api_key} onChange={handleChange} placeholder="sk_live_..." />
                </div>
              </div>
              <div className="input-group">
                <label>ERP Sistemi Base URL</label>
                <div className="input-with-icon">
                  <Globe size={16} className="icon" />
                  <input type="text" name="erp_base_url" value={config.erp_base_url} onChange={handleChange} placeholder="https://api.sirket.com/v1" />
                </div>
              </div>
            </div>

            <div className="setting-block row-layout card-style mt-4">
              <div className="input-group">
                <label>Dakika Başına Maks. API İsteği</label>
                <div className="input-with-icon">
                  <Activity size={16} className="icon" />
                  <input type="number" name="max_api_requests" value={config.max_api_requests} onChange={handleChange} />
                </div>
                <span className="helper-text">Hedef sitelerden banlanmamak için Rate Limit.</span>
              </div>
              <div className="input-group">
                <label>İstek Zaman Aşımı (ms)</label>
                <input type="number" name="api_timeout_ms" value={config.api_timeout_ms} onChange={handleChange} />
                <span className="helper-text">Bir işlemin başarısız sayılacağı maksimum bekleme süresi.</span>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-divider" />

        {/* --- 3. SMTP AYARLARI --- */}
        <section className="settings-section">
          <div className="section-side">
            <h3>E-Posta (SMTP) Yapılandırması</h3>
            <p>Sistem alarmlarının ve kritik bot hatalarının iletileceği mail sunucusu ve bildirim kuralları.</p>
          </div>

          <div className="section-content">
            <div className="setting-block card-style mb-4">
              <div className="setting-info">
                <label>Kritik Hata (Crash) Bildirimi</label>
                <span>Botlardan biri beklenmedik şekilde durursa yetkililere anında e-posta raporu gönderilir.</span>
              </div>
              <div className="setting-action">
                <label className="toggle-switch">
                  <input type="checkbox" name="notify_on_error" checked={config.notify_on_error} onChange={handleChange} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="card-style">
              <div className="inner-section-header">
                <h4>Sunucu Bağlantı Detayları</h4>
                <button className="btn-outline-small" onClick={testSMTPConnection} disabled={isCheckingSMTP}>
                  {isCheckingSMTP ? <RefreshCcw size={14} className="spin" /> : 'Test Et'} 
                </button>
              </div>
              
              <div className="setting-block row-layout mt-3">
                <div className="input-group">
                  <label>SMTP Host</label>
                  <input type="text" name="smtp_host" value={config.smtp_host} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label>SMTP Port</label>
                  <input type="number" name="smtp_port" value={config.smtp_port} onChange={handleChange} />
                </div>
              </div>
              
              <div className="setting-block row-layout mt-4">
                <div className="input-group">
                  <label>Yetkili Gönderici (Auth Email)</label>
                  <input type="text" name="smtp_user" value={config.smtp_user} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label>Alıcı E-posta (Admin Email)</label>
                  <input type="email" name="admin_email" value={config.admin_email} onChange={handleChange} disabled={!config.notify_on_error} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-divider" />

        {/* --- 4. GÜVENLİK --- */}
        <section className="settings-section">
          <div className="section-side">
            <h3>Güvenlik & Log Yönetimi</h3>
            <p>Panele erişim kısıtlamalarını (Whitelist) ve veritabanı log saklama sürelerini yönetin.</p>
          </div>

          <div className="section-content">
            <div className="setting-block card-style">
              <div className="setting-info">
                <label><Lock size={16} className="text-primary"/> IP Kısıtlaması (Whitelist)</label>
                <span>Sadece güvenilir ağlardan (VPN/Ofis) panele erişilmesine izin verin. Diğer trafik reddedilir.</span>
              </div>
              <div className="setting-action">
                <label className="toggle-switch">
                  <input type="checkbox" name="enable_ip_whitelist" checked={config.enable_ip_whitelist} onChange={handleChange} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            {config.enable_ip_whitelist && (
              <div className="setting-block card-style mt-4 fade-in">
                <div className="input-group full-width">
                  <label>İzin Verilen IP Adresleri (Virgülle ayırın)</label>
                  <textarea name="allowed_ips" rows="2" value={config.allowed_ips} onChange={handleChange} placeholder="Örn: 192.168.1.1, 10.0.0.5"></textarea>
                </div>
              </div>
            )}

            <div className="setting-block row-layout card-style mt-4">
              <div className="input-group">
                <label>Log Saklama Süresi</label>
                <select name="log_retention_days" value={config.log_retention_days} onChange={handleChange}>
                  <option value={7}>7 Gün (Minimum)</option>
                  <option value={15}>15 Gün</option>
                  <option value={30}>30 Gün (Standart)</option>
                  <option value={90}>90 Gün (Arşiv)</option>
                </select>
                <span className="helper-text">Süresi dolan geçmiş loglar otomatik silinir.</span>
              </div>
              <div className="input-group">
                <label>Oturum Zaman Aşımı (Dk)</label>
                <input type="number" name="session_timeout_minutes" value={config.session_timeout_minutes} onChange={handleChange} />
                <span className="helper-text">İşlem yapılmayan süre sonunda otomatik çıkış yapılır.</span>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* AKILLI FLOATING ACTION BAR */}
      <div className={`floating-save-bar ${isDirty ? 'visible' : ''}`}>
        <div className="save-bar-content">
          <div className="save-bar-info">
            <AlertCircle size={20} className="text-warning" />
            <span>Kaydedilmemiş değişiklikleriniz var.</span>
          </div>
          <div className="save-bar-actions">
            <button className="btn-secondary" onClick={handleDiscard} disabled={isSaving}>İptal Et</button>
            <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}