const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Data file helpers
const dataFile = (name) => path.join(DATA_DIR, `${name}.json`);
const readData = (name, def = {}) => {
  try { return JSON.parse(fs.readFileSync(dataFile(name), 'utf8')); }
  catch { return def; }
};
const writeData = (name, data) => fs.writeFileSync(dataFile(name), JSON.stringify(data, null, 2));

// Multer config for profile pics
const profileStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `profile_${Date.now()}${path.extname(file.originalname)}`)
});
const uploadProfile = multer({ storage: profileStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── ROOMMATES ──────────────────────────────────────────────────────────────
app.get('/api/roommates', (req, res) => res.json(readData('roommates', [])));

app.post('/api/roommates', (req, res) => {
  const { names } = req.body; // array of names
  const existing = readData('roommates', []);
  const newRoommates = names.map(name => ({ id: uuidv4(), name, photo: null, likes: [], dislikes: [] }));
  const all = [...existing, ...newRoommates];
  writeData('roommates', all);
  res.json(all);
});

app.put('/api/roommates/:id', uploadProfile.single('photo'), (req, res) => {
  const roommates = readData('roommates', []);
  const idx = roommates.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (req.file) roommates[idx].photo = `/uploads/${req.file.filename}`;
  if (req.body.name) roommates[idx].name = req.body.name;
  if (req.body.likes) roommates[idx].likes = JSON.parse(req.body.likes);
  if (req.body.dislikes) roommates[idx].dislikes = JSON.parse(req.body.dislikes);
  if (req.body.isAdmin !== undefined) roommates[idx].isAdmin = req.body.isAdmin === 'true';
  writeData('roommates', roommates);
  res.json(roommates[idx]);
});

app.delete('/api/roommates/:id', (req, res) => {
  let roommates = readData('roommates', []);
  roommates = roommates.filter(r => r.id !== req.params.id);
  writeData('roommates', roommates);
  res.json({ ok: true });
});

// ── COOKING SCHEDULE ──────────────────────────────────────────────────────
app.get('/api/cooking/schedule', (req, res) => {
  const schedule = readData('cooking_schedule', { weeks: {} });
  res.json(schedule);
});

app.post('/api/cooking/generate', (req, res) => {
  const { weekStart, days } = req.body; // weekStart: 'YYYY-MM-DD', days: ['Mon','Wed','Fri']
  const roommates = readData('roommates', []);
  if (!roommates.length) return res.status(400).json({ error: 'No roommates' });
  const schedule = readData('cooking_schedule', { weeks: {} });

  const shuffled = [...roommates].sort(() => Math.random() - 0.5);
  const assignments = {};
  days.forEach((day, i) => {
    assignments[day] = shuffled[i % shuffled.length].id;
  });

  schedule.weeks[weekStart] = { days: assignments, recipes: {}, cookingDays: days };
  writeData('cooking_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cooking/override', (req, res) => {
  const { weekStart, day, roommateId } = req.body;
  const schedule = readData('cooking_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  schedule.weeks[weekStart].days[day] = roommateId;
  writeData('cooking_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cooking/recipe', (req, res) => {
  const { weekStart, day, recipeName, recipeLink, recipeImage } = req.body;
  const schedule = readData('cooking_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  if (!schedule.weeks[weekStart].recipes) schedule.weeks[weekStart].recipes = {};
  schedule.weeks[weekStart].recipes[day] = { name: recipeName, link: recipeLink, image: recipeImage };
  writeData('cooking_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

// Fetch OG image from recipe link
app.post('/api/cooking/fetch-recipe-image', async (req, res) => {
  const { url } = req.body;
  try {
    const http = require('http'), https = require('https');
    const lib = url.startsWith('https') ? https : http;
    const html = await new Promise((resolve, reject) => {
      lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, r => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    res.json({ image: ogMatch ? ogMatch[1] : null });
  } catch (e) {
    res.json({ image: null });
  }
});

// ── REVIEWS ───────────────────────────────────────────────────────────────
app.get('/api/reviews', (req, res) => res.json(readData('reviews', [])));

app.post('/api/reviews', (req, res) => {
  const { cookId, reviewerId, rating, comment, date, mealName } = req.body;
  const reviews = readData('reviews', []);
  reviews.push({ id: uuidv4(), cookId, reviewerId, rating: Number(rating), comment, date, mealName, createdAt: new Date().toISOString() });
  writeData('reviews', reviews);
  res.json(reviews);
});

app.delete('/api/reviews/:id', (req, res) => {
  let reviews = readData('reviews', []);
  reviews = reviews.filter(r => r.id !== req.params.id);
  writeData('reviews', reviews);
  res.json(reviews);
});

app.get('/api/reviews/averages', (req, res) => {
  const reviews = readData('reviews', []);
  const roommates = readData('roommates', []);
  const avgs = {};
  roommates.forEach(r => {
    const myReviews = reviews.filter(rv => rv.cookId === r.id);
    avgs[r.id] = myReviews.length ? (myReviews.reduce((s, rv) => s + rv.rating, 0) / myReviews.length).toFixed(1) : null;
  });
  res.json(avgs);
});

// ── CLEANING ──────────────────────────────────────────────────────────────
app.get('/api/cleaning/tasks', (req, res) => res.json(readData('cleaning_tasks', [])));

app.post('/api/cleaning/tasks', (req, res) => {
  const { name } = req.body;
  const tasks = readData('cleaning_tasks', []);
  tasks.push({ id: uuidv4(), name });
  writeData('cleaning_tasks', tasks);
  res.json(tasks);
});

app.delete('/api/cleaning/tasks/:id', (req, res) => {
  let tasks = readData('cleaning_tasks', []);
  tasks = tasks.filter(t => t.id !== req.params.id);
  writeData('cleaning_tasks', tasks);
  res.json(tasks);
});

app.get('/api/cleaning/schedule', (req, res) => res.json(readData('cleaning_schedule', { weeks: {} })));

app.post('/api/cleaning/generate', (req, res) => {
  const { weekStart } = req.body;
  const tasks = readData('cleaning_tasks', []);
  const roommates = readData('roommates', []);
  if (!tasks.length || !roommates.length) return res.status(400).json({ error: 'Need tasks and roommates' });

  const schedule = readData('cleaning_schedule', { weeks: {} });
  const assignments = {};
  const shuffledTasks = [...tasks].sort(() => Math.random() - 0.5);
  shuffledTasks.forEach((task, i) => {
    assignments[task.id] = roommates[i % roommates.length].id;
  });
  schedule.weeks[weekStart] = { assignments, completed: {} };
  writeData('cleaning_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cleaning/complete', (req, res) => {
  const { weekStart, taskId, done } = req.body;
  const schedule = readData('cleaning_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  schedule.weeks[weekStart].completed[taskId] = done;
  writeData('cleaning_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

app.put('/api/cleaning/override', (req, res) => {
  const { weekStart, taskId, roommateId } = req.body;
  const schedule = readData('cleaning_schedule', { weeks: {} });
  if (!schedule.weeks[weekStart]) return res.status(404).json({ error: 'Week not found' });
  schedule.weeks[weekStart].assignments[taskId] = roommateId;
  writeData('cleaning_schedule', schedule);
  res.json(schedule.weeks[weekStart]);
});

// ── SETTINGS ──────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => res.json(readData('settings', { weatherLocation: '', theme: 'dark', apartmentName: 'Our Place' })));

app.put('/api/settings', (req, res) => {
  const settings = { ...readData('settings', {}), ...req.body };
  writeData('settings', settings);
  res.json(settings);
});

// ── CALENDAR (ICS) ────────────────────────────────────────────────────────
app.put('/api/calendar/url', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL' });
  const settings = readData('settings', {});
  settings.calendarUrl = url;
  writeData('settings', settings);
  res.json({ ok: true });
});

app.get('/api/calendar/events', async (req, res) => {
  const settings = readData('settings', {});
  const calUrl = settings.calendarUrl;
  if (!calUrl) return res.json([]);
  try {
    const ical = require('node-ical');
    const data = await ical.async.fromURL(calUrl);
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const events = [];
    Object.values(data).forEach(ev => {
      if (ev.type !== 'VEVENT') return;
      const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (start >= now && start <= future) {
        events.push({ summary: ev.summary, start: start.toISOString(), end: ev.end ? new Date(ev.end).toISOString() : null });
      }
    });
    events.sort((a, b) => new Date(a.start) - new Date(b.start));
    res.json(events.slice(0, 20));
  } catch (e) {
    res.json([]);
  }
});

// ── WEATHER ───────────────────────────────────────────────────────────────
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Need lat/lon' });
  try {
    const https = require('https');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode&temperature_unit=fahrenheit&forecast_days=1`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SETUP CHECK ───────────────────────────────────────────────────────────
app.get('/api/setup-status', (req, res) => {
  const roommates = readData('roommates', []);
  res.json({ setupComplete: roommates.length > 0 });
});

app.listen(PORT, () => console.log(`🏠 RoomApp running at http://localhost:${PORT}`));
