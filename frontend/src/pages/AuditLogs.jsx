import React, { useState, useEffect } from 'react';
import { Shield, Clock, User, Activity, Search } from 'lucide-react';
import './UserManagement.css'; // Tablo stilini buradan alıyoruz

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/audit-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Denetim izleri çekilemedi:", error);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2><Shield size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Denetim İzleri (Audit Logs)</h2>
          <p className="text-muted">Sistemdeki tüm kritik yönetici ve kullanıcı eylemlerini izleyin.</p>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Kullanıcı, işlem veya detay ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Log ID</th>
              <th><Clock size={16} style={{ display: 'inline', marginRight: '4px' }}/> Tarih / Saat</th>
              <th><User size={16} style={{ display: 'inline', marginRight: '4px' }}/> Kullanıcı</th>
              <th><Activity size={16} style={{ display: 'inline', marginRight: '4px' }}/> Eylem</th>
              <th>Detaylar</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="font-medium text-main">LOG-{log.id}</td>
                  <td className="text-muted">{log.created_at}</td>
                  <td className="font-semibold">{log.user_name}</td>
                  <td><span className="badge badge-neutral">{log.action}</span></td>
                  <td className="text-muted">{log.details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}