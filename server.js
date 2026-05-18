const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let studentsDB = {};

// 1. Inisialisasi Ujian / Login Murid
app.post('/api/init', (req, res) => {
  const { name, email } = req.body;
  if (!email ||!name) {
    return res.status(400).json({ error: 'Nama dan Email wajib diisi' });
  }

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

  res.json({
    switchCount: studentsDB[email].switchCount,
    blocked: studentsDB[email].blocked
  });
});

// 2. Mencatat Log Kecurangan / Aktivitas Murid
app.post('/api/log', (req, res) => {
  const { email, event, switchCount } = req.body;

  if (studentsDB[email]) {
    studentsDB[email].switchCount = switchCount;
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      currentSwitchCount: switchCount
    };
    studentsDB[email].logs.push(logEntry);

    if (switchCount >= 5) {
      studentsDB[email].blocked = true;
      console.log(`🚫 SISWA DIBLOKIR otomatis: ${studentsDB[email].name} (${email})`);
    }

    console.log(`⚠️ Log Baru [${email}]: ${event} (Total Pelanggaran: ${switchCount})`);
    return res.json({ success: true, blocked: studentsDB[email].blocked });
  }

  res.status(404).json({ error: 'Siswa tidak ditemukan' });
});

// 3. Pengecekan Status Blokir Realtime
app.get('/api/status', (req, res) => {
  const email = req.query.email;
  if (studentsDB[email]) {
    return res.json({ blocked: studentsDB[email].blocked });
  }
  res.json({ blocked: false });
});

// 4. Endpoint Guru untuk monitoring
app.get('/admin/monitoring', (req, res) => {
  res.json(Object.values(studentsDB));
});

app.listen(PORT, () => {
  console.log(`🚀 Server Ujian berjalan di port ${PORT}`);
});
