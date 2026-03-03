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
import helmet from 'helmet';
import { fileURLToPath } from 'url';

// Compatibilidade ESM: definir __filename e __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// resto do ficheiro continua...
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
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR, { index: false }));

/* ------------------------- Simple request logger ------------------------- */
app.use((req, res, next) => {
  const auth = !!req.headers.authorization;
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.path} Auth:${auth}`);
  next();
});

/* ------------------------- Helper: wrap async handlers ------------------------- */
function wrap(handler: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/* ------------------------- File helpers ------------------------- */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
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

/* ------------------------- Upload (multer + sharp) config ------------------------- */
// memory storage to process with sharp before saving
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 8 * 1024 * 1024 } // 8 MB
});

/* ------------------------- Auth helpers ------------------------- */
function createToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function findUserByEmail(email: string) {
  const users = await readJson(USERS_FILE);
  return users.find((u: any) => u.email === email);
}

/* ------------------------- Auth routes ------------------------- */
// Register
app.post('/auth/register', wrap(async (req, res) => {
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
app.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
}));

/* ------------------------- Auth middleware ------------------------- */
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

/* ------------------------- GET /auth/me ------------------------- */
app.get('/auth/me', authMiddleware, wrap(async (req, res) => {
  const users = await readJson(USERS_FILE);
  const user = users.find((u: any) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email });
}));

/* ------------------------- Upload endpoint (processa com sharp) ------------------------- */
/*
  Nota: o front-end usa <input name="file">. Aceitamos tanto "file" como "image".
  Retornamos { url, thumbUrl } com caminhos públicos em /uploads.
*/
app.post('/api/upload', authMiddleware, wrap(async (req: any, res: any) => {
  await new Promise<void>((resolve, reject) => {
    // accept either field name 'file' or 'image'
    const handler = upload.single('file');
    handler(req, res, (err: any) => {
      if (err) {
        // try 'image' as fallback
        const handler2 = upload.single('image');
        handler2(req, res, (err2: any) => {
          if (err2) return reject(err2);
          return resolve();
        });
      } else {
        return resolve();
      }
    });
  });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  await ensureDataDir();
  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
      .jpeg({ quality: 85 })
      .toFile(largePath);

    // Thumbnail (width 320)
    await sharp(file.buffer)
      .rotate()
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    const publicLarge = `/uploads/${filenameLarge}`;
    const publicThumb = `/uploads/${filenameThumb}`;
    res.status(201).json({ url: publicLarge, thumbUrl: publicThumb, filenameLarge, filenameThumb });
  } catch (err) {
    console.error('Upload processing error:', err);
    // fallback: grava buffer original
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

/* ------------------------- Articles API (file-based) with search & pagination ------------------------- */
async function readArticles() { return await readJson(ARTICLES_FILE); }
async function writeArticles(list: any[]) { await writeJson(ARTICLES_FILE, list); }

function norm(s: any) {
  if (!s) return '';
  return String(s).toLowerCase();
}

/*
  GET /api/articles
  Query params supported (compatible com front-end):
    - q or search: texto de pesquisa
    - theme: filtrar por tema
    - page: número da página (1-based)
    - pageSize: itens por página
    - limit: alias para pageSize
*/
app.get('/api/articles', wrap(async (req, res) => {
  const q = String(req.query.q || req.query.search || '').trim().toLowerCase();
  const theme = String(req.query.theme || '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || req.query.limit) || 12));

  let articles = await readArticles();

  if (q) {
    articles = articles.filter((a: any) => {
      const hay = `${norm(a.title)} ${norm(a.theme || a.category)} ${norm(a.excerpt)} ${norm(a.body || a.content)}`;
      return hay.includes(q);
    });
  }

  if (theme) {
    articles = articles.filter((a: any) => (a.theme || a.category || '').toLowerCase() === theme);
  }

  // sort by date desc if date exists
  articles.sort((a: any, b: any) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const total = articles.length;
  const start = (page - 1) * pageSize;
  const paged = articles.slice(start, start + pageSize);

  // Response shape compatible com front-end: { items: [...], total: N }
  res.json({ items: paged, total, meta: { page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) } });
}));

// Get article by id or slug
app.get('/api/articles/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const articles = await readArticles();
  const a = articles.find((x: any) => x.id === id || x.slug === id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
}));

// Create article (protected)
app.post('/api/articles', authMiddleware, wrap(async (req, res) => {
  const { title, date, theme, category, excerpt, slug, body, content, image } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const articles = await readArticles();
  const newSlug = slug || String(title).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  if (articles.find((a: any) => a.slug === newSlug)) return res.status(409).json({ error: 'slug_exists' });
  const item = {
    id: uuidv4(),
    title,
    date: date || new Date().toISOString().slice(0, 10),
    theme: theme || category || null,
    excerpt: excerpt || '',
    slug: newSlug,
    body: body || content || '',
    image: image || null,
    createdAt: new Date().toISOString()
  };
  articles.unshift(item);
  await writeArticles(articles);
  res.status(201).json(item);
}));

// Edit article
app.put('/api/articles/:id', authMiddleware, wrap(async (req, res) => {
  const id = req.params.id;
  const { title, date, theme, category, excerpt, slug, body, content, image } = req.body || {};
  const articles = await readArticles();
  const idx = articles.findIndex((a: any) => a.id === id || a.slug === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const existing = articles[idx];
  const newSlug = slug || (title ? String(title).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') : existing.slug);
  if (articles.some((a: any, i: number) => i !== idx && a.slug === newSlug)) return res.status(409).json({ error: 'slug_exists' });
  const updated = {
    ...existing,
    title: title ?? existing.title,
    date: date ?? existing.date,
    theme: theme ?? category ?? existing.theme,
    excerpt: excerpt ?? existing.excerpt,
    slug: newSlug,
    body: body ?? content ?? existing.body,
    image: image ?? existing.image,
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

/* ------------------------- SPA fallback (serve index.html for unknown GETs) ------------------------- */
app.use((req: any, res: any, next: any) => {
  if (req.method !== 'GET') return next();
  const accept = String(req.headers.accept || '');
  if (!accept.includes('text/html')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* ------------------------- Global error handler ------------------------- */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Server error' });
  } else {
    res.status(err?.status || 500).json({ error: err?.message || 'Server error', stack: err?.stack });
  }
});

/* ------------------------- Start server ------------------------- */
ensureDataDir().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor Novo Despertar a correr na porta ${PORT}`);
  });
});
