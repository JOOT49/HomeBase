const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { kv } = require('@vercel/kv');
const { put } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer — memory storage only, no disk writes
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── KV HELPERS ────────────────────────────────────────────────────────────
const readData = async (key, def = null) => {
  try { const val = await kv.get(key); return val ?? def; }
  catch { return def; }
};
const writeData = async (key, value) => { await kv.set(key, value); };

// ── ROOMMATES ─────────────────────────────────────────────────────────────
app.get('/api/roommates', async (req, res) => res.json(await readData('roommates', [])));

app.post('/api/roommates', async (req, res) => {
  const { names } = req.body;
  const existing = await readData('roommates', []);
  const newRoommates = names.map(name => ({ id: uuidv4(), name, photo: null, likes: [], dislikes: [] }));
  const all = [...existing, ...newRoommates];
  await writeData('roommates', all);
  res.json(all);
});

app.put('/api/roommates/:id', upload.single('photo'), async (req, res) => {
  const roommates = await readData('roommates', []);
  const idx = roommates.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (req.file) {
    const ext = path.extname(req.file.originalname) || '.jpg';
    const blob = await put(`profiles/${req.params.id}${ext}`, req.file.buffer, {
      access: 'public', contentType: req.file.mimetype,
    });
    roommates[idx].photo = blob.url;
  }
  if (req.body.name) roommates[idx].name = req.body.name;
  if (req.body.likes) roommates[idx].likes = JSON.parse(req.body.likes);
  if (req.body.dislikes) roommates[idx].dislikes = JSON.parse(req.body.dislikes);
  if (req.body.isAdmin !== undefined) roommates[idx].isAdmin = req.body.isAdmin === 'true';
  await writeData('roommates', roommates);
  res.json(roommates[idx]);
});

app.delete('/api/roommates/:id', async (req, res) => {
  let roommates = await readData('roommates', []);
  roommates = roommates.filter(r => r.id !== req.params.id);
  await writeData('roommates', roommates);
  res.json({ ok: true });
});

// ── COOKING ───────────────────────────────────────────────────────────────
app.get('/api/cooking/schedule', async (req, res) => res.json(await readData('cooking_schedule', { weeks: {} })));

