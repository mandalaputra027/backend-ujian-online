"use strict";

const express = require("express");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ═══════════════════════════════════════════════
   MIDDLEWARE
═══════════════════════════════════════════════ */
app.use(cors());
app.use(express.json());

/* ═══════════════════════════════════════════════
   IN-MEMORY STORE
   (Ganti dengan database jika butuh persistence)
═══════════════════════════════════════════════ */

// { [subjectId]: { name: string, formUrl: string } }
const subjects = {};

// { [violationId]: { name: string, point: number, autoBlock: number } }
const violations = {
  TAB_SWITCH:      { name: "Pindah Tab",         point: 5,  autoBlock: 20 },
  COPY_PASTE:      { name: "Copy/Paste",          point: 5,  autoBlock: 20 },
  RIGHT_CLICK:     { name: "Klik Kanan",          point: 2,  autoBlock: 20 },
  FULLSCREEN_EXIT: { name: "Keluar Layar Penuh",  point: 3,  autoBlock: 20 },
};

// { [email]: { name, email, subject, totalPoint, blocked, logs: [{violationId, violationName, point, time}] } }
const students = {};

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function getStudent(email) {
  return students[email] ?? null;
}

function adminAuth(req, res, next) {
  const password = req.headers["x-admin-password"];
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/* ═══════════════════════════════════════════════
   PUBLIC ENDPOINTS  (dipakai halaman ujian siswa)
═══════════════════════════════════════════════ */

// GET /api/subjects
// Kembalikan hanya mapel yang punya formUrl (untuk dropdown siswa)
app.get("/api/subjects", (req, res) => {
  const result = {};
  for (const [id, s] of Object.entries(subjects)) {
    if (s.formUrl && s.formUrl.trim()) {
      result[id] = { name: s.name };
    }
  }
  res.json(result);
});

// GET /api/violations
// Kembalikan konfigurasi jenis pelanggaran (untuk frontend anti-cheat)
app.get("/api/violations", (req, res) => {
  res.json(violations);
});

// POST /api/init
// Inisialisasi sesi ujian siswa
app.post("/api/init", (req, res) => {
  const { name, email, subject } = req.body;

  if (!name || !email || !subject) {
    return res.status(400).json({ error: "name, email, dan subject wajib diisi." });
  }
  if (!email.endsWith("@smpkanisiuskudus.sch.id")) {
    return res.status(400).json({ error: "Gunakan email sekolah @smpkanisiuskudus.sch.id" });
  }
  if (!subjects[subject]) {
    return res.status(400).json({ error: "Mapel tidak ditemukan." });
  }
  if (!subjects[subject].formUrl) {
    return res.status(400).json({ error: "Link form untuk mapel ini belum tersedia." });
  }

  // Cek apakah sudah diblokir sebelumnya
  const existing = students[email];
  if (existing && existing.blocked) {
    return res.json({ blocked: true, totalPoint: existing.totalPoint });
  }

  // Buat atau reset sesi (biarkan siswa retry jika belum blokir)
  students[email] = {
    name,
    email,
    subject,
    totalPoint: existing ? existing.totalPoint : 0,
    blocked: false,
    logs: existing ? existing.logs : [],
    startedAt: new Date().toISOString(),
  };

  res.json({
    blocked: false,
    formUrl: subjects[subject].formUrl,
  });
});

// POST /api/log
// Catat pelanggaran dari browser siswa
app.post("/api/log", (req, res) => {
  const { email, violationId } = req.body;

  if (!email || !violationId) {
    return res.status(400).json({ error: "email dan violationId wajib." });
  }

  const student = getStudent(email);
  if (!student) {
    return res.status(404).json({ error: "Sesi siswa tidak ditemukan." });
  }
  if (student.blocked) {
    return res.json({ blocked: true, totalPoint: student.totalPoint });
  }

  const v = violations[violationId];
  if (!v) {
    return res.status(400).json({ error: "Jenis pelanggaran tidak dikenal." });
  }

  // Catat log
  student.logs.push({
    violationId,
    violationName: v.name,
    point: v.point,
    time: new Date().toISOString(),
  });
  student.totalPoint += v.point;

  // Cek auto-blokir
  if (student.totalPoint >= v.autoBlock) {
    student.blocked = true;
  }

  res.json({
    blocked: student.blocked,
    totalPoint: student.totalPoint,
  });
});

// GET /api/status?email=...
// Polling status blokir dari browser siswa
app.get("/api/status", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "email wajib." });

  const student = getStudent(email);
  if (!student) return res.status(404).json({ error: "Tidak ditemukan." });

  res.json({
    blocked: student.blocked,
    totalPoint: student.totalPoint,
  });
});

/* ═══════════════════════════════════════════════
   ADMIN ENDPOINTS  (semua butuh x-admin-password)
═══════════════════════════════════════════════ */

// GET /admin/subjects — semua mapel (termasuk yang belum punya formUrl)
app.get("/admin/subjects", adminAuth, (req, res) => {
  res.json(subjects);
});

// POST /admin/subjects — tambah/edit mapel
app.post("/admin/subjects", adminAuth, (req, res) => {
  const { id, name, formUrl } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id dan name wajib." });

  subjects[id] = { name, formUrl: formUrl || "" };
  res.json({ ok: true });
});

// DELETE /admin/subject/:id
app.delete("/admin/subject/:id", adminAuth, (req, res) => {
  const id = req.params.id;
  if (!subjects[id]) return res.status(404).json({ error: "Mapel tidak ditemukan." });
  delete subjects[id];
  res.json({ ok: true });
});

// GET /admin/violations — semua jenis pelanggaran
app.get("/admin/violations", adminAuth, (req, res) => {
  res.json(violations);
});

// POST /admin/violations — tambah/edit pelanggaran
app.post("/admin/violations", adminAuth, (req, res) => {
  const { id, name, point, autoBlock } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id dan name wajib." });

  violations[id] = {
    name,
    point:     parseInt(point)     || 0,
    autoBlock: parseInt(autoBlock) || 0,
  };
  res.json({ ok: true });
});

// DELETE /admin/violation/:id
app.delete("/admin/violation/:id", adminAuth, (req, res) => {
  const id = req.params.id;
  if (!violations[id]) return res.status(404).json({ error: "Pelanggaran tidak ditemukan." });
  delete violations[id];
  res.json({ ok: true });
});

// GET /admin/students — semua data siswa
app.get("/admin/students", adminAuth, (req, res) => {
  res.json(Object.values(students));
});

// POST /admin/student/:email/block — blokir siswa secara manual
app.post("/admin/student/:email/block", adminAuth, (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const student = getStudent(email);
  if (!student) return res.status(404).json({ error: "Siswa tidak ditemukan." });

  student.blocked = true;
  res.json({ ok: true });
});

// DELETE /admin/student/:email — hapus data siswa
app.delete("/admin/student/:email", adminAuth, (req, res) => {
  const email = decodeURIComponent(req.params.email);
  if (!students[email]) return res.status(404).json({ error: "Siswa tidak ditemukan." });
  delete students[email];
  res.json({ ok: true });
});

/* ═══════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════ */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    students: Object.keys(students).length,
    subjects: Object.keys(subjects).length,
    violations: Object.keys(violations).length,
  });
});

/* ═══════════════════════════════════════════════
   START
═══════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`[server] Berjalan di port ${PORT}`);
  console.log(`[server] Admin password: ${process.env.ADMIN_PASSWORD ? "dari env" : "admin123 (default)"}`);
});
