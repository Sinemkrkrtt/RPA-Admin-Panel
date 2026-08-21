const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer'); 
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- YENİ EKLENEN: SOCKET.IO KURULUMU ---
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// Express'i HTTP sunucusu ile sarıp Socket.io'yu başlatıyoruz
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // React'tan gelen bağlantılara izin ver
});

// io objesini rotaların içinde kullanabilmek için Express'e set ediyoruz
app.set('io', io);
// ----------------------------------------

const pool = new Pool({
  connectionString: 'postgresql://postgres.ueaopbwoyoznldndltmc:Arsvh.141204@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Swagger Ayarları
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RPA Admin Paneli API',
      version: '1.0.0',
      description: 'RPA Yönetim Paneli için geliştirilmiş REST API uç noktaları.',
    },
    servers: [
      {
     url: 'https://rpa-admin-panel.onrender.com',
      },
    ],
  },
  apis: ['./server.js'], // API dokümantasyonunu bu dosyadan okuyacak
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// E-POSTA SERVİS FONKSİYONU
async function sendAlertEmail(subject, htmlContent) {
  try {
    const result = await pool.query("SELECT config_data FROM settings WHERE id = 1");
    if (result.rows.length === 0) return;
    
    const configData = result.rows[0].config_data;
    const smtpConfig = configData.smtp; 
    
    if (!smtpConfig || !smtpConfig.isEnabled) {
      console.log("E-posta bildirimleri kapalı veya SMTP ayarı bulunamadı.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port == 465, 
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password
      }
    });

    const usersResult = await pool.query(
      "SELECT email FROM users WHERE role IN ('Süper Admin', 'Operatör') AND status = 'Aktif'"
    );
    
    const adminEmails = usersResult.rows.map(u => u.email).join(',');
    
    if (!adminEmails) {
      console.log("Mail gönderilecek aktif yönetici bulunamadı.");
      return;
    }

    await transporter.sendMail({
      from: `"RPA Sistem Uyarıcısı" <${smtpConfig.user}>`,
      to: adminEmails,
      subject: `[RPA UYARISI] - ${subject}`,
      html: htmlContent
    });
    
    console.log("Uyarı e-postası başarıyla gönderildi.");
  } catch (error) {
    console.error("E-posta gönderim hatası:", error);
  }
}

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Veritabanı bağlantı testi
 */
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Veritabanı bağlantısı başarılı!', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).send('Veritabanı hatası');
  }
});

/**
 * @swagger
 * /api/robots:
 *   get:
 *     summary: Tüm robotları listeler
 */
app.get('/api/robots', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM robots ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Robotlar listelenirken hata:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

/**
 * @swagger
 * /api/robots:
 *   post:
 *     summary: Yeni robot ekler
 */
app.post('/api/robots', async (req, res) => {
  try {
    const { name, version, schedule, description } = req.body;
    
    const newRobot = await pool.query(
      `INSERT INTO robots (name, version, schedule, description, status, last_run) 
       VALUES ($1, $2, $3, $4, 'Idle', '-') 
       RETURNING *`,
      [name, version || '1.0.0', schedule || 'Yok', description || '']
    );

    req.app.get('io').emit('dashboard_update'); // Sinyal gönder
    res.status(201).json(newRobot.rows[0]);
  } catch (err) {
    console.error("Robot kaydedilirken hata:", err);
    res.status(500).json({ error: 'Robot kaydedilemedi' });
  }
});

/**
 * @swagger
 * /api/robots/{id}:
 *   delete:
 *     summary: Robot siler
 */
app.delete('/api/robots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM robots WHERE id = $1", [id]);
    
    req.app.get('io').emit('dashboard_update'); // Sinyal gönder
    res.json({ message: 'Robot başarıyla silindi' });
  } catch (err) {
    console.error("Robot silinirken hata:", err);
    res.status(500).json({ error: 'Robot silinemedi' });
  }
});

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Dashboard istatistikleri
 */
