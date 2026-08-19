const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer'); 
const cron = require('node-cron');
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
        url: 'http://localhost:5000',
      },
    ],
  },
  apis: ['./server.js'], // API dokümantasyonunu bu dosyadan okuyacak
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- YENİ EKLENEN E-POSTA SERVİS FONKSİYONU ---
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
// ----------------------------------------------

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Veritabanı bağlantı testi
 *     description: Sistemin PostgreSQL veritabanına bağlanıp bağlanmadığını kontrol eder.
 *     responses:
 *       200:
 *         description: Bağlantı başarılı mesajı ve sunucu saati döner.
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
 *     description: Sistemde kayıtlı olan tüm RPA botlarını getirir.
 *     responses:
 *       200:
 *         description: Başarılı bir şekilde robot listesi döndürüldü.
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
 *     description: Sisteme yeni bir RPA botu kaydeder.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               version:
 *                 type: string
 *               schedule:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Robot başarıyla eklendi.
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
 *     description: ID'si verilen botu sistemden tamamen siler.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Robot başarıyla silindi.
 */
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

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Dashboard istatistikleri
 *     description: Ana sayfa için gerekli olan KPI kart verilerini ve grafik bilgilerini getirir.
 *     responses:
 *       200:
 *         description: İstatistiksel veriler başarıyla çekildi.
 */
app.get('/api/dashboard', async (req, res) => {
  try {
    const totalResult = await pool.query("SELECT COUNT(*) FROM robots");
    const activeResult = await pool.query("SELECT COUNT(*) FROM robots WHERE status = 'Running'");
    const stoppedResult = await pool.query("SELECT COUNT(*) FROM robots WHERE status = 'Stopped'");

    const totalBots = parseInt(totalResult.rows[0].count);
    const activeBots = parseInt(activeResult.rows[0].count);
    const stoppedBots = parseInt(stoppedResult.rows[0].count);

    const dashboardData = {
      kpi: {
        totalBots: totalBots,
        activeBots: activeBots,
        queuedTasks: (totalBots - activeBots - stoppedBots) * 15, 
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

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Tüm işleri listeler
 *     description: İş kuyruğundaki tüm görevleri getirir.
 *     responses:
 *       200:
 *         description: İş kuyruğu listesi başarıyla döndürüldü.
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
 *     description: İş kuyruğuna yeni bir görev atar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bot_name:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *               created_at:
 *                 type: string
 *     responses:
 *       201:
 *         description: İş başarıyla kaydedildi.
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
 *     description: Kuyruktaki bir işin durumunu (Processing, Completed vb.) günceller.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: İş durumu güncellendi.
 */
app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

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
 *     description: Kuyruktan belirtilen işi siler.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: İş başarıyla silindi.
 */
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
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
 *     responses:
 *       200:
 *         description: Sistem logları listesi.
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
 *     description: Sisteme yeni bir hata veya bilgi logu düşer.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bot_name:
 *                 type: string
 *               log_type:
 *                 type: string
 *               message:
 *                 type: string
 *               stack_trace:
 *                 type: string
 *               created_at:
 *                 type: string
 *     responses:
 *       201:
 *         description: Log başarıyla eklendi.
 */
app.post('/api/logs', async (req, res) => {
  try {
    const { bot_name, log_type, message, stack_trace, created_at } = req.body;
    
    const newLog = await pool.query(
      `INSERT INTO logs (bot_name, log_type, message, stack_trace, created_at) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bot_name, log_type || 'Info', message, stack_trace || '', created_at]
    );

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
 *     responses:
 *       200:
 *         description: Sistemdeki yetkili kullanıcılar.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *               status:
 *                 type: string
 *               created_at:
 *                 type: string
 *     responses:
 *       201:
 *         description: Kullanıcı eklendi.
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
    res.status(500).json({ error: 'Kullanıcı eklenemedi (E-posta kullanılıyor olabilir)' });
  }
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     description: Email ve şifre ile sisteme giriş doğrulaması yapar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Giriş başarılı.
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ error: 'Hatalı şifre.' });
    }

    const { password: userPassword, ...userInfo } = user;
    res.status(200).json({ message: 'Giriş başarılı', user: userInfo });

  } catch (err) {
    res.status(500).json({ error: 'Giriş sırasında sunucu hatası.' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Kullanıcıyı siler
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Kullanıcı silindi.
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
 *     responses:
 *       200:
 *         description: Ayarlar JSONB objesi döner.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Ayarlar başarıyla güncellendi.
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
 *     description: Sistem yöneticilerinin yaptığı işlemlerin kayıtlarını döndürür.
 *     responses:
 *       200:
 *         description: Denetim izleri başarıyla getirildi.
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
 *     description: Botu başlatır, durdurur veya hata durumuna geçirir. Aynı zamanda Audit Log'a kayıt düşer.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               last_run:
 *                 type: string
 *               errorMessage:
 *                 type: string
 *               requested_by:
 *                 type: string
 *     responses:
 *       200:
 *         description: Durum başarıyla güncellendi.
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

    res.json(updatedRobot);
    
  } catch (err) {
    console.error("Robot durumu güncellenirken hata:", err);
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend ${PORT} portunda çalışıyor...`);
});