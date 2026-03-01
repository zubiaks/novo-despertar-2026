import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

dotenvIfNeeded();

function dotenvIfNeeded() {
  try {
    // carrega .env se existir (opcional)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
  } catch (e) {
    // ignore
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/* -------------------------
   Simple request logger
   ------------------------- */
app.use((req, res, next) => {
  const auth = !!req.headers.authorization;
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.path} Auth:${auth}`);
  next();
});

/* -------------------------
   Helper: wrap async handlers
   ------------------------- */
function wrap(handler: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/* -------------------------
   File helpers
   ------------------------- */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function readJson(filePath: string): Promise<any> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function writeJson(filePath: string, data: any) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/* -------------------------
   Upload (multer + sharp) config
   ------------------------- */
// Diretório público para uploads
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fsSync.existsSync(UPLOADS_DIR)) fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });

// Usamos memoryStorage para processar com sharp antes de gravar
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 8 * 1024 * 1024 } // 8 MB
});

/* -------------------------
   Auth helpers
   ------------------------- */
function createToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function findUserByEmail(email: string) {
  const users = await readJson(USERS_FILE);
  return users.find((u: any) => u.email === email);
}

/* -------------------------
   Auth routes
   ------------------------- */

// Register
app.post('/auth/register', wrap(async (req: any, res: any) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const users = await readJson(USERS_FILE);
  if (users.find((u: any) => u.email === email)) return res.status(409).json({ error: 'User exists' });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, passwordHash: hash, createdAt: new Date().toISOString() };
  users.unshift(user);
  await writeJson(USERS_FILE, users);

  res.status(201).json({ id: user.id, email: user.email });
}));

// Login
app.post('/auth/login', wrap(async (req: any, res: any) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = createToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
}));

/* -------------------------
   Auth middleware
   ------------------------- */
function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token missing' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid token format' });
  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET) as any;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* -------------------------
   GET /auth/me
   ------------------------- */
app.get('/auth/me', authMiddleware, wrap(async (req: any, res: any) => {
  const users = await readJson(USERS_FILE);
  const user = users.find((u: any) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email });
}));

/* -------------------------
   Upload endpoint (processa com sharp)
   ------------------------- */
app.post('/api/upload', authMiddleware, wrap(async (req: any, res: any) => {
  await new Promise<void>((resolve, reject) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  // Gera nomes únicos
  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const origExt = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filenameLarge = `large-${baseName}${origExt}`;
  const filenameThumb = `thumb-${baseName}${origExt}`;

  const largePath = path.join(UPLOADS_DIR, filenameLarge);
  const thumbPath = path.join(UPLOADS_DIR, filenameThumb);

  try {
    // Versão otimizada (max width 1200)
    await sharp(file.buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 85, chromaSubsampling: '4:4:4' })
      .toFile(largePath);

    // Thumbnail (width 320)
    await sharp(file.buffer)
      .rotate()
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 80, chromaSubsampling: '4:4:4' })
      .toFile(thumbPath);

    const publicLarge = `/uploads/${filenameLarge}`;
    const publicThumb = `/uploads/${filenameThumb}`;

    res.status(201).json({
      url: publicLarge,
      thumbUrl: publicThumb,
      filenameLarge,
      filenameThumb
    });
  } catch (err) {
    console.error('Upload processing error:', err);
    // tenta gravar o buffer original como fallback
    try {
      const fallbackName = `orig-${baseName}${origExt}`;
      const fallbackPath = path.join(UPLOADS_DIR, fallbackName);
      await fs.writeFile(fallbackPath, file.buffer);
      return res.status(201).json({ url: `/uploads/${fallbackName}`, thumbUrl: null, filename: fallbackName });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to process image' });
    }
  }
}));

/* -------------------------
   Articles API (file-based) with search & pagination
   ------------------------- */
async function readArticles() {
  return await readJson(ARTICLES_FILE);
}

async function writeArticles(list: any[]) {
  await writeJson(ARTICLES_FILE, list);
}

// Helper: normalize string for search
function norm(s: any) {
  if (!s) return '';
  return String(s).toLowerCase();
}

// List articles with optional search, page, limit
app.get('/api/articles', wrap(async (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20)); // limit cap 100

  let articles = await readArticles();

  // optional search filter
  if (q) {
    articles = articles.filter((a: any) => {
      const hay = `${norm(a.title)} ${norm(a.category)} ${norm(a.excerpt)} ${norm(a.content)}`;
      return hay.includes(q);
    });
  }

  // sort by date desc if date exists
  articles.sort((a: any, b: any) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const total = articles.length;
  const start = (page - 1) * limit;
  const paged = articles.slice(start, start + limit);

  res.json({
    results: paged,
    meta: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
}));

// Get article by id (existing)
app.get('/api/articles/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const articles = await readArticles();
  const a = articles.find((x: any) => x.id === id || x.slug === id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
}));

// Get article by slug (explicit route)
app.get('/api/articles/slug/:slug', wrap(async (req, res) => {
  const slug = req.params.slug;
  const articles = await readArticles();
  const a = articles.find((x: any) => x.slug === slug);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
}));

// Create article (protected)
app.post('/api/articles', authMiddleware, wrap(async (req, res) => {
  const { title, date, category, excerpt, slug, content, imageUrl, imageThumbUrl } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Missing title' });

  const articles = await readArticles();
  const newSlug = slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  if (articles.find((a: any) => a.slug === newSlug)) return res.status(409).json({ error: 'slug_exists' });

  const item = {
    id: uuidv4(),
    title,
    date: date || new Date().toISOString().slice(0,10),
    category: category || null,
    excerpt: excerpt || '',
    slug: newSlug,
    content: content || '',
    imageUrl: imageUrl || null,
    imageThumbUrl: imageThumbUrl || null,
    createdAt: new Date().toISOString()
  };
  articles.unshift(item);
  await writeArticles(articles);
  res.status(201).json(item);
}));

/* -------------------------
   Admin: edit & delete (protected)
   ------------------------- */
// Edit article
app.put('/api/articles/:id', authMiddleware, wrap(async (req, res) => {
  const id = req.params.id;
  const { title, date, category, excerpt, slug, content, imageUrl, imageThumbUrl } = req.body || {};
  const articles = await readArticles();
  const idx = articles.findIndex((a: any) => a.id === id || a.slug === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const existing = articles[idx];
  const newSlug = slug || (title ? title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') : existing.slug);
  // check slug conflict with others
  if (articles.some((a: any, i: number) => i !== idx && a.slug === newSlug)) return res.status(409).json({ error: 'slug_exists' });

  const updated = {
    ...existing,
    title: title ?? existing.title,
    date: date ?? existing.date,
    category: category ?? existing.category,
    excerpt: excerpt ?? existing.excerpt,
    slug: newSlug,
    content: content ?? existing.content,
    imageUrl: imageUrl ?? existing.imageUrl,
    imageThumbUrl: imageThumbUrl ?? existing.imageThumbUrl,
    updatedAt: new Date().toISOString()
  };
  articles[idx] = updated;
  await writeArticles(articles);
  res.json(updated);
}));

// Delete article
app.delete('/api/articles/:id', authMiddleware, wrap(async (req, res) => {
  const id = req.params.id;
  let articles = await readArticles();
  const idx = articles.findIndex((a: any) => a.id === id || a.slug === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const removed = articles.splice(idx, 1)[0];
  await writeArticles(articles);
  res.json({ ok: true, removedId: removed.id });
}));

/* -------------------------
   SPA fallback (serve index.html for unknown GETs)
   ------------------------- */
app.use((req: any, res: any, next: any) => {
  if (req.method !== 'GET') return next();
  const accept = String(req.headers.accept || '');
  if (!accept.includes('text/html')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/* -------------------------
   Global error handler
   ------------------------- */
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Server error' });
  } else {
    res.status(err?.status || 500).json({
      error: err?.message || 'Server error',
      stack: err?.stack,
    });
  }
});

/* -------------------------
   Start server
   ------------------------- */
app.listen(PORT, () => {
  console.log(`Servidor Novo Despertar a correr na porta ${PORT}`);
});
