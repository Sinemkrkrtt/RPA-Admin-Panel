// controllers/robotController.js (Örnek)
const { sendAlertEmail } = require('../services/emailService');
const pool = require('../config/db');

exports.updateRobotStatus = async (req, res) => {
    const { id } = req.params;
    const { status, errorMessage } = req.body;

    try {
        // 1. Veritabanında botu güncelle
        const updateQuery = 'UPDATE robots SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        const result = await pool.query(updateQuery, [status, id]);
        
        const updatedRobot = result.rows[0];

        // 2. Eğer durum "Error" veya "Failed" olarak geldiyse mail servisini tetikle
        if (status === 'Error' || status === 'Failed') {
            const mailSubject = `Kritik Hata: ${updatedRobot.bot_name} Durdu!`;
            
            // Şık bir HTML şablonu oluşturuyoruz
            const mailHtml = `
                <div style="font-family: Arial, sans-serif; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #d32f2f;">RPA Sistem Uyarısı</h2>
                    <p><strong>${updatedRobot.bot_name}</strong> isimli robot çalışma sırasında bir hatayla karşılaştı ve durduruldu.</p>
                    <p><strong>Hata Detayı:</strong> ${errorMessage || 'Bilinmeyen Hata'}</p>
                    <p><strong>Zaman:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">Lütfen yönetim paneline giriş yaparak sistem loglarını kontrol ediniz.</p>
                </div>
            `;

            // Asenkron olarak maili gönder (Sistemi bekletmemesi için await kullanmadan da tetikleyebilirsin ama loglamak için await iyi olabilir)
            await sendAlertEmail(mailSubject, mailHtml);
        }

        res.status(200).json(updatedRobot);

    } catch (error) {
        console.error("Bot güncellenirken hata:", error);
        res.status(500).json({ error: "Sunucu hatası" });
    }
};