app.post('/api/cooking/generate', async (req, res) => {
  const { weekStart, days } = req.body;
  const roommates = await readData('roommates', []);
  if (!roommates.length) return res.status(400).json({ error: 'No roommates' });
  const schedule = await readData('cooking_schedule', { weeks: {} });
  const shuffled = [...roommates].sort(() => Math.random() - 0.5);
  const assignments = {};
  days.forEach((day, i) => { assignments[day] = shuffled[i % shuffled.length].id; });
  schedule.weeks[weekStart] = { days: assignments, recipes: {}, cookingDays: days };
  await writeData('cooking_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cooking/override', async (req, res) => {
  const { weekStart, day, roommateId } = req.body;
  const schedule = await readData('cooking_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  schedule.weeks[weekStart].days[day] = roommateId;
  await writeData('cooking_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cooking/recipe', async (req, res) => {
  const { weekStart, day, recipeName, recipeLink, recipeImage } = req.body;
  const schedule = await readData('cooking_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  if (!schedule.weeks[weekStart].recipes) schedule.weeks[weekStart].recipes = {};
  schedule.weeks[weekStart].recipes[day] = { name: recipeName, link: recipeLink, image: recipeImage };
  await writeData('cooking_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.post('/api/cooking/fetch-recipe-image', async (req, res) => {
  const { url } = req.body;
  try {
    const https = require('https'), http = require('http');
    const lib = url.startsWith('https') ? https : http;
    const html = await new Promise((resolve, reject) => {
      lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
      }).on('error', reject);
    });
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    res.json({ image: m ? m[1] : null });
  } catch { res.json({ image: null }); }
});

// ── REVIEWS ───────────────────────────────────────────────────────────────
app.get('/api/reviews', async (req, res) => res.json(await readData('reviews', [])));

app.post('/api/reviews', async (req, res) => {
  const { cookId, reviewerId, rating, comment, date, mealName } = req.body;
  const reviews = await readData('reviews', []);
  reviews.push({ id: uuidv4(), cookId, reviewerId, rating: Number(rating), comment, date, mealName, createdAt: new Date().toISOString() });
  await writeData('reviews', reviews);
  res.json(reviews);
});

app.delete('/api/reviews/:id', async (req, res) => {
  let reviews = await readData('reviews', []);
  reviews = reviews.filter(r => r.id !== req.params.id);
  await writeData('reviews', reviews);
  res.json(reviews);
});

app.get('/api/reviews/averages', async (req, res) => {
  const [reviews, roommates] = await Promise.all([readData('reviews', []), readData('roommates', [])]);
  const avgs = {};
  roommates.forEach(r => {
    const mine = reviews.filter(rv => rv.cookId === r.id);
    avgs[r.id] = mine.length ? (mine.reduce((s, rv) => s + rv.rating, 0) / mine.length).toFixed(1) : null;
  });
  res.json(avgs);
});

// ── CLEANING ──────────────────────────────────────────────────────────────
app.get('/api/cleaning/tasks', async (req, res) => res.json(await readData('cleaning_tasks', [])));

app.post('/api/cleaning/tasks', async (req, res) => {
  const { name } = req.body;
  const tasks = await readData('cleaning_tasks', []);
  tasks.push({ id: uuidv4(), name });
  await writeData('cleaning_tasks', tasks);
  res.json(tasks);
});

app.delete('/api/cleaning/tasks/:id', async (req, res) => {
  let tasks = await readData('cleaning_tasks', []);
  tasks = tasks.filter(t => t.id !== req.params.id);
  await writeData('cleaning_tasks', tasks);
  res.json(tasks);
});

app.get('/api/cleaning/schedule', async (req, res) => res.json(await readData('cleaning_schedule', { weeks: {} })));

app.post('/api/cleaning/generate', async (req, res) => {
  const { weekStart } = req.body;
  const [tasks, roommates] = await Promise.all([readData('cleaning_tasks', []), readData('roommates', [])]);
  if (!tasks.length || !roommates.length) return res.status(400).json({ error: 'Need tasks and roommates' });
  const schedule = await readData('cleaning_schedule', { weeks: {} });
  const assignments = {};
  [...tasks].sort(() => Math.random() - 0.5).forEach((task, i) => { assignments[task.id] = roommates[i % roommates.length].id; });
  schedule.weeks[weekStart] = { assignments, completed: {} };
  await writeData('cleaning_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cleaning/complete', async (req, res) => {
  const { weekStart, taskId, done } = req.body;
  const schedule = await readData('cleaning_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  schedule.weeks[weekStart].completed[taskId] = done;
  await writeData('cleaning_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cleaning/override', async (req, res) => {
  const { weekStart, taskId, roommateId } = req.body;
  const schedule = await readData('cleaning_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  schedule.weeks[weekStart].assignments[taskId] = roommateId;
  await writeData('cleaning_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

// ── SETTINGS ──────────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => res.json(await readData('settings', { weatherLocation: '', apartmentName: 'Our Place' })));

app.put('/api/settings', async (req, res) => {
  const current = await readData('settings', {});
  const updated = { ...current, ...req.body };
  await writeData('settings', updated);
  res.json(updated);
});

app.put('/api/calendar/url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL' });
  const settings = await readData('settings', {});
  settings.calendarUrl = url;
  await writeData('settings', settings);
  res.json({ ok: true });
});

app.get('/api/calendar/events', async (req, res) => {
  const settings = await readData('settings', {});
  if (!settings.calendarUrl) return res.json([]);
  try {
    const ical = require('node-ical');
    const data = await ical.async.fromURL(settings.calendarUrl);
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const events = [];
    Object.values(data).forEach(ev => {
      if (ev.type !== 'VEVENT') return;
      const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (start >= now && start <= future)
        events.push({ summary: ev.summary, start: start.toISOString(), end: ev.end ? new Date(ev.end).toISOString() : null });
    });
    events.sort((a, b) => new Date(a.start) - new Date(b.start));
    res.json(events.slice(0, 20));
  } catch { res.json([]); }
});

// ── WEATHER ───────────────────────────────────────────────────────────────
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Need lat/lon' });
  try {
    const https = require('https');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit&forecast_days=1`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETUP CHECK ───────────────────────────────────────────────────────────
app.get('/api/setup-status', async (req, res) => {
  const roommates = await readData('roommates', []);
  res.json({ setupComplete: roommates.length > 0 });
});

app.listen(PORT, () => console.log(`🏠 RoomApp on port ${PORT}`));
module.exports = app;
