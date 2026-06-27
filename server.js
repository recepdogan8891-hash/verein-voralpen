const express = require('express');
const session = require('express-session');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────
const db = new Database('database.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    image_path  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS kommende (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    title        TEXT NOT NULL,
    date_text    TEXT NOT NULL,
    time_text    TEXT NOT NULL,
    location     TEXT NOT NULL,
    description  TEXT NOT NULL,
    form_url     TEXT NOT NULL,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS post_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );
`);

// Migrate existing image_path → post_images
{
  const postsToMigrate = db.prepare(
    "SELECT id, image_path FROM posts WHERE image_path IS NOT NULL AND image_path != ''"
  ).all();
  const checkImg = db.prepare('SELECT COUNT(*) as cnt FROM post_images WHERE post_id = ?');
  const insertImg = db.prepare('INSERT INTO post_images (post_id, image_path) VALUES (?, ?)');
  for (const p of postsToMigrate) {
    const { cnt } = checkImg.get(p.id);
    if (cnt === 0) insertImg.run(p.id, p.image_path);
  }
}

// ── Upcoming events (multi-row) ───────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS upcoming_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    date_text   TEXT NOT NULL,
    time_text   TEXT NOT NULL,
    location    TEXT NOT NULL,
    description TEXT NOT NULL,
    form_url    TEXT DEFAULT '',
    image_path  TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrate old kommende single row → upcoming_events (once)
{
  const count = db.prepare('SELECT COUNT(*) as cnt FROM upcoming_events').get();
  if (count.cnt === 0) {
    try {
      const old = db.prepare('SELECT * FROM kommende WHERE id = 1').get();
      if (old) {
        db.prepare('INSERT INTO upcoming_events (title, date_text, time_text, location, description, form_url, image_path) VALUES (?,?,?,?,?,?,?)')
          .run(old.title, old.date_text, old.time_text, old.location, old.description, old.form_url || '', old.image_path || null);
      }
    } catch(e) {}
  }
}

// ── Seed static past events (once) ───────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
const alreadySeeded = db.prepare("SELECT value FROM settings WHERE key = 'static_posts_seeded'").get();
if (!alreadySeeded) {
  const insertPost = db.prepare('INSERT INTO posts (title, content, created_at) VALUES (?, ?, ?)');
  const insertImg  = db.prepare('INSERT INTO post_images (post_id, image_path) VALUES (?, ?)');
  const staticPosts = [
    {
      title: 'Kreative Bastelstunde mit den Kindern 🎨💞',
      content: 'Gemeinsam mit den Kindern haben wir eine kreative Bastelaktivität durchgeführt. Mit bunten Papieren, Stiften und viel Fantasie sind tolle kleine Kunstwerke entstanden. Die Kinder hatten grossen Spass beim Basteln, Austauschen und gemeinsamen Arbeiten. Es war eine schöne und lehrreiche Aktivität, die sowohl die Kreativität als auch den Zusammenhalt gestärkt hat.',
      image: '/images/kreative-bastelstunde.png',
      created_at: '2026-01-26 12:00:00'
    },
    {
      title: 'Gemeinsames Türkisches Frühstück am Sonntag 🎭🎪',
      content: 'Am Sonntag haben wir gemeinsam mit unseren Mitgliedern und Gästen aus verschiedenen Kulturen ein gemütliches türkisches Frühstück veranstaltet. In entspannter Atmosphäre konnten wir zusammen frühstücken, uns austauschen und neue Kontakte knüpfen. Es war ein schönes Beisammensein, das den interkulturellen Austausch gestärkt und allen viel Freude bereitet hat.',
      image: '/images/gemeinsmes-türkisches-frühstück.png',
      created_at: '2025-12-07 12:00:00'
    },
    {
      title: 'Lesewettbewerb für Kinder 📚🏆',
      content: 'Um unseren Kindern die Freude am Lesen näherzubringen und eine Lesegewohnheit zu fördern, haben wir einen Lesewettbewerb organisiert. Für verschiedene Altersgruppen wurden kleine Wettbewerbe durchgeführt, bei denen die Kinder ihr Wissen zeigen konnten. Die erfolgreichen Teilnehmer wurden mit kleinen Preisen belohnt. Es war eine motivierende und schöne Aktivität, die bei den Kindern großen Anklang gefunden hat.',
      image: '/images/Lesewettbewerb.png',
      created_at: '2025-07-12 12:00:00'
    },
    {
      title: 'Ramadan-Bayram-Fest im Spielplatz Schänis 🌙🎉',
      content: 'Am 29.03.2025 haben wir im Spielpark in Schänis gemeinsam mit Menschen aus verschiedenen Kulturen ein Ramadan-Bayram-Fest organisiert. In fröhlicher Atmosphäre wurde gefeiert, gespielt und Zeit miteinander verbracht. Es war ein schönes interkulturelles Treffen, das den Zusammenhalt und das gegenseitige Verständnis gestärkt hat.',
      image: '/images/Ramadan-Bayram-Fest im Spielplatz Schänis.png',
      created_at: '2025-03-29 12:00:00'
    },
    {
      title: 'Muttertagsüberraschung für unsere Mütter 💐',
      content: 'Zum Muttertag haben wir als Verein eine kleine Überraschungsveranstaltung organisiert. Unsere Kinder haben für ihre Mütter Gedichte vorgetragen und mit liebevoll vorbereiteten Programmpunkten für schöne Momente gesorgt. Es war ein herzliches und fröhliches Zusammensein, bei dem die Mütter im Mittelpunkt standen und gemeinsam unvergessliche Erinnerungen geschaffen wurden.',
      image: '/images/Muttertagsüberraschung für unsere Mütter.png',
      created_at: '2024-07-03 12:00:00'
    },
    {
      title: 'Interreligiöser Dialog und Iftar-Treffen',
      content: 'Kirchenvertreter und Mitglieder des Voralpensvereins trafen sich zum Iftar in der evangelischen Kirche Einsiedeln.',
      image: '/images/Interreligiöser Dialog und Iftar-Treffen.png',
      created_at: '2024-05-08 12:00:00'
    }
  ];
  for (const sp of staticPosts) {
    const r = insertPost.run(sp.title, sp.content, sp.created_at);
    insertImg.run(r.lastInsertRowid, sp.image);
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('static_posts_seeded', '1')").run();
}

// ── File upload ───────────────────────────────────────────
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 7) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt'));
  }
});

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'voralpen-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// ── Admin credentials ─────────────────────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'voralpen2024';

const requireAuth = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: 'Nicht autorisiert' });
};

// ── Auth routes ───────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Falsche Zugangsdaten' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// ── Posts routes ──────────────────────────────────────────
const getPostImages = db.prepare('SELECT id, image_path FROM post_images WHERE post_id = ? ORDER BY sort_order, id');

app.get('/api/posts', (_req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  const result = posts.map(p => ({
    ...p,
    images: getPostImages.all(p.id).map(i => ({ id: i.id, path: i.image_path }))
  }));
  res.json(result);
});

app.post('/api/posts', requireAuth, upload.array('images', 20), (req, res) => {
  const { title, content, event_date } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Titel und Inhalt sind Pflichtfelder' });
  }
  const created_at = event_date ? event_date + ' 12:00:00' : null;
  const result = created_at
    ? db.prepare('INSERT INTO posts (title, content, created_at) VALUES (?, ?, ?)').run(title, content, created_at)
    : db.prepare('INSERT INTO posts (title, content) VALUES (?, ?)').run(title, content);
  const postId = result.lastInsertRowid;
  if (req.files && req.files.length) {
    const insertImg = db.prepare('INSERT INTO post_images (post_id, image_path, sort_order) VALUES (?, ?, ?)');
    req.files.forEach((f, i) => insertImg.run(postId, `/uploads/${f.filename}`, i));
  }
  res.json({ success: true, id: postId });
});

app.put('/api/posts/:id', requireAuth, (req, res) => {
  const { title, content, event_date } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
  if (event_date) {
    db.prepare('UPDATE posts SET title=?, content=?, created_at=? WHERE id=?').run(title, content, event_date + ' 12:00:00', req.params.id);
  } else {
    db.prepare('UPDATE posts SET title=?, content=? WHERE id=?').run(title, content, req.params.id);
  }
  res.json({ success: true });
});

app.post('/api/posts/:id/images', requireAuth, upload.array('images', 20), (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'Keine Bilder' });
  const insertImg = db.prepare('INSERT INTO post_images (post_id, image_path) VALUES (?, ?)');
  req.files.forEach(f => insertImg.run(req.params.id, `/uploads/${f.filename}`));
  res.json({ success: true });
});

app.delete('/api/posts/:id/images/:imgId', requireAuth, (req, res) => {
  const img = db.prepare('SELECT * FROM post_images WHERE id = ? AND post_id = ?').get(req.params.imgId, req.params.id);
  if (!img) return res.status(404).json({ error: 'Bild nicht gefunden' });
  const filePath = '.' + img.image_path;
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM post_images WHERE id = ?').run(req.params.imgId);
  res.json({ success: true });
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
  const images = db.prepare('SELECT * FROM post_images WHERE post_id = ?').all(req.params.id);
  images.forEach(img => {
    const filePath = '.' + img.image_path;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
  if (post.image_path) {
    const filePath = '.' + post.image_path;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM post_images WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Upcoming events routes ────────────────────────────────
app.get('/api/upcoming', (_req, res) => {
  res.json(db.prepare('SELECT * FROM upcoming_events ORDER BY sort_order, created_at DESC').all());
});

app.post('/api/upcoming', requireAuth, upload.single('image'), (req, res) => {
  const { title, date_text, time_text, location, description, form_url } = req.body;
  if (!title || !date_text || !time_text || !location || !description)
    return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  const r = db.prepare('INSERT INTO upcoming_events (title, date_text, time_text, location, description, form_url, image_path) VALUES (?,?,?,?,?,?,?)')
    .run(title, date_text, time_text, location, description, form_url || '', image_path);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/upcoming/:id', requireAuth, upload.single('image'), (req, res) => {
  const { title, date_text, time_text, location, description, form_url, remove_image } = req.body;
  if (!title || !date_text || !time_text || !location || !description)
    return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const ev = db.prepare('SELECT * FROM upcoming_events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Nicht gefunden' });
  let image_path;
  if (req.file) {
    image_path = `/uploads/${req.file.filename}`;
  } else if (remove_image === '1') {
    if (ev.image_path) { const fp = '.' + ev.image_path; if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    image_path = null;
  }
  if (image_path !== undefined) {
    db.prepare('UPDATE upcoming_events SET title=?,date_text=?,time_text=?,location=?,description=?,form_url=?,image_path=? WHERE id=?')
      .run(title, date_text, time_text, location, description, form_url || '', image_path, req.params.id);
  } else {
    db.prepare('UPDATE upcoming_events SET title=?,date_text=?,time_text=?,location=?,description=?,form_url=? WHERE id=?')
      .run(title, date_text, time_text, location, description, form_url || '', req.params.id);
  }
  res.json({ success: true });
});

app.delete('/api/upcoming/:id', requireAuth, (req, res) => {
  const ev = db.prepare('SELECT * FROM upcoming_events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Nicht gefunden' });
  if (ev.image_path) { const fp = '.' + ev.image_path; if (fs.existsSync(fp)) fs.unlinkSync(fp); }
  db.prepare('DELETE FROM upcoming_events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Announcements (Ankündigungen) ─────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL DEFAULT 'post',
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    date_text    TEXT DEFAULT '',
    time_text    TEXT DEFAULT '',
    location     TEXT DEFAULT '',
    form_url     TEXT DEFAULT '',
    online_link  TEXT DEFAULT '',
    image_path   TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec(`ALTER TABLE announcements ADD COLUMN online_link TEXT DEFAULT ''`); } catch(_) {}

app.get('/api/announcements', (_req, res) => {
  res.json(db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all());
});

app.post('/api/announcements', requireAuth, upload.single('image'), (req, res) => {
  const { type, title, content, date_text, time_text, location, form_url, online_link } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  const r = db.prepare(
    'INSERT INTO announcements (type, title, content, date_text, time_text, location, form_url, online_link, image_path) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(type || 'post', title, content, date_text || '', time_text || '', location || '', form_url || '', online_link || '', image_path);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/announcements/:id', requireAuth, upload.single('image'), (req, res) => {
  const { title, content, date_text, time_text, location, form_url, online_link, remove_image } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const item = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
  let image_path;
  if (req.file) {
    image_path = `/uploads/${req.file.filename}`;
  } else if (remove_image === '1') {
    if (item.image_path) { const fp = '.' + item.image_path; if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    image_path = null;
  }
  if (image_path !== undefined) {
    db.prepare('UPDATE announcements SET title=?,content=?,date_text=?,time_text=?,location=?,form_url=?,online_link=?,image_path=? WHERE id=?')
      .run(title, content, date_text||'', time_text||'', location||'', form_url||'', online_link||'', image_path, req.params.id);
  } else {
    db.prepare('UPDATE announcements SET title=?,content=?,date_text=?,time_text=?,location=?,form_url=?,online_link=? WHERE id=?')
      .run(title, content, date_text||'', time_text||'', location||'', form_url||'', online_link||'', req.params.id);
  }
  res.json({ success: true });
});

app.delete('/api/announcements/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
  if (item.image_path) { const fp = '.' + item.image_path; if (fs.existsSync(fp)) fs.unlinkSync(fp); }
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Image Proxy (for face-blur CORS workaround) ──────────
const https = require('https');
app.get('/api/image-proxy', (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith('https://assets.zyrosite.com/')) {
    return res.status(400).send('Invalid URL');
  }
  https.get(url, (proxyRes) => {
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    proxyRes.pipe(res);
  }).on('error', () => res.status(500).send('Proxy error'));
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Server läuft auf http://localhost:${PORT}`);
  console.log(`✓ Admin-Panel: http://localhost:${PORT}/admin.html`);
});
