const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let studentsDB = {};
let subjectsDB = {
  "mtk": { name: "Matematika", formUrl: "" },
  "ipa": { name: "IPA", formUrl: "" },
  "bing": { name: "Bahasa Inggris", formUrl: "" }
};

// Jenis pelanggaran default. Admin bisa tambah/edit
let violationTypes = {
  "TAB_SWITCH": { name: "Pindah Tab", point: 1, autoBlock: 5 },
  "COPY_PASTE": { name: "Copy Paste", point: 2, autoBlock: 3 },
  "RIGHT_CLICK": { name: "Klik Kanan", point: 1, autoBlock: 5 },
  "DEVTOOLS": { name: "Buka DevTools", point: 3, autoBlock: 2 },
  "SPLIT_SCREEN": {"name": "Split Screen Terdeteksi", "point": 10},
  "DEVTOOLS_OPEN": {"name": "DevTools Terbuka", "point": 15},
  "EXIT_FULLSCREEN": {"name": "Keluar Fullscreen", "point": 10}
};

const ADMIN_PASSWORD = "admin123";

const authAdmin = (req, res, next) => {
  if (req.headers['x-admin-password']!== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/', (req, res) => res.json({ status: 'OK' }));

// PUBLIC
app.get('/api/subjects', (req, res) => {
  const result = {};
  for (let id in subjectsDB) {
    if (subjectsDB[id].formUrl) result[id] = subjectsDB[id];
  }
  res.json(result);
});

// PUBLIC: kirim jenis pelanggaran ke frontend
app.get('/api/violations', (req, res) => {
  res.json(violationTypes);
});

app.post('/api/init', (req, res) => {
  const { name, email, subject } = req.body;

  if (!email ||!name ||!subject) {
    return res.status(400).json({ error: 'Nama, Email, Mapel wajib diisi' });
  }

  // FIX: Hanya izinkan domain @smpkanisiuskudus.sch.id
  if (!email.endsWith('@smpkanisiuskudus.sch.id')) {
    return res.status(403).json({ error: 'Hanya email @smpkanisiuskudus.sch.id yang diizinkan' });
  }

  if (!subjectsDB[subject] ||!subjectsDB[subject].formUrl) {
    return res.status(404).json({ error: 'Mapel belum diset oleh admin' });
  }

  if (!studentsDB[email]) {
    studentsDB[email] = {
      name, email, subject,
      totalPoint: 0,
      blocked: false,
      logs: [],
      startTime: new Date()
    };
  }

  res.json({
    totalPoint: studentsDB[email].totalPoint,
    blocked: studentsDB[email].blocked,
    formUrl: subjectsDB[subject].formUrl
  });
});

// FIX: Log pake jenis pelanggaran
app.post('/api/log', (req, res) => {
  const { email, violationId } = req.body; // ganti switchCount jadi violationId
  const violation = violationTypes[violationId];

  if (!studentsDB[email]) return res.status(404).json({ error: 'Siswa tidak ditemukan' });
  if (!violation) return res.status(400).json({ error: 'Jenis pelanggaran tidak valid' });

  studentsDB[email].totalPoint += violation.point;
  studentsDB[email].logs.push({
    timestamp: new Date().toISOString(),
    violationId,
    violationName: violation.name,
    point: violation.point,
    totalPoint: studentsDB[email].totalPoint
  });

  // Auto blokir berdasarkan jenis pelanggaran
  const countViolation = studentsDB[email].logs.filter(l => l.violationId === violationId).length;
  if (countViolation >= violation.autoBlock) {
    studentsDB[email].blocked = true;
  }

  return res.json({
    success: true,
    blocked: studentsDB[email].blocked,
    totalPoint: studentsDB[email].totalPoint
  });
});

app.get('/api/status', (req, res) => {
  const email = req.query.email;
  res.json({ blocked: studentsDB[email]?.blocked || false });
});

// ADMIN: Siswa
app.get('/admin/students', authAdmin, (req, res) => {
  res.json(Object.values(studentsDB));
});

app.delete('/admin/student/:email', authAdmin, (req, res) => {
  delete studentsDB[req.params.email];
  res.json({ success: true });
});

// ADMIN: Mapel
app.get('/admin/subjects', authAdmin, (req, res) => res.json(subjectsDB));

app.post('/admin/subjects', authAdmin, (req, res) => {
  const { id, name, formUrl } = req.body;
  if (!id ||!name) return res.status(400).json({ error: 'ID dan Nama wajib' });
  subjectsDB[id] = { name, formUrl: formUrl || "" };
  res.json({ success: true });
});

// ADMIN: Jenis Pelanggaran
app.get('/admin/violations', authAdmin, (req, res) => {
  res.json(violationTypes);
});

app.post('/admin/violations', authAdmin, (req, res) => {
  const { id, name, point, autoBlock } = req.body;
  if (!id ||!name) return res.status(400).json({ error: 'ID dan Nama wajib' });
  violationTypes[id] = {
    name,
    point: parseInt(point) || 1,
    autoBlock: parseInt(autoBlock) || 5
  };
  res.json({ success: true });
});

app.delete('/admin/violation/:id', authAdmin, (req, res) => {
  delete violationTypes[req.params.id];
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server jalan di ${PORT}`));
