// services/emailService.js
const nodemailer = require('nodemailer');
const pool = require('../config/db'); // Kendi PostgreSQL bağlantı dosyanın yolunu yazmalısın

// Veritabanından güncel SMTP ayarlarını çeken fonksiyon
async function getSmtpSettings() {
    try {
        // Ayarlar tablosundan JSONB verisini çekiyoruz (id'si 1 olan tek bir satır olduğunu varsayıyoruz)
        const result = await pool.query('SELECT data FROM settings WHERE id = 1');
        if (result.rows.length > 0) {
            return result.rows[0].data.smtp_config; 
        }
        throw new Error("SMTP ayarları veritabanında bulunamadı.");
    } catch (error) {
        console.error("SMTP Ayarları çekilirken hata:", error);
        return null;
    }
}

// Mail gönderme ana fonksiyonu
async function sendAlertEmail(subject, htmlContent) {
    const smtpConfig = await getSmtpSettings();
    
    if (!smtpConfig || !smtpConfig.isEnabled) {
        console.log("E-posta bildirimleri kapalı veya SMTP ayarı yok.");
        return;
    }

    // Nodemailer transporter kurulumu (Dinamik ayarlar ile)
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465, // 465 ise true, 587 ise false genelde
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.password
        }
    });

    try {
        // Sadece yetkili kullanıcıları (Super Admin ve Operatör) veritabanından çekelim
        const usersResult = await pool.query(
            "SELECT email FROM users WHERE role IN ('Super Admin', 'Operator') AND status = 'active'"
        );
        
        const adminEmails = usersResult.rows.map(user => user.email).join(',');

        if(!adminEmails) {
            console.log("Mail gönderilecek aktif yönetici bulunamadı.");
            return;
        }

        // Maili gönder
        const info = await transporter.sendMail({
            from: `"RPA Sistem Uyarıcısı" <${smtpConfig.user}>`,
            to: adminEmails,
            subject: `[RPA UYARISI] - ${subject}`,
            html: htmlContent
        });

        console.log("Uyarı e-postası başarıyla gönderildi: %s", info.messageId);
    } catch (error) {
        console.error("E-posta gönderim hatası:", error);
    }
}

module.exports = { sendAlertEmail };