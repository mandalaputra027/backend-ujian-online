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
const ADMIN_PASSWORD = "admin123";

const authAdmin = (req, res, next) => {
  if (req.headers['x-admin-password']!== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/', (req, res) => {
  res.json({ status: 'OK' });
});

// PUBLIC: buat dropdown murid. Hanya tampilkan yg ada formUrl
app.get('/api/subjects', (req, res) => {
  const result = {};
  for (let id in subjectsDB) {
    if (subjectsDB[id].formUrl) result[id] = subjectsDB[id];
  }
  res.json(result);
});

app.post('/api/init', (req, res) => {
  const { name, email, subject } = req.body;
  if (!email ||!name ||!subject) {
    return res.status(400).json({ error: 'Nama, Email, Mapel wajib diisi' });
  }
  if (!subjectsDB[subject] ||!subjectsDB[subject].formUrl) {
    return res.status(404).json({ error: 'Mapel belum diset oleh admin' });
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

app.post('/api/log', (req, res) => {
  const { email, event, switchCount } = req.body;
  if (studentsDB[email]) {
    studentsDB[email].switchCount = switchCount;
    studentsDB[email].logs.push({
      timestamp: new Date().toISOString(),
      event,
      currentSwitchCount: switchCount
    });
    if (switchCount >= 5) studentsDB[email].blocked = true;
    return res.json({ success: true, blocked: studentsDB[email].blocked });
  }
  res.status(404).json({ error: 'Siswa tidak ditemukan' });
});

app.get('/api/status', (req, res) => {
  const email = req.query.email;
  res.json({ blocked: studentsDB[email]?.blocked || false });
});

// ADMIN
app.get('/admin/students', authAdmin, (req, res) => {
  res.json(Object.values(studentsDB));
});

app.get('/admin/subjects', authAdmin, (req, res) => {
  res.json(subjectsDB);
});

app.post('/admin/subjects', authAdmin, (req, res) => {
  const { id, name, formUrl } = req.body;
  if (!id ||!name) return res.status(400).json({ error: 'ID dan Nama wajib' });
  subjectsDB[id] = { name, formUrl: formUrl || "" };
  res.json({ success: true });
});

app.delete('/admin/student/:email', authAdmin, (req, res) => {
  delete studentsDB[req.params.email];
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server jalan di ${PORT}`));
