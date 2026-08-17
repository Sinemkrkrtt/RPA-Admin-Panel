const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rpa_admin_db',
  password: 'mysecretpassword',
  port: 5433,
});

// Veritabanı test endpoint'i
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Veritabanı bağlantısı başarılı!', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).send('Veritabanı hatası');
  }
});

// 1. TÜM ROBOTLARI LİSTELEME (GET)
// Frontend'deki useEffect içinde çalışır ve tabloyu doldurur
app.get('/api/robots', async (req, res) => {
  try {
    // En son eklenen bot en üstte görünsün diye ORDER BY id DESC kullanıyoruz
    const result = await pool.query("SELECT * FROM robots ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Robotlar listelenirken hata:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// 2. YENİ ROBOT EKLEME (POST)
// Frontend'deki Modal formundan gelen verileri kaydeder
app.post('/api/robots', async (req, res) => {
  try {
    const { name, version, schedule, description } = req.body;
    
    const newRobot = await pool.query(
      `INSERT INTO robots (name, version, schedule, description, status, last_run) 
       VALUES ($1, $2, $3, $4, 'Idle', '-') 
       RETURNING *`,
      [name, version || '1.0.0', schedule || 'Yok', description || '']
    );

    res.status(201).json(newRobot.rows[0]);
  } catch (err) {
    console.error("Robot kaydedilirken hata:", err);
    res.status(500).json({ error: 'Robot kaydedilemedi' });
  }
});

// 3. ROBOT SİLME (DELETE)
// Frontend'de çöp kutusu ikonuna tıklandığında çalışır
app.delete('/api/robots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM robots WHERE id = $1", [id]);
    res.json({ message: 'Robot başarıyla silindi' });
  } catch (err) {
    console.error("Robot silinirken hata:", err);
    res.status(500).json({ error: 'Robot silinemedi' });
  }
});

// 4. BOT DURUMUNU GÜNCELLEME (PUT) - Başlat / Durdur / Yeniden Başlat
app.put('/api/robots/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, last_run } = req.body;

    // Veritabanını güncelle
    const result = await pool.query(
      "UPDATE robots SET status = $1, last_run = $2 WHERE id = $3 RETURNING *",
      [status, last_run, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Robot bulunamadı' });
    }

    // İLERİDE BURAYA GELECEK KOD: 
    // Eğer status === 'Running' ise child_process.exec() ile asıl bot scriptini çalıştır.

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Robot durumu güncellenirken hata:", err);
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

// 5. DASHBOARD İSTATİSTİKLERİ (GET)
app.get('/api/dashboard', async (req, res) => {
  try {
    // Veritabanından gerçek zamanlı sayıları çekiyoruz
    const totalResult = await pool.query("SELECT COUNT(*) FROM robots");
    const activeResult = await pool.query("SELECT COUNT(*) FROM robots WHERE status = 'Running'");
    const stoppedResult = await pool.query("SELECT COUNT(*) FROM robots WHERE status = 'Stopped'");

    const totalBots = parseInt(totalResult.rows[0].count);
    const activeBots = parseInt(activeResult.rows[0].count);
    const stoppedBots = parseInt(stoppedResult.rows[0].count);

    // İleride "işlem geçmişi" tablosu eklendiğinde grafik verileri de DB'den hesaplanacak.
    // Şimdilik backend üzerinden API ile dinamik olarak gönderiyoruz.
    const dashboardData = {
      kpi: {
        totalBots: totalBots,
        activeBots: activeBots,
        queuedTasks: (totalBots - activeBots - stoppedBots) * 15, // Idle olanlara göre tahmini bir hesap
        successRate: 94.2
      },
      weeklyData: [
        { gun: 'Pzt', Basarili: 120, Hatali: 12 },
        { gun: 'Sal', Basarili: 132, Hatali: 8 },
        { gun: 'Çar', Basarili: 101, Hatali: 15 },
        { gun: 'Per', Basarili: 143, Hatali: 5 },
        { gun: 'Cum', Basarili: 190, Hatali: 22 },
        { gun: 'Cmt', Basarili: 65, Hatali: 3 },
        { gun: 'Paz', Basarili: 70, Hatali: 5 },
      ],
      totalData: [
        { name: 'Başarılı İşlem', value: 821 },
        { name: 'Hatalı İşlem', value: 70 },
      ]
    };

    res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard verisi çekilirken hata:", err);
    res.status(500).json({ error: 'Dashboard verisi alınamadı' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend ${PORT} portunda çalışıyor...`);
});