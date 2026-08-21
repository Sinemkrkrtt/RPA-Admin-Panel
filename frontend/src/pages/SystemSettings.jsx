import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Key, Globe, Activity, Lock, ShieldAlert, Eye, EyeOff, Loader2,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, WifiOff, Mail, Save
} from 'lucide-react';
import './SystemSettings.css';

const API = 'https://rpa-admin-panel.onrender.com/api/settings';

const DEFAULTS = {
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
};

const NUMERIC = new Set([
  'max_api_requests', 'api_timeout_ms', 'smtp_port', 'log_retention_days', 'session_timeout_minutes'
]);

const SECRET = new Set(['crm_api_key']);

const LABELS = {
  maintenance_mode: 'Bakım modu',
  system_language: 'Sistem dili',
  timezone: 'Zaman dilimi',
  crm_api_key: 'CRM anahtarı',
  erp_base_url: 'ERP adresi',
  max_api_requests: 'Dakikalık istek limiti',
  api_timeout_ms: 'İstek zaman aşımı',
  notify_on_error: 'Hata bildirimi',
  admin_email: 'Alıcı e-posta',
  smtp_host: 'SMTP sunucusu',
  smtp_port: 'SMTP portu',
  smtp_user: 'Gönderici hesap',
  log_retention_days: 'Log saklama süresi',
  session_timeout_minutes: 'Oturum zaman aşımı',
  enable_ip_whitelist: 'IP kısıtlaması',
  allowed_ips: 'İzinli IP adresleri'
};

const SECTIONS = [
  { id: 'general', label: 'Genel', keys: ['maintenance_mode', 'system_language', 'timezone'] },
  { id: 'api', label: 'API', keys: ['crm_api_key', 'erp_base_url', 'max_api_requests', 'api_timeout_ms'] },
  { id: 'smtp', label: 'E-posta', keys: ['notify_on_error', 'smtp_host', 'smtp_port', 'smtp_user', 'admin_email'] },
  { id: 'security', label: 'Güvenlik', keys: ['enable_ip_whitelist', 'allowed_ips', 'log_retention_days', 'session_timeout_minutes'] }
];

const show = (key, value) => {
  if (typeof value === 'boolean') return value ? 'Açık' : 'Kapalı';
  if (value === '' || value === null || value === undefined) return '—';
  if (SECRET.has(key)) return '••••••';
  return String(value);
};

