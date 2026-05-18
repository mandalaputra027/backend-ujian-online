const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database RAM
let studentsDB = {};
let subjectsDB = {
  "mtk": { name: "Matematika", formUrl: "" },
  "ipa": { name: "IPA", formUrl: "" },
  "bing": { name: "Bahasa Inggris", formUrl: "" }
};
const ADMIN_PASSWORD = "admin123"; // Ganti ini!

// Middleware cek admin
const authAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password!== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// 1. Login Murid
app.post('/api/init', (req, res) => {
  const { name, email, subject } = req.body;
  if (!email ||!name ||!subject) {
    return res.status(400).json({ error: 'Nama, Email, Mapel wajib diisi' });
  }

  if (!subjectsDB[subject]) {
    return res.status(404).json({ error: 'Mapel tidak ditemukan' });
  }

  if (!studentsDB[email]) {
    studentsDB[email] = {
      name, email, subject,
      switchCount: 0,
      blocked: false,
      logs: [],
      startTime: new Date()
    };
  }

  res.json({
    switchCount: studentsDB[email].switchCount,
    blocked: studentsDB[email].blocked,
    formUrl: subjectsDB[subject].formUrl
  });
});

// 2. Log kecurangan
app.post('/api/log', (req, res) => {
  const { email, event, switchCount } = req.body;

  if (studentsDB[email]) {
    studentsDB[email].switchCount = switchCount;
    studentsDB[email].logs.push({
      timestamp: new Date().toISOString(),
      event,
      currentSwitchCount: switchCount
    });

    if (switchCount >= 5) {
      studentsDB[email].blocked = true;
    }

    return res.json({ success: true, blocked: studentsDB[email].blocked });
  }

  res.status(404).json({ error: 'Siswa tidak ditemukan' });
});

// 3. Cek status blokir
app.get('/api/status', (req, res) => {
  const email = req.query.email;
  if (studentsDB[email]) {
    return res.json({ blocked: studentsDB[email].blocked });
  }
  res.json({ blocked: false });
});

// 4. ADMIN: Lihat semua siswa
app.get('/admin/students', authAdmin, (req, res) => {
  res.json(Object.values(studentsDB));
});

// 5. ADMIN: Lihat semua mapel
app.get('/admin/subjects', authAdmin, (req, res) => {
  res.json(subjectsDB);
});

// 6. ADMIN: Tambah/Edit mapel + link form
app.post('/admin/subjects', authAdmin, (req, res) => {
  const { id, name, formUrl } = req.body;
  if (!id ||!name) {
    return res.status(400).json({ error: 'ID dan Nama mapel wajib diisi' });
  }

  subjectsDB[id] = { name, formUrl: formUrl || "" };
  res.json({ success: true, subjects: subjectsDB });
});

// 7. ADMIN: Hapus siswa
app.delete('/admin/student/:email', authAdmin, (req, res) => {
  delete studentsDB[req.params.email];
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di port ${PORT}`);
  console.log(`🔑 Password admin: ${ADMIN_PASSWORD}`);
});