app.get('/api/dashboard', async (req, res) => {
  try {
    const botsRes = await pool.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Running' THEN 1 ELSE 0 END) as active FROM robots"
    );
    const totalBots = parseInt(botsRes.rows[0].total) || 0;
    const activeBots = parseInt(botsRes.rows[0].active) || 0;

    const tasksRes = await pool.query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status");
    let queuedTasks = 0, completedTasks = 0, failedTasks = 0;

    tasksRes.rows.forEach(row => {
      if (row.status === 'Pending') queuedTasks = parseInt(row.count);
      if (row.status === 'Completed') completedTasks = parseInt(row.count);
      if (row.status === 'Failed' || row.status === 'Error') failedTasks = parseInt(row.count);
    });

    const totalProcessed = completedTasks + failedTasks;
    const successRate = totalProcessed > 0 ? ((completedTasks / totalProcessed) * 100).toFixed(1) : 0;

    const allTasksRes = await pool.query("SELECT status, created_at FROM tasks");
    
    const weekDays = { 
      'Pzt': { Basarili: 0, Hatali: 0 }, 'Sal': { Basarili: 0, Hatali: 0 }, 
      'Çar': { Basarili: 0, Hatali: 0 }, 'Per': { Basarili: 0, Hatali: 0 }, 
      'Cum': { Basarili: 0, Hatali: 0 }, 'Cmt': { Basarili: 0, Hatali: 0 }, 
      'Paz': { Basarili: 0, Hatali: 0 } 
    };
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    allTasksRes.rows.forEach(t => {
      if(!t.created_at) return;
      const [datePart] = t.created_at.split(' ');
      if (!datePart) return;
      const [day, month, year] = datePart.split('.');
      const dateObj = new Date(`${year}-${month}-${day}`);
      if(isNaN(dateObj)) return;
      
      const dayStr = dayNames[dateObj.getDay()];
      
      if (t.status === 'Completed') weekDays[dayStr].Basarili += 1;
      if (t.status === 'Failed' || t.status === 'Error') weekDays[dayStr].Hatali += 1;
    });

    const weeklyDataArray = Object.keys(weekDays).map(key => ({
      gun: key,
      Basarili: weekDays[key].Basarili,
      Hatali: weekDays[key].Hatali
    }));

    const totalDataArray = [
      { name: 'Başarılı İşlem', value: completedTasks },
      { name: 'Hatalı İşlem', value: failedTasks },
    ];

    res.json({
      kpi: { totalBots, activeBots, queuedTasks, successRate },
      weeklyData: weeklyDataArray,
      totalData: totalDataArray
    });

  } catch (err) {
    console.error("Dashboard verisi çekilirken hata:", err);
    res.status(500).json({ error: 'Dashboard verisi alınamadı' });
  }
});

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Tüm işleri listeler
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tasks ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("İşler listelenirken hata:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Yeni iş ekler
 */
app.post('/api/tasks', async (req, res) => {
  try {
    const { bot_name, description, priority, created_at } = req.body;
    
    const newTask = await pool.query(
      `INSERT INTO tasks (bot_name, description, priority, status, created_at) 
       VALUES ($1, $2, $3, 'Pending', $4) 
       RETURNING *`,
      [bot_name, description, priority, created_at]
    );

    req.app.get('io').emit('dashboard_update'); // Sinyal gönder
    res.status(201).json(newTask.rows[0]);
  } catch (err) {
    console.error("İş kaydedilirken hata:", err);
    res.status(500).json({ error: 'İş kaydedilemedi' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}/status:
 *   put:
 *     summary: İş durumunu günceller
 */
app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    req.app.get('io').emit('dashboard_update'); // Sinyal gönder
    res.json(result.rows[0]);
  } catch (err) {
    console.error("İş durumu güncellenirken hata:", err);
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: İşi siler
 */
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    
    req.app.get('io').emit('dashboard_update'); // Sinyal gönder
    res.json({ message: 'İş başarıyla silindi' });
  } catch (err) {
    console.error("İş silinirken hata:", err);
    res.status(500).json({ error: 'İş silinemedi' });
  }
});

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Sistem loglarını getirir
 */
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM logs ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Loglar çekilirken hata:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

/**
 * @swagger
 * /api/logs:
 *   post:
 *     summary: Yeni log ekler
 */
app.post('/api/logs', async (req, res) => {
  try {
    const { bot_name, log_type, message, stack_trace, created_at } = req.body;
    
    const newLog = await pool.query(
      `INSERT INTO logs (bot_name, log_type, message, stack_trace, created_at) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bot_name, log_type || 'Info', message, stack_trace || '', created_at]
    );

    // Yeni log eklendiğinde hem log datasını hem de genel güncellemeyi fırlat
    req.app.get('io').emit('new_log', newLog.rows[0]);
    req.app.get('io').emit('dashboard_update'); 

    res.status(201).json(newLog.rows[0]);
  } catch (err) {
    console.error("Log eklenirken hata:", err);
    res.status(500).json({ error: 'Log kaydedilemedi' });
  }
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Tüm kullanıcıları listeler
 */
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcılar getirilemedi' });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Yeni kullanıcı oluşturur
 */
app.post('/api/users', async (req, res) => {
  try {
    const { full_name, email, password, role, status, created_at } = req.body;
    
    const newUser = await pool.query(
      `INSERT INTO users (full_name, email, password, role, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [full_name, email, password, role, status || 'Aktif', created_at]
    );
    
    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcı eklenemedi' });
  }
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Kullanıcı girişi ve Yetkilendirme (JWT)
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Sistemde böyle bir kullanıcı bulunamadı.' });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ message: 'Girdiğiniz şifre hatalı.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name }, 
      'gizli_super_anahtar_123', 
      { expiresIn: '12h' } 
    );

    const { password: userPassword, ...userInfo } = user;

    res.status(200).json({ 
      message: 'Giriş başarılı', 
      token: token, 
      user: userInfo 
    });

  } catch (err) {
    console.error("Login işlemi sırasında hata:", err);
    res.status(500).json({ message: 'Giriş sırasında sunucu hatası yaşandı.' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Kullanıcıyı siler
 */
app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ message: 'Kullanıcı silindi' });
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Sistem ayarlarını getirir
 */
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query("SELECT config_data FROM settings WHERE id = 1");
    if (result.rows.length > 0) {
      res.json(result.rows[0].config_data);
    } else {
      res.status(404).json({ error: 'Ayarlar bulunamadı' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Ayarlar çekilemedi' });
  }
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Sistem ayarlarını günceller
 */
app.put('/api/settings', async (req, res) => {
  try {
    const config_data = req.body;
    await pool.query("UPDATE settings SET config_data = $1 WHERE id = 1", [config_data]);
    res.json({ message: 'Ayarlar başarıyla güncellendi' });
  } catch (err) {
    res.status(500).json({ error: 'Ayarlar güncellenemedi' });
  }
});

cron.schedule('* * * * *', async () => {
  console.log('⏳ [CRON] Zamanlanmış görev kontrolü yapılıyor...');
  try {
    const result = await pool.query("SELECT * FROM robots WHERE schedule = 'Her Dakika' AND status != 'Error'");
    const scheduledBots = result.rows;

    let updated = false;

    for (const bot of scheduledBots) {
      const now = new Date();
      const timeString = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
      
      const autoDescription = `[OTOMASYON] ${bot.name} için planlanmış sistem taraması.`;

      await pool.query(
        `INSERT INTO tasks (bot_name, description, priority, status, created_at) 
         VALUES ($1, $2, $3, 'Pending', $4)`,
        [bot.name, autoDescription, 'Yüksek', timeString]
      );

      console.log(`✅ [OTOMASYON] ${bot.name} için yeni görev başarıyla kuyruğa eklendi!`);
      updated = true;
    }

    if (updated) {
       // Eğer Cron kuyruğa yeni iş eklediyse frontend'i anında güncelle
       io.emit('dashboard_update');
    }
  } catch (err) {
    console.error("Cron motoru çalışırken hata oluştu:", err);
  }
});

async function createAuditLog(user_name, action, details) {
  try {
    const now = new Date();
    const timeString = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
    
    await pool.query(
      "INSERT INTO audit_logs (user_name, action, details, created_at) VALUES ($1, $2, $3, $4)",
      [user_name, action, details, timeString]
    );
  } catch (error) {
    console.error("Denetim izi (Audit Log) kaydedilemedi:", error);
  }
}

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Tüm denetim izlerini (Audit Logs) listeler
 */
app.get('/api/audit-logs', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM audit_logs ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Denetim izleri getirilemedi' });
  }
});

/**
 * @swagger
 * /api/robots/{id}/status:
 *   put:
 *     summary: Robotun çalışma durumunu günceller
 */
app.put('/api/robots/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, last_run, errorMessage, requested_by } = req.body; 

    const result = await pool.query(
      "UPDATE robots SET status = $1, last_run = $2 WHERE id = $3 RETURNING *",
      [status, last_run, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Robot bulunamadı' });
    }

    const updatedRobot = result.rows[0];

    if (status === 'Error' || status === 'Failed') {
      const mailSubject = `Kritik Hata: ${updatedRobot.name} Durdu!`;
      const mailHtml = `
          <div style="font-family: Arial, sans-serif; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
              <h2 style="color: #d32f2f;">RPA Sistem Uyarısı</h2>
              <p><strong>${updatedRobot.name}</strong> isimli robot çalışma sırasında bir hatayla karşılaştı ve durduruldu.</p>
              <p><strong>Hata Detayı:</strong> ${errorMessage || 'Sistem tarafından belirtilmeyen kritik bir hata oluştu.'}</p>
              <p><strong>Zaman:</strong> ${new Date().toLocaleString('tr-TR')}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #888;">Lütfen yönetim paneline giriş yaparak sistem loglarını kontrol ediniz.</p>
          </div>
      `;
      sendAlertEmail(mailSubject, mailHtml); 
    }

    const userName = requested_by || 'Sistem / Admin'; 
    const auditDetail = `${updatedRobot.name} isimli botun durumu '${status}' olarak değiştirildi.`;
    
    createAuditLog(userName, 'Bot Durum Güncellemesi', auditDetail);

    req.app.get('io').emit('dashboard_update'); // Sinyal gönder
    res.json(updatedRobot);
    
  } catch (err) {
    console.error("Robot durumu güncellenirken hata:", err);
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

const PORT = process.env.PORT || 5000;
// app.listen YERİNE server.listen KULLANIYORUZ
server.listen(PORT, () => {
  console.log(`Backend ve WebSocket (Gerçek Zamanlı Veri Akışı) ${PORT} portunda çalışıyor...`);
});