export default function SystemSettings() {
  const [config, setConfig] = useState(DEFAULTS);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [savedAt, setSavedAt] = useState(null);
  const [toast, setToast] = useState(null);

  const sectionRefs = useRef({});

  const notify = useCallback((tone, text) => setToast({ tone, text }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- VERİ ---------------- */
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('settings');
      const data = await response.json();
      const merged = { ...DEFAULTS, ...data };
      NUMERIC.forEach((k) => { if (merged[k] !== '' && merged[k] != null) merged[k] = Number(merged[k]); });
      setConfig(merged);
      setOriginalConfig(merged);
      setIsOffline(false);
    } catch (error) {
      console.error('Ayarlar çekilemedi:', error);
      setIsOffline(true);
      setOriginalConfig(DEFAULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  /* ---------------- DEĞİŞİKLİK TAKİBİ ---------------- */
  const changedKeys = useMemo(() => {
    if (!originalConfig) return [];
    return Object.keys(config).filter((k) => config[k] !== originalConfig[k]);
  }, [config, originalConfig]);

  const isDirty = changedKeys.length > 0;
  const changedIn = (key) => changedKeys.includes(key);
  const sectionChanges = (section) => section.keys.filter((k) => changedKeys.includes(k)).length;

  /* ---------------- DOĞRULAMA ---------------- */
  const errors = useMemo(() => {
    const e = {};
    if (config.erp_base_url && !/^https?:\/\//i.test(config.erp_base_url)) {
      e.erp_base_url = 'Adres http:// veya https:// ile başlamalı.';
    }
    if (config.notify_on_error && config.admin_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.admin_email)) {
      e.admin_email = 'Geçerli bir e-posta girin.';
    }
    if (config.smtp_port === '' || Number(config.smtp_port) < 1 || Number(config.smtp_port) > 65535) {
      e.smtp_port = '1 ile 65535 arasında olmalı.';
    }
    if (config.session_timeout_minutes === '' || Number(config.session_timeout_minutes) < 5) {
      e.session_timeout_minutes = 'En az 5 dakika olmalı.';
    }
    if (config.max_api_requests === '' || Number(config.max_api_requests) < 1) {
      e.max_api_requests = 'En az 1 olmalı.';
    }
    return e;
  }, [config]);

  const hasErrors = Object.keys(errors).length > 0;

  /* ---------------- AKSİYONLAR ---------------- */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? checked
        : NUMERIC.has(name)
          ? (value === '' ? '' : Number(value))
          : value
    }));
  };

  const handleSave = useCallback(async () => {
    if (!isDirty || hasErrors || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) throw new Error('kaydedilemedi');
      setOriginalConfig(config);
      setShowDiff(false);
      setSavedAt(new Date());
      notify('ok', 'Ayarlar kaydedildi.');
    } catch (error) {
      console.error('Ayarlar kaydedilemedi:', error);
      notify('error', 'Ayarlar kaydedilemedi. Sunucuyu kontrol edin.');
    } finally {
      setIsSaving(false);
    }
  }, [config, isDirty, hasErrors, isSaving, notify]);

  const handleDiscard = () => {
    setConfig(originalConfig || DEFAULTS);
    setShowDiff(false);
  };

  /* Ctrl/Cmd + S ile kaydet */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleSave]);

  /* Kaydedilmemiş değişiklikle sayfadan ayrılma uyarısı */
  useEffect(() => {
    if (!isDirty) return;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [isDirty]);

  /* Kaydırmaya göre aktif bölüm */
  useEffect(() => {
    if (isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((en) => en.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLoading]);

  const goTo = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const testSMTP = async () => {
    setIsTesting(true);
    try {
      const response = await fetch(`${API}/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_host: config.smtp_host,
          smtp_port: config.smtp_port,
          smtp_user: config.smtp_user
        })
      });
      if (response.status === 404) {
        notify('error', 'Test için /api/settings/test-smtp uç noktası henüz tanımlı değil.');
        return;
      }
      if (!response.ok) throw new Error('smtp');
      notify('ok', 'SMTP sunucusu yanıt verdi.');
    } catch (error) {
      console.error('SMTP testi başarısız:', error);
      notify('error', `${config.smtp_host}:${config.smtp_port} adresine bağlanılamadı.`);
    } finally {
      setIsTesting(false);
    }
  };

  const setRef = (id) => (el) => { sectionRefs.current[id] = el; };

  return (
    <main className="main-content settings-page">
      {/* BAŞLIK — tek satır */}
      <div className="page-head rise">
        <div>
          <h1 className="page-title">Ayarlar</h1>
          <div className="page-sub">
            <span className={`status-dot ${isOffline ? 'is-down' : ''}`} />
            {isDirty
              ? <><span className="count">{changedKeys.length}</span> kaydedilmemiş değişiklik</>
              : savedAt
                ? <>Kaydedildi <span className="mono">{savedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></>
                : 'Tüm değişiklikler kayıtlı'}
          </div>
        </div>
      </div>

      {isOffline && !isLoading && (
        <div className="banner rise" style={{ '--d': '40ms' }}>
          <WifiOff size={16} />
          <span>Ayarlar sunucudan okunamadı, varsayılan değerler gösteriliyor.</span>
          <button className="btn" onClick={fetchSettings}>Tekrar dene</button>
        </div>
      )}

      <div className="settings-layout rise" style={{ '--d': '70ms' }}>
        {/* SOL RAY */}
        <nav className="rail" aria-label="Ayar bölümleri">
          <span className="rail-title">Bölümler</span>
          {SECTIONS.map((section, i) => {
            const n = sectionChanges(section);
            return (
              <button
                key={section.id}
                className={`rail-item ${activeSection === section.id ? 'on' : ''}`}
                onClick={() => goTo(section.id)}
              >
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                {section.label}
                {n > 0 && <span className="rail-chg" title={`${n} değişiklik`} />}
              </button>
            );
          })}
          <div className="rail-foot">
            {Object.keys(DEFAULTS).length} ayar<br />
            {changedKeys.length} değişiklik
          </div>
        </nav>

        {/* İÇERİK */}
        <div className="settings-content">
          {/* 1 — GENEL */}
          <section className="panel set-section" id="general" ref={setRef('general')}>
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Genel</h2>
                <p className="panel-desc">Çalışma modu ve bölgesel ayarlar</p>
              </div>
            </div>

            <div className={`set-row ${changedIn('maintenance_mode') ? 'changed' : ''}`}>
              <div className="set-info">
                <label htmlFor="maintenance_mode">
                  <ShieldAlert size={15} style={{ color: 'var(--warn)' }} /> Bakım modu
                  {changedIn('maintenance_mode') && <span className="chg-dot" />}
                </label>
                <p>Açıkken robotlar yeni iş almaz; devam eden işler tamamlanır.</p>
              </div>
              <label className="switch">
                <input id="maintenance_mode" type="checkbox" name="maintenance_mode" checked={!!config.maintenance_mode} onChange={handleChange} />
                <span className="track" />
              </label>
            </div>

            <div className={`set-grid ${changedIn('system_language') || changedIn('timezone') ? 'changed' : ''}`}>
              <div className="f">
                <span className="f-label">Sistem dili {changedIn('system_language') && <i className="chg-dot" />}</span>
                <select name="system_language" value={config.system_language} onChange={handleChange}>
                  <option value="tr">Türkçe</option>
                  <option value="en">English (US)</option>
                </select>
              </div>
              <div className="f">
                <span className="f-label">Zaman dilimi {changedIn('timezone') && <i className="chg-dot" />}</span>
                <select name="timezone" value={config.timezone} onChange={handleChange}>
                  <option value="Europe/Istanbul">Europe/Istanbul (+03:00)</option>
                  <option value="UTC">UTC (+00:00)</option>
                </select>
                <span className="f-hint">Zamanlanmış işler ve log kayıtları bu dilime göre işlenir.</span>
              </div>
            </div>
          </section>

          {/* 2 — API */}
          <section className="panel set-section" id="api" ref={setRef('api')}>
            <div className="panel-head">
              <div>
                <h2 className="panel-title">API ve entegrasyon</h2>
                <p className="panel-desc">Dış sistem kimlik bilgileri ve istek limitleri</p>
              </div>
            </div>

            <div className={`set-grid ${changedIn('crm_api_key') || changedIn('erp_base_url') ? 'changed' : ''}`}>
              <div className="f">
                <span className="f-label">CRM entegrasyon anahtarı {changedIn('crm_api_key') && <i className="chg-dot" />}</span>
                <div className="secret-wrap">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    name="crm_api_key"
                    autoComplete="off"
                    value={config.crm_api_key}
                    onChange={handleChange}
                    placeholder="sk_live_..."
                  />
                  <button
                    type="button"
                    className="secret-toggle"
                    onClick={() => setShowSecret((v) => !v)}
                    aria-label={showSecret ? 'Anahtarı gizle' : 'Anahtarı göster'}
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="f-hint">Anahtar tarayıcıda saklanmaz, yalnızca sunucuya gönderilir.</span>
              </div>

              <div className="f">
                <span className="f-label">ERP sistemi adresi {changedIn('erp_base_url') && <i className="chg-dot" />}</span>
                <div className="with-icon">
                  <Globe size={15} />
                  <input
                    type="text"
                    name="erp_base_url"
                    value={config.erp_base_url}
                    onChange={handleChange}
                    placeholder="https://api.sirket.com/v1"
                    aria-invalid={!!errors.erp_base_url}
                  />
                </div>
                {errors.erp_base_url && <span className="f-error">{errors.erp_base_url}</span>}
              </div>
            </div>

            <div className={`set-grid ${changedIn('max_api_requests') || changedIn('api_timeout_ms') ? 'changed' : ''}`}>
              <div className="f">
                <span className="f-label">Dakika başına istek limiti {changedIn('max_api_requests') && <i className="chg-dot" />}</span>
                <div className="with-icon">
                  <Activity size={15} />
                  <input
                    type="number"
                    name="max_api_requests"
                    value={config.max_api_requests}
                    onChange={handleChange}
                    aria-invalid={!!errors.max_api_requests}
                  />
                </div>
                {errors.max_api_requests
                  ? <span className="f-error">{errors.max_api_requests}</span>
                  : <span className="f-hint">Hedef sistemlerde engellenmemek için üst sınır.</span>}
              </div>
              <div className="f">
                <span className="f-label">İstek zaman aşımı (ms) {changedIn('api_timeout_ms') && <i className="chg-dot" />}</span>
                <input type="number" name="api_timeout_ms" value={config.api_timeout_ms} onChange={handleChange} />
                <span className="f-hint">Bu süreyi aşan istek başarısız sayılır.</span>
              </div>
            </div>
          </section>

          {/* 3 — SMTP */}
          <section className="panel set-section" id="smtp" ref={setRef('smtp')}>
            <div className="panel-head">
              <div>
                <h2 className="panel-title">E-posta bildirimleri</h2>
                <p className="panel-desc">Kritik hataların iletileceği posta sunucusu</p>
              </div>
              <button className="btn" onClick={testSMTP} disabled={isTesting}>
                {isTesting ? <Loader2 size={14} className="spin" /> : <Mail size={14} />}
                {isTesting ? 'Deneniyor' : 'Bağlantıyı test et'}
              </button>
            </div>

            <div className={`set-row ${changedIn('notify_on_error') ? 'changed' : ''}`}>
              <div className="set-info">
                <label htmlFor="notify_on_error">
                  Kritik hata bildirimi
                  {changedIn('notify_on_error') && <span className="chg-dot" />}
                </label>
                <p>Bir robot beklenmedik şekilde durduğunda alıcıya e-posta gönderilir.</p>
              </div>
              <label className="switch">
                <input id="notify_on_error" type="checkbox" name="notify_on_error" checked={!!config.notify_on_error} onChange={handleChange} />
                <span className="track" />
              </label>
            </div>

            <div className={`set-grid ${changedIn('smtp_host') || changedIn('smtp_port') ? 'changed' : ''}`}>
              <div className="f">
                <span className="f-label">SMTP sunucusu {changedIn('smtp_host') && <i className="chg-dot" />}</span>
                <input type="text" name="smtp_host" value={config.smtp_host} onChange={handleChange} />
              </div>
              <div className="f">
                <span className="f-label">Port {changedIn('smtp_port') && <i className="chg-dot" />}</span>
                <input
                  type="number"
                  name="smtp_port"
                  value={config.smtp_port}
                  onChange={handleChange}
                  aria-invalid={!!errors.smtp_port}
                />
                {errors.smtp_port
                  ? <span className="f-error">{errors.smtp_port}</span>
                  : <span className="f-hint">TLS için genellikle 587, SSL için 465.</span>}
              </div>
            </div>

            <div className={`set-grid ${changedIn('smtp_user') || changedIn('admin_email') ? 'changed' : ''}`}>
              <div className="f">
                <span className="f-label">Gönderici hesap {changedIn('smtp_user') && <i className="chg-dot" />}</span>
                <input type="text" name="smtp_user" value={config.smtp_user} onChange={handleChange} placeholder="rpa@sirket.com" />
              </div>
              <div className="f">
                <span className="f-label">Alıcı e-posta {changedIn('admin_email') && <i className="chg-dot" />}</span>
                <input
                  type="email"
                  name="admin_email"
                  value={config.admin_email}
                  onChange={handleChange}
                  disabled={!config.notify_on_error}
                  aria-invalid={!!errors.admin_email}
                  placeholder="operasyon@sirket.com"
                />
                {errors.admin_email
                  ? <span className="f-error">{errors.admin_email}</span>
                  : !config.notify_on_error && <span className="f-hint">Bildirimler kapalıyken kullanılmaz.</span>}
              </div>
            </div>
          </section>

          {/* 4 — GÜVENLİK */}
          <section className="panel set-section" id="security" ref={setRef('security')}>
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Güvenlik ve loglar</h2>
                <p className="panel-desc">Erişim kısıtlaması, oturum ve saklama süreleri</p>
              </div>
            </div>

            <div className={`set-row ${changedIn('enable_ip_whitelist') ? 'changed' : ''}`}>
              <div className="set-info">
                <label htmlFor="enable_ip_whitelist">
                  <Lock size={15} style={{ color: 'var(--accent)' }} /> IP kısıtlaması
                  {changedIn('enable_ip_whitelist') && <span className="chg-dot" />}
                </label>
                <p>Panele yalnızca listelenen ağlardan erişilir, diğer istekler reddedilir.</p>
              </div>
              <label className="switch">
                <input id="enable_ip_whitelist" type="checkbox" name="enable_ip_whitelist" checked={!!config.enable_ip_whitelist} onChange={handleChange} />
                <span className="track" />
              </label>
            </div>

            {config.enable_ip_whitelist && (
              <div className={`set-grid one ${changedIn('allowed_ips') ? 'changed' : ''}`}>
                <div className="f">
                  <span className="f-label">İzin verilen IP adresleri {changedIn('allowed_ips') && <i className="chg-dot" />}</span>
                  <textarea
                    name="allowed_ips"
                    rows="2"
                    value={config.allowed_ips}
                    onChange={handleChange}
                    placeholder="192.168.1.1, 10.0.0.5"
                  />
                  <span className="f-hint">Adresleri virgülle ayırın. Kendi adresinizi eklemeyi unutmayın.</span>
                </div>
              </div>
            )}

            <div className={`set-grid ${changedIn('log_retention_days') || changedIn('session_timeout_minutes') ? 'changed' : ''}`}>
              <div className="f">
                <span className="f-label">Log saklama süresi {changedIn('log_retention_days') && <i className="chg-dot" />}</span>
                <select name="log_retention_days" value={config.log_retention_days} onChange={handleChange}>
                  <option value={7}>7 gün</option>
                  <option value={15}>15 gün</option>
                  <option value={30}>30 gün</option>
                  <option value={90}>90 gün</option>
                </select>
                <span className="f-hint">Süresi dolan kayıtlar otomatik silinir.</span>
              </div>
              <div className="f">
                <span className="f-label">Oturum zaman aşımı (dk) {changedIn('session_timeout_minutes') && <i className="chg-dot" />}</span>
                <input
                  type="number"
                  name="session_timeout_minutes"
                  value={config.session_timeout_minutes}
                  onChange={handleChange}
                  aria-invalid={!!errors.session_timeout_minutes}
                />
                {errors.session_timeout_minutes
                  ? <span className="f-error">{errors.session_timeout_minutes}</span>
                  : <span className="f-hint">Bu süre boyunca işlem yapılmazsa oturum kapanır.</span>}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* KAYDET ÇUBUĞU — değişiklik dökümü ile */}
      <div className={`save-bar ${isDirty ? 'visible' : ''}`}>
        {showDiff && isDirty && (
          <ul className="diff-list">
            {changedKeys.map((key) => (
              <li key={key}>
                <span>{LABELS[key] || key}</span>
                <span className="diff-values">
                  <span className="diff-old">{show(key, originalConfig?.[key])}</span>
                  <span>→</span>
                  <span className="diff-new">{show(key, config[key])}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="save-bar-main">
          <div className="save-bar-text">
            {hasErrors
              ? <><AlertCircle size={16} style={{ color: 'var(--danger)' }} /> Önce hatalı alanları düzeltin</>
              : <><b>{changedKeys.length}</b> alan değişti</>}
          </div>

          {!hasErrors && (
            <button className="diff-toggle" onClick={() => setShowDiff((v) => !v)}>
              {showDiff ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              {showDiff ? 'Gizle' : 'Değişiklikleri gör'}
            </button>
          )}

          <div className="save-bar-actions">
            <button className="btn" onClick={handleDiscard} disabled={isSaving}>Geri al</button>
            <button className="btn-ink" onClick={handleSave} disabled={isSaving || hasErrors}>
              {isSaving ? <><Loader2 size={14} className="spin" /> Kaydediliyor</> : <><Save size={14} /> Kaydet</>}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}