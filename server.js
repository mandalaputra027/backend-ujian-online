const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Mengizinkan CORS agar frontend GitHub Pages bisa mengakses backend ini
app.use(cors());
app.use(express.json());

// Database sementara berbasis memori RAM (Hilang jika server restart)
// Jika untuk produksi jangka panjang, Anda disarankan menghubungkannya ke MongoDB/PostgreSQL
let studentsDB = {}; 

// 1. Inisialisasi Ujian / Login Murid
app.post('/api/init', (req, requireResponse) => {
  const { name, email } = req.body;
  if (!email || !name) {
    return requireResponse.status(400).json({ error: 'Nama dan Email wajib diisi' });
  }

  // Jika siswa sudah terdaftar sebelumnya, pakai data lama (misal gak sengaja close tab)
  if (!studentsDB[email]) {
    studentsDB[email] = {
      name: name,
      email: email,
      switchCount: 0,
      blocked: false,
      logs: []
    };
    console.log(`📝 Murid baru login: ${name} (${email})`);
  } else {
    console.log(`🔄 Murid login kembali: ${name} (${email})`);
  }

  requireResponse.json({
    switchCount: studentsDB[email].switchCount,
    blocked: studentsDB[email].blocked
  });
});

// 2. Mencatat Log Kecurangan / Aktivitas Murid
app.post('/api/log', (req, requireResponse) => {
  const { email, event, switchCount } = req.body;
  
  if (studentsDB[email]) {
    studentsDB[email].switchCount = switchCount;
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      currentSwitchCount: switchCount
    };
    studentsDB[email].logs.push(logEntry);
    
    // Auto-block jika melanggar batas (misal >= 5)
    if (switchCount >= 5) {
      studentsDB[email].blocked = true;
      console.log(`🚫 SISWA DIBLOKIR otomatis: ${studentsDB[email].name} (${email})`);
    }

    console.log(`⚠️ Log Baru [${email}]: ${event} (Total Pelanggaran: ${switchCount})`);
    return requireResponse.json({ success: true, blocked: studentsDB[email].blocked });
  }
  
  requireResponse.status(404).json({ error: 'Siswa tidak ditemukan' });
});

// 3. Pengecekan Status Blokir Realtime (Setiap 5 detik dari frontend)
app.get('/api/status', (req, requireResponse) => {
  const email = req.query.email;
  if (studentsDB[email]) {
    return requireResponse.json({ blocked: studentsDB[email].blocked });
  }
  requireResponse.json({ blocked: false });
});

// 4. Endpoint Khusus Guru untuk melihat hasil/monitoring semua murid
app.get('/admin/monitoring', (req, requireResponse) => {
  requireResponse.json(Object.values(studentsDB));
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`🚀 Server Ujian berjalan di port ${PORT}`);
});