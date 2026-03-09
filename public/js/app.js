// ── STATE ──────────────────────────────────────────────────────────────
const state = {
  roommates: [],
  cookingSchedule: { weeks: {} },
  cleaningSchedule: { weeks: {} },
  cleaningTasks: [],
  reviews: [],
  settings: {},
  currentCookingWeek: null,
  currentCleaningWeek: null,
  overrideDay: null,
  overrideTaskId: null,
  recipeDay: null,
  recipeWeek: null,
  reviewRating: 0,
  currentUser: null,   // { id, name, photo } or null
  isMaster: false,
};

// ── COOKIES ───────────────────────────────────────────────────────────
const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/`;
};
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};
const deleteCookie = (name) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

// ── UTILS ──────────────────────────────────────────────────────────────
const api = async (url, method = 'GET', body = null) => {
  const opts = { method, headers: {} };
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  return res.json();
};

const toast = (msg, type = 'info') => {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
};

const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Sunday
  return d.toISOString().split('T')[0];
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

const getAvatarEl = (roommate, size = 36) => {
  const el = document.createElement('div');
  el.className = 'rating-avatar';
  el.style.width = size + 'px'; el.style.height = size + 'px';
  el.style.fontSize = (size * 0.4) + 'px';
  if (roommate?.photo) {
    const img = document.createElement('img');
    img.src = roommate.photo;
    img.alt = roommate.name;
    el.appendChild(img);
  } else {
    el.textContent = getInitials(roommate?.name || '?');
  }
  return el;
};

const COLORS = ['#6c8fff','#3ecf8e','#f59e0b','#f472b6','#a78bfa','#fb923c','#34d399'];
const getRoommateColor = (id) => {
  const idx = state.roommates.findIndex(r => r.id === id);
  return COLORS[idx % COLORS.length] || '#6c8fff';
};

const starsHTML = (rating) => {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
};

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const FULL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── CLOCK ─────────────────────────────────────────────────────────────
const updateClock = () => {
  const now = new Date();
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('nav-clock').textContent = t;
  const homeTime = document.getElementById('home-time');
  if (homeTime) homeTime.textContent = t;
  const homeDate = document.getElementById('home-date');
  if (homeDate) homeDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};
setInterval(updateClock, 1000);
updateClock();

// ── USER PICKER ───────────────────────────────────────────────────────
const showUserPicker = () => {
  const overlay = document.getElementById('user-picker-overlay');
  overlay.classList.remove('hidden');
  const grid = document.getElementById('user-picker-grid');
  grid.innerHTML = state.roommates.map(r => {
    const avatarInner = r.photo ? `<img src="${r.photo}" alt="${r.name}">` : getInitials(r.name);
    const avatarStyle = r.photo ? '' : `style="background:${getRoommateColor(r.id)}"`;
    const adminBadge = r.isAdmin ? `<div class="user-pick-admin-badge" title="Admin">👑</div>` : '';
    return `<button class="user-pick-btn${r.isAdmin ? ' is-admin' : ''}" data-id="${r.id}">
      <div class="user-pick-avatar-wrap">
        <div class="user-pick-avatar" ${avatarStyle}>${avatarInner}</div>
        ${adminBadge}
      </div>
      <div class="user-pick-name">${r.name}</div>
    </button>`;
  }).join('');

  grid.querySelectorAll('.user-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = state.roommates.find(rm => rm.id === btn.dataset.id);
      // If this roommate is an admin, log them in as master directly — no PIN needed
      if (r.isAdmin) {
        setCurrentUser(r, true);
      } else {
        setCurrentUser(r, false);
      }
      overlay.classList.add('hidden');
    });
  });
};

const setCurrentUser = (user, master) => {
  state.currentUser = user;
  state.isMaster = master;
  // Persist to cookie
  if (master) {
    setCookie('hb_user', 'master');
  } else if (user) {
    setCookie('hb_user', user.id);
  } else {
    deleteCookie('hb_user');
  }
  updateNavBadge();
  updateMasterBanner();
  const isNamedAdmin = master && user?.id !== 'master';
  document.getElementById('main-content').style.marginTop = (master && !isNamedAdmin) ? 'calc(var(--nav-h) + 33px)' : 'var(--nav-h)';
};

const updateNavBadge = () => {
  const badge = document.getElementById('current-user-badge');
  const user = state.currentUser;
  const master = state.isMaster;
  if (!user && !master) { badge.innerHTML = ''; return; }

  // A "named admin" is a real roommate who has admin rights (not the generic PIN master)
  const isNamedAdmin = master && user?.id !== 'master';

  const name = isNamedAdmin ? user.name : (master ? '🔐 Master' : user.name);
  const avatarInner = user?.photo && (isNamedAdmin || !master)
    ? `<img src="${user.photo}" alt="">`
    : master && !isNamedAdmin ? '🔐' : getInitials(user?.name || '?');
  const avatarStyle = user?.photo && (isNamedAdmin || !master)
    ? ''
    : master && !isNamedAdmin
      ? 'style="background:rgba(245,158,11,0.2)"'
      : `style="background:${getRoommateColor(user?.id)}"`;

  badge.className = `current-user-badge${master && !isNamedAdmin ? ' master-mode' : ''}`;
  badge.innerHTML = `<div class="badge-avatar" ${avatarStyle}>${avatarInner}</div><span>${name}</span>${isNamedAdmin ? '<span style="color:var(--orange);font-size:0.8rem" title="Admin">👑</span>' : ''}<span style="color:var(--text3);font-size:0.7rem">▼</span>`;
  badge.onclick = () => {
    if (confirm(`Switch user? You are currently "${name}"`)) {
      deleteCookie('hb_user');
      setCurrentUser(null, false);
      showUserPicker();
    }
  };
};

const updateMasterBanner = () => {
  const banner = document.getElementById('master-banner');
  // Only show the banner for PIN-based master, not for named admins
  const isNamedAdmin = state.isMaster && state.currentUser?.id !== 'master';
  banner.classList.toggle('hidden', !state.isMaster || isNamedAdmin);
};

document.getElementById('exit-master-btn').addEventListener('click', () => {
  deleteCookie('hb_user');
  setCurrentUser(null, false);
  showUserPicker();
});

// ── MASTER PIN MODAL ──────────────────────────────────────────────────
document.getElementById('master-login-btn').addEventListener('click', () => {
  document.getElementById('master-pin-input').value = '';
  document.getElementById('master-pin-error').style.display = 'none';
  document.getElementById('user-picker-overlay').classList.add('hidden');
  document.getElementById('master-pin-modal').classList.remove('hidden');
});
document.getElementById('cancel-master-pin').addEventListener('click', () => {
  document.getElementById('master-pin-modal').classList.add('hidden');
  document.getElementById('user-picker-overlay').classList.remove('hidden');
});
document.getElementById('confirm-master-pin').addEventListener('click', () => {
  const entered = document.getElementById('master-pin-input').value;
  const correct = state.settings.masterPin || '1234';
  if (entered === correct) {
    document.getElementById('master-pin-modal').classList.add('hidden');
    setCurrentUser({ id: 'master', name: 'Master' }, true);
    renderHome();
  } else {
    document.getElementById('master-pin-error').style.display = 'block';
    document.getElementById('master-pin-input').value = '';
  }
});
document.getElementById('master-pin-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('confirm-master-pin').click();
});

// ── TABS ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('page-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'home') renderHome();
    if (tab.dataset.tab === 'cooking') renderCooking();
    if (tab.dataset.tab === 'reviews') renderReviews();
    if (tab.dataset.tab === 'cleaning') renderCleaning();
    if (tab.dataset.tab === 'settings') renderSettings();
  });
});

// ── SETUP ─────────────────────────────────────────────────────────────
const initSetup = () => {
  const addBtn = document.getElementById('add-name-btn');
  addBtn.addEventListener('click', () => {
    const container = document.getElementById('name-inputs');
    const count = container.querySelectorAll('.name-row').length + 1;
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `<input type="text" placeholder="Roommate ${count}" class="roommate-name-input" /><button class="btn-remove-name">✕</button>`;
    container.appendChild(row);
    container.querySelectorAll('.btn-remove-name').forEach(b => b.classList.remove('hidden'));
    row.querySelector('.btn-remove-name').addEventListener('click', () => row.remove());
    row.querySelector('input').focus();
  });

  document.getElementById('setup-submit-btn').addEventListener('click', async () => {
    const names = [...document.querySelectorAll('.roommate-name-input')]
      .map(i => i.value.trim()).filter(Boolean);
    if (!names.length) return toast('Enter at least one name!', 'error');
    await api('/api/roommates', 'POST', { names });
    await loadAll();
    document.getElementById('setup-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    showUserPicker();
    renderHome();
  });
};

// ── LOAD DATA ─────────────────────────────────────────────────────────
const loadAll = async () => {
  [state.roommates, state.cookingSchedule, state.cleaningSchedule, state.cleaningTasks, state.reviews, state.settings] = await Promise.all([
    api('/api/roommates'),
    api('/api/cooking/schedule'),
    api('/api/cleaning/schedule'),
    api('/api/cleaning/tasks'),
    api('/api/reviews'),
    api('/api/settings'),
  ]);
};

// ── HOME PAGE ─────────────────────────────────────────────────────────
const renderHome = async () => {
  await loadAll();
  const aptName = document.getElementById('home-apartment-name');
  aptName.textContent = state.settings.apartmentName || 'Our Place';

  // Weather
  const weatherLoc = state.settings.weatherLocation;
  if (weatherLoc) {
    try {
      const coords = await geocodeLocation(weatherLoc);
      if (coords) {
        const w = await api(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`);
        renderWeather(w);
      }
    } catch (e) {}
  }

  // Tonight's dinner
  renderHomeDinner();
  // Ratings
  renderHomeRatings();
  // Events
  renderHomeEvents();
};

const geocodeLocation = async (loc) => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`);
    const d = await r.json();
    if (d[0]) return { lat: d[0].lat, lon: d[0].lon };
  } catch {}
  return null;
};

const WEATHER_CODES = {
  0: ['☀️','Clear'],1:['🌤','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],
  45:['🌫','Foggy'],48:['🌫','Foggy'],51:['🌦','Light drizzle'],53:['🌦','Drizzle'],
  55:['🌦','Heavy drizzle'],61:['🌧','Light rain'],63:['🌧','Rain'],65:['🌧','Heavy rain'],
  71:['❄️','Light snow'],73:['❄️','Snow'],75:['❄️','Heavy snow'],80:['🌦','Showers'],
  81:['🌧','Heavy showers'],95:['⛈','Thunderstorm'],
};

const renderWeather = (data) => {
  const el = document.getElementById('home-weather');
  if (!data?.current_weather) return;
  const code = data.current_weather.weathercode;
  const [icon, desc] = WEATHER_CODES[code] || ['🌡️','Unknown'];
  el.innerHTML = `
    <div class="weather-icon">${icon}</div>
    <div class="weather-temp">${Math.round(data.current_weather.temperature)}°F</div>
    <div class="weather-desc">${desc}</div>
  `;
};

const renderHomeDinner = () => {
  const el = document.getElementById('home-dinner-content');
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];
  const weekStart = getWeekStart(today);
  const week = state.cookingSchedule.weeks?.[weekStart];

  if (!week || !week.days[dayName]) {
    el.innerHTML = '<div class="no-data">No cook scheduled today</div>';
    return;
  }

  const cook = state.roommates.find(r => r.id === week.days[dayName]);
  const recipe = week.recipes?.[dayName];

  let html = `<div class="dinner-cook">`;
  if (cook?.photo) {
    html += `<img class="dinner-cook-avatar" src="${cook.photo}" alt="${cook.name}">`;
  } else {
    html += `<div class="dinner-cook-avatar" style="background:${getRoommateColor(cook?.id)}">${getInitials(cook?.name)}</div>`;
  }
  html += `<div><div class="dinner-cook-name">${cook?.name || 'Unknown'}</div><div class="dinner-cook-sub">Chef tonight</div></div></div>`;

  if (recipe) {
    html += `<div class="dinner-recipe">`;
    if (recipe.image) html += `<img class="dinner-recipe-img" src="${recipe.image}" alt="">`;
    html += `<div>`;
    html += `<div class="dinner-recipe-name">${recipe.name}</div>`;
    if (recipe.link) html += `<a class="dinner-recipe-link" href="${recipe.link}" target="_blank">View Recipe →</a>`;
    html += `</div></div>`;
  }

  el.innerHTML = html;
};

const renderHomeRatings = async () => {
  const avgs = await api('/api/reviews/averages');
  const el = document.getElementById('home-ratings');
  const sorted = [...state.roommates].sort((a, b) => (avgs[b.id] || 0) - (avgs[a.id] || 0));
  if (!sorted.length) { el.innerHTML = '<div class="no-data">No roommates yet</div>'; return; }

  el.innerHTML = sorted.map(r => {
    const score = avgs[r.id];
    let stars = score ? starsHTML(score) : '—';
    return `<div class="rating-row">
      ${r.photo ? `<div class="rating-avatar"><img src="${r.photo}" alt="${r.name}"></div>` : `<div class="rating-avatar" style="background:${getRoommateColor(r.id)}">${getInitials(r.name)}</div>`}
      <div class="rating-name">${r.name}</div>
      <div class="rating-stars">${score ? stars : ''}</div>
      <div class="rating-score" style="color:${scoreColor(score)}">${score || '—'}</div>
    </div>`;
  }).join('');
};

const scoreColor = (s) => !s ? 'var(--text3)' : s >= 4.5 ? 'var(--green)' : s >= 3 ? 'var(--orange)' : 'var(--red)';

const renderHomeEvents = async () => {
  const el = document.getElementById('home-events');
  const events = await api('/api/calendar/events');
  if (!events.length) { el.innerHTML = '<div class="no-data">No upcoming events</div>'; return; }
  el.innerHTML = events.slice(0,5).map(ev => {
    const d = new Date(ev.start);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<div class="event-row"><div class="event-date">${dateStr}</div><div class="event-name">${ev.summary}</div></div>`;
  }).join('');
};

// ── COOKING PAGE ──────────────────────────────────────────────────────
const renderCooking = () => {
  if (!state.currentCookingWeek) state.currentCookingWeek = getWeekStart();
  renderCookingWeek();
  renderDietaryGrid();
};

const renderCookingWeek = () => {
  const ws = state.currentCookingWeek;
  const weekDate = new Date(ws + 'T12:00:00');
  const endDate = new Date(weekDate);
  endDate.setDate(endDate.getDate() + 6);
  document.getElementById('cooking-week-label').textContent =
    `${weekDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${endDate.toLocaleDateString('en-US',{month:'short',day:'numeric', year:'numeric'})}`;

  const cal = document.getElementById('cooking-calendar');
  const week = state.cookingSchedule.weeks?.[ws];
  const today = new Date(); today.setHours(0,0,0,0);

  cal.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekDate);
    dayDate.setDate(dayDate.getDate() + i);
    const dayName = DAY_NAMES[i];
    const isToday = dayDate.getTime() === today.getTime();
    const cookId = week?.days?.[dayName];
    const cook = cookId ? state.roommates.find(r => r.id === cookId) : null;
    const recipe = week?.recipes?.[dayName];

    const card = document.createElement('div');
    card.className = `cal-day${cook ? ' has-cook' : ''}${isToday ? ' today' : ''}`;

    let cookHTML = '';
    if (cook) {
      const avatarColor = getRoommateColor(cook.id);
      const avatarInner = cook.photo ? `<img src="${cook.photo}" alt="${cook.name}">` : getInitials(cook.name);
      const avatarStyle = cook.photo ? '' : `style="background:${avatarColor}"`;
      // Permission: master can do anything; assigned cook can add recipe; only master can swap
      const canSwap = state.isMaster;
      const canRecipe = state.isMaster || state.currentUser?.id === cookId;
      cookHTML = `
        <div class="cal-day-cook">
          <div class="cal-day-avatar" ${avatarStyle}>${avatarInner}</div>
          <div class="cal-day-cook-name">${cook.name}</div>
          ${recipe ? `<div class="cal-day-recipe">${recipe.name}${recipe.link ? ` <a href="${recipe.link}" target="_blank">↗</a>` : ''}${recipe.image ? `<img src="${recipe.image}" alt="">` : ''}</div>` : ''}
        </div>
        <div class="cal-day-actions">
          ${canSwap ? `<button class="cal-action-btn override-btn" data-day="${dayName}">🔄 Swap</button>` : ''}
          ${canRecipe ? `<button class="cal-action-btn recipe-btn" data-day="${dayName}" data-week="${ws}">🍽️ Recipe</button>` : ''}
        </div>`;
    } else {
      cookHTML = `<div class="no-cook-placeholder">No cook</div>`;
    }

    card.innerHTML = `
      <div class="cal-day-name">${dayName}</div>
      <div class="cal-day-date">${dayDate.getDate()}</div>
      ${cookHTML}`;
    cal.appendChild(card);
  }

  // Override buttons
  cal.querySelectorAll('.override-btn').forEach(btn => {
    btn.addEventListener('click', () => openOverrideModal(btn.dataset.day));
  });
  cal.querySelectorAll('.recipe-btn').forEach(btn => {
    btn.addEventListener('click', () => openRecipeModal(btn.dataset.day, btn.dataset.week));
  });
};

const renderDietaryGrid = () => {
  const grid = document.getElementById('dietary-grid');
  grid.innerHTML = state.roommates.map(r => {
    const likeTags = r.likes?.length ? r.likes.map(l => `<span class="dietary-tag like">${l}</span>`).join('') : '<span class="dietary-empty">None listed</span>';
    const dislikeTags = r.dislikes?.length ? r.dislikes.map(d => `<span class="dietary-tag dislike">${d}</span>`).join('') : '<span class="dietary-empty">None listed</span>';
    const avatarInner = r.photo ? `<img src="${r.photo}" alt="${r.name}">` : getInitials(r.name);
    const avatarStyle = r.photo ? '' : `style="background:${getRoommateColor(r.id)}"`;
    return `<div class="dietary-card">
      <div class="dietary-card-header">
        <div class="dietary-avatar" ${avatarStyle}>${avatarInner}</div>
        <div class="dietary-name">${r.name}</div>
      </div>
      <div class="dietary-section"><div class="dietary-label">✓ Likes</div><div class="dietary-tags">${likeTags}</div></div>
      <div class="dietary-section"><div class="dietary-label">✗ Dislikes / Allergies</div><div class="dietary-tags">${dislikeTags}</div></div>
    </div>`;
  }).join('');
};

// Generate cooking modal — master only
document.getElementById('generate-cooking-btn').addEventListener('click', () => {
  if (!state.isMaster) return toast('Only Master can generate the schedule', 'error');
  document.getElementById('generate-cooking-modal').classList.remove('hidden');
});
document.getElementById('cancel-generate-cooking').addEventListener('click', () => {
  document.getElementById('generate-cooking-modal').classList.add('hidden');
});
document.getElementById('confirm-generate-cooking').addEventListener('click', async () => {
  const days = [...document.querySelectorAll('.day-checkboxes input:checked')].map(c => c.value);
  if (!days.length) return toast('Select at least one day!', 'error');
  const weekStart = state.currentCookingWeek || getWeekStart();
  const result = await api('/api/cooking/generate', 'POST', { weekStart, days });
  state.cookingSchedule.weeks[weekStart] = result;
  document.getElementById('generate-cooking-modal').classList.add('hidden');
  renderCookingWeek();
  toast('Schedule generated!', 'success');
});

// Week navigation
document.getElementById('cooking-prev-week').addEventListener('click', () => {
  const d = new Date(state.currentCookingWeek + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  state.currentCookingWeek = d.toISOString().split('T')[0];
  renderCookingWeek();
});
document.getElementById('cooking-next-week').addEventListener('click', () => {
  const d = new Date(state.currentCookingWeek + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  state.currentCookingWeek = d.toISOString().split('T')[0];
  renderCookingWeek();
});

// Override modal
const openOverrideModal = (day) => {
  state.overrideDay = day;
  document.getElementById('override-day-label').textContent = `Change cook for ${day}:`;
  const sel = document.getElementById('override-select');
  sel.innerHTML = state.roommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  // Preselect current
  const ws = state.currentCookingWeek;
  const current = state.cookingSchedule.weeks?.[ws]?.days?.[day];
  if (current) sel.value = current;
  document.getElementById('override-modal').classList.remove('hidden');
};
document.getElementById('cancel-override').addEventListener('click', () => document.getElementById('override-modal').classList.add('hidden'));
document.getElementById('confirm-override').addEventListener('click', async () => {
  const roommateId = document.getElementById('override-select').value;
  const ws = state.currentCookingWeek;
  await api('/api/cooking/override', 'PUT', { weekStart: ws, day: state.overrideDay, roommateId });
  if (!state.cookingSchedule.weeks[ws]) state.cookingSchedule.weeks[ws] = { days: {}, recipes: {} };
  state.cookingSchedule.weeks[ws].days[state.overrideDay] = roommateId;
  document.getElementById('override-modal').classList.add('hidden');
  renderCookingWeek();
  toast('Cook updated!', 'success');
});

// Recipe modal
const openRecipeModal = (day, week) => {
  state.recipeDay = day; state.recipeWeek = week;
  const existing = state.cookingSchedule.weeks?.[week]?.recipes?.[day];
  document.getElementById('recipe-name-input').value = existing?.name || '';
  document.getElementById('recipe-link-input').value = existing?.link || '';
  document.getElementById('recipe-modal').classList.remove('hidden');
};
document.getElementById('cancel-recipe').addEventListener('click', () => document.getElementById('recipe-modal').classList.add('hidden'));
document.getElementById('save-recipe').addEventListener('click', async () => {
  const recipeName = document.getElementById('recipe-name-input').value.trim();
  const recipeLink = document.getElementById('recipe-link-input').value.trim();
  if (!recipeName) return toast('Enter a recipe name!', 'error');
  let recipeImage = null;
  if (recipeLink) {
    try {
      const r = await api('/api/cooking/fetch-recipe-image', 'POST', { url: recipeLink });
      recipeImage = r.image;
    } catch {}
  }
  await api('/api/cooking/recipe', 'PUT', { weekStart: state.recipeWeek, day: state.recipeDay, recipeName, recipeLink, recipeImage });
  if (!state.cookingSchedule.weeks[state.recipeWeek]) state.cookingSchedule.weeks[state.recipeWeek] = { days: {}, recipes: {} };
  if (!state.cookingSchedule.weeks[state.recipeWeek].recipes) state.cookingSchedule.weeks[state.recipeWeek].recipes = {};
  state.cookingSchedule.weeks[state.recipeWeek].recipes[state.recipeDay] = { name: recipeName, link: recipeLink, image: recipeImage };
  document.getElementById('recipe-modal').classList.add('hidden');
  renderCookingWeek();
  toast('Recipe saved!', 'success');
});

// ── REVIEWS PAGE ──────────────────────────────────────────────────────
const renderReviews = async () => {
  const avgs = await api('/api/reviews/averages');
  // Leaderboard
  const lb = document.getElementById('reviews-leaderboard');
  const sorted = [...state.roommates].sort((a, b) => (avgs[b.id] || 0) - (avgs[a.id] || 0));
  const rankClasses = ['top1','top2','top3'];
  lb.innerHTML = `<div class="leaderboard-title">🏆 Chef Rankings</div>` + sorted.map((r, i) => {
    const score = avgs[r.id];
    const scoreClass = score ? (score >= 4.5 ? 'great' : score >= 3 ? 'good' : 'ok') : '';
    const myReviews = state.reviews.filter(rv => rv.cookId === r.id);
    const avatarInner = r.photo ? `<img src="${r.photo}" alt="${r.name}">` : getInitials(r.name);
    const avatarStyle = r.photo ? '' : `style="background:${getRoommateColor(r.id)}"`;
    return `<div class="lb-row">
      <div class="lb-rank ${rankClasses[i] || ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
      <div class="lb-avatar" ${avatarStyle}>${avatarInner}</div>
      <div class="lb-info">
        <div class="lb-name">${r.name}</div>
        <div class="lb-stats">${myReviews.length} review${myReviews.length !== 1 ? 's' : ''} ${score ? '· ' + starsHTML(score) : ''}</div>
      </div>
      <div class="lb-score ${scoreClass}">${score || '—'}</div>
    </div>`;
  }).join('');

  // Feed
  const feed = document.getElementById('reviews-feed');
  const sorted2 = [...state.reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!sorted2.length) {
    feed.innerHTML = '<div class="no-data" style="padding:32px">No reviews yet. Be the first to review a meal!</div>';
    return;
  }
  feed.innerHTML = sorted2.map(rv => {
    const cook = state.roommates.find(r => r.id === rv.cookId);
    const reviewer = state.roommates.find(r => r.id === rv.reviewerId);
    const d = new Date(rv.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const avatarInner = reviewer?.photo ? `<img src="${reviewer.photo}" alt="">` : getInitials(reviewer?.name || '?');
    const avatarStyle = reviewer?.photo ? '' : `style="background:${getRoommateColor(reviewer?.id)}"`;
    // Can delete if master, or if this is your own review
    const canDelete = state.isMaster || state.currentUser?.id === rv.reviewerId;
    const deleteBtn = canDelete ? `<button class="review-delete-btn" data-id="${rv.id}" title="Delete review">✕</button>` : '';
    return `<div class="review-card" data-id="${rv.id}">
      <div class="review-header">
        <div class="review-avatar" ${avatarStyle}>${avatarInner}</div>
        <div class="review-meta">
          <div class="review-reviewer">${reviewer?.name || 'Unknown'}</div>
          <div class="review-info">reviewed ${cook?.name || 'Unknown'}'s cooking · ${d}</div>
        </div>
        <div class="review-stars">${starsHTML(rv.rating)}</div>
        ${deleteBtn}
      </div>
      ${rv.mealName ? `<div class="review-meal">🍽️ ${rv.mealName}</div>` : ''}
      ${rv.comment ? `<div class="review-comment">${rv.comment}</div>` : ''}
    </div>`;
  }).join('');

  // Bind delete buttons
  feed.querySelectorAll('.review-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this review?')) return;
      state.reviews = await api(`/api/reviews/${btn.dataset.id}`, 'DELETE');
      renderReviews();
      toast('Review deleted', 'info');
    });
  });
};

// Review modal
document.getElementById('add-review-btn').addEventListener('click', () => {
  state.reviewRating = 0;
  const rs = document.getElementById('reviewer-select');
  const cs = document.getElementById('cook-select');
  rs.innerHTML = state.roommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  cs.innerHTML = state.roommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  // Pre-select current user as reviewer
  if (state.currentUser && state.currentUser.id !== 'master') {
    rs.value = state.currentUser.id;
    // Pre-select today's cook if known
    const today = new Date();
    const dayName = DAY_NAMES[today.getDay()];
    const ws = getWeekStart(today);
    const todayCookId = state.cookingSchedule.weeks?.[ws]?.days?.[dayName];
    if (todayCookId && todayCookId !== state.currentUser.id) cs.value = todayCookId;
  }
  document.getElementById('review-meal-input').value = '';
  document.getElementById('review-comment').value = '';
  document.querySelectorAll('#star-rating span').forEach(s => s.classList.remove('active'));
  document.getElementById('review-modal').classList.remove('hidden');
});
document.getElementById('cancel-review').addEventListener('click', () => document.getElementById('review-modal').classList.add('hidden'));

// Star rating
document.querySelectorAll('#star-rating span').forEach(star => {
  star.addEventListener('click', () => {
    state.reviewRating = parseInt(star.dataset.v);
    document.querySelectorAll('#star-rating span').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.v) <= state.reviewRating);
    });
  });
  star.addEventListener('mouseenter', () => {
    document.querySelectorAll('#star-rating span').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.v) <= parseInt(star.dataset.v));
    });
  });
  star.addEventListener('mouseleave', () => {
    document.querySelectorAll('#star-rating span').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.v) <= state.reviewRating);
    });
  });
});

document.getElementById('submit-review').addEventListener('click', async () => {
  if (!state.reviewRating) return toast('Please select a rating!', 'error');
  const cookId = document.getElementById('cook-select').value;
  const reviewerId = document.getElementById('reviewer-select').value;
  if (cookId === reviewerId) return toast("You can't review your own cooking!", 'error');
  const mealName = document.getElementById('review-meal-input').value.trim();
  const comment = document.getElementById('review-comment').value.trim();
  const date = new Date().toISOString().split('T')[0];
  state.reviews = await api('/api/reviews', 'POST', { cookId, reviewerId, rating: state.reviewRating, comment, date, mealName });
  document.getElementById('review-modal').classList.add('hidden');
  renderReviews();
  toast('Review submitted!', 'success');
});

// ── CLEANING PAGE ─────────────────────────────────────────────────────
const renderCleaning = () => {
  if (!state.currentCleaningWeek) state.currentCleaningWeek = getWeekStart();
  renderCleaningWeek();
};

const renderCleaningWeek = () => {
  const ws = state.currentCleaningWeek;
  const weekDate = new Date(ws + 'T12:00:00');
  const endDate = new Date(weekDate); endDate.setDate(endDate.getDate() + 6);
  document.getElementById('cleaning-week-label').textContent =
    `${weekDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${endDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;

  const board = document.getElementById('cleaning-board');
  const week = state.cleaningSchedule.weeks?.[ws];

  if (!week) {
    board.innerHTML = `<div class="no-schedule">No cleaning schedule for this week.<br>Add tasks and hit "Generate This Week".</div>`;
    return;
  }

  if (!state.cleaningTasks.length) {
    board.innerHTML = `<div class="no-schedule">No tasks defined yet. Click "+ Add Task" to add some!</div>`;
    return;
  }

  board.innerHTML = state.cleaningTasks.map(task => {
    const assigneeId = week.assignments?.[task.id];
    const assignee = state.roommates.find(r => r.id === assigneeId);
    const done = !!week.completed?.[task.id];
    const avatarInner = assignee?.photo ? `<img src="${assignee.photo}" alt="">` : getInitials(assignee?.name || '?');
    const avatarStyle = assignee?.photo ? '' : `style="background:${getRoommateColor(assigneeId)}"`;
    const canCheck = state.isMaster || state.currentUser?.id === assigneeId;
    const canManage = state.isMaster;
    return `<div class="task-card${done ? ' completed' : ''}">
      <div class="task-header">
        <div class="task-name">${task.name}</div>
        <div class="task-check${done ? ' done' : ''}${canCheck ? '' : ' locked'}" data-task="${task.id}">${done ? '✓' : canCheck ? '' : '🔒'}</div>
      </div>
      <div class="task-assignee">
        <div class="task-av" ${avatarStyle}>${avatarInner}</div>
        <div class="task-av-name">${assignee?.name || 'Unassigned'}</div>
      </div>
      ${canManage ? `<div class="task-actions">
        <button class="task-btn clean-reassign-btn" data-task="${task.id}">🔄 Reassign</button>
        <button class="task-btn danger clean-delete-btn" data-task="${task.id}">✕</button>
      </div>` : ''}
    </div>`;
  }).join('');

  board.querySelectorAll('.task-check').forEach(el => {
    if (el.classList.contains('locked')) return; // non-assignee can't check
    el.addEventListener('click', async () => {
      const taskId = el.dataset.task;
      const done = !el.classList.contains('done');
      await api('/api/cleaning/complete', 'PUT', { weekStart: ws, taskId, done });
      if (!state.cleaningSchedule.weeks[ws].completed) state.cleaningSchedule.weeks[ws].completed = {};
      state.cleaningSchedule.weeks[ws].completed[taskId] = done;
      renderCleaningWeek();
    });
  });

  board.querySelectorAll('.clean-reassign-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.overrideTaskId = btn.dataset.task;
      const task = state.cleaningTasks.find(t => t.id === btn.dataset.task);
      document.getElementById('clean-override-task-label').textContent = `Reassign: ${task?.name}`;
      const sel = document.getElementById('clean-override-select');
      sel.innerHTML = state.roommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      const current = week.assignments?.[btn.dataset.task];
      if (current) sel.value = current;
      document.getElementById('clean-override-modal').classList.remove('hidden');
    });
  });

  board.querySelectorAll('.clean-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.cleaningTasks = await api(`/api/cleaning/tasks/${btn.dataset.task}`, 'DELETE');
      renderCleaningWeek();
    });
  });
};

document.getElementById('cleaning-prev-week').addEventListener('click', () => {
  const d = new Date(state.currentCleaningWeek + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  state.currentCleaningWeek = d.toISOString().split('T')[0];
  renderCleaningWeek();
});
document.getElementById('cleaning-next-week').addEventListener('click', () => {
  const d = new Date(state.currentCleaningWeek + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  state.currentCleaningWeek = d.toISOString().split('T')[0];
  renderCleaningWeek();
});

document.getElementById('add-task-btn').addEventListener('click', () => {
  if (!state.isMaster) return toast('Only Master can add tasks', 'error');
  document.getElementById('new-task-input').value = '';
  document.getElementById('add-task-modal').classList.remove('hidden');
});
document.getElementById('cancel-add-task').addEventListener('click', () => document.getElementById('add-task-modal').classList.add('hidden'));
document.getElementById('confirm-add-task').addEventListener('click', async () => {
  const name = document.getElementById('new-task-input').value.trim();
  if (!name) return toast('Enter a task name!', 'error');
  state.cleaningTasks = await api('/api/cleaning/tasks', 'POST', { name });
  document.getElementById('add-task-modal').classList.add('hidden');
  renderCleaningWeek();
  toast('Task added!', 'success');
});

document.getElementById('generate-cleaning-btn').addEventListener('click', async () => {
  if (!state.isMaster) return toast('Only Master can generate the schedule', 'error');
  if (!state.cleaningTasks.length) return toast('Add some tasks first!', 'error');
  const result = await api('/api/cleaning/generate', 'POST', { weekStart: state.currentCleaningWeek });
  if (!state.cleaningSchedule.weeks) state.cleaningSchedule.weeks = {};
  state.cleaningSchedule.weeks[state.currentCleaningWeek] = result;
  renderCleaningWeek();
  toast('Cleaning schedule generated!', 'success');
});

document.getElementById('cancel-clean-override').addEventListener('click', () => document.getElementById('clean-override-modal').classList.add('hidden'));
document.getElementById('confirm-clean-override').addEventListener('click', async () => {
  const roommateId = document.getElementById('clean-override-select').value;
  const ws = state.currentCleaningWeek;
  await api('/api/cleaning/override', 'PUT', { weekStart: ws, taskId: state.overrideTaskId, roommateId });
  state.cleaningSchedule.weeks[ws].assignments[state.overrideTaskId] = roommateId;
  document.getElementById('clean-override-modal').classList.add('hidden');
  renderCleaningWeek();
  toast('Reassigned!', 'success');
});

// ── SETTINGS PAGE ─────────────────────────────────────────────────────
const renderSettings = () => {
  document.getElementById('setting-apt-name').value = state.settings.apartmentName || '';
  document.getElementById('setting-weather-loc').value = state.settings.weatherLocation || '';
  document.getElementById('ics-url-input').value = state.settings.calendarUrl || '';
  // Show PIN masked
  const pin = state.settings.masterPin || '1234';
  document.getElementById('pin-display').textContent = '•'.repeat(pin.length) + `  (${pin.length} digits)`;
  renderSettingsRoommates();
};

const renderSettingsRoommates = () => {
  const list = document.getElementById('settings-roommates-list');
  list.innerHTML = state.roommates.map(r => {
    const avatarInner = r.photo ? `<img src="${r.photo}" alt="${r.name}">` : getInitials(r.name);
    const avatarStyle = r.photo ? '' : `style="background:${getRoommateColor(r.id)}"`;
    const canEdit = state.isMaster || state.currentUser?.id === r.id;
    const canDelete = state.isMaster;
    const isYou = state.currentUser?.id === r.id;
    const adminToggle = state.isMaster
      ? `<button class="btn-ghost sm toggle-admin-btn" data-id="${r.id}" data-admin="${r.isAdmin ? 'true' : 'false'}"
           style="${r.isAdmin ? 'border-color:var(--orange);color:var(--orange)' : ''}"
           title="${r.isAdmin ? 'Remove admin' : 'Make admin'}">
           ${r.isAdmin ? '👑 Admin' : '👑'}
         </button>`
      : '';
    return `<div class="settings-roommate-row">
      <div class="sr-avatar" ${avatarStyle}>${avatarInner}</div>
      <div class="sr-name">${r.name}${isYou ? ' <span style="color:var(--accent);font-size:0.75rem">(you)</span>' : ''}${r.isAdmin ? ' <span style="color:var(--orange);font-size:0.75rem">👑</span>' : ''}</div>
      <div class="sr-actions">
        ${adminToggle}
        ${canEdit ? `<button class="btn-ghost sm edit-roommate-btn" data-id="${r.id}">Edit</button>` : ''}
        ${canDelete ? `<button class="btn-ghost sm danger delete-roommate-btn" data-id="${r.id}" style="border-color:var(--red);color:var(--red)">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.toggle-admin-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isAdmin = btn.dataset.admin === 'true';
      const r = state.roommates.find(rm => rm.id === btn.dataset.id);
      const form = new FormData();
      form.append('isAdmin', (!isAdmin).toString());
      const updated = await api(`/api/roommates/${btn.dataset.id}`, 'PUT', form);
      const idx = state.roommates.findIndex(rm => rm.id === btn.dataset.id);
      if (idx !== -1) state.roommates[idx] = updated;
      renderSettingsRoommates();
      toast(`${r.name} is ${!isAdmin ? 'now an admin 👑' : 'no longer an admin'}`, 'info');
    });
  });
  list.querySelectorAll('.edit-roommate-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditRoommateModal(btn.dataset.id));
  });
  list.querySelectorAll('.delete-roommate-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this roommate?')) return;
      state.roommates = await api(`/api/roommates/${btn.dataset.id}`, 'DELETE').then(() => api('/api/roommates'));
      renderSettingsRoommates();
      toast('Roommate removed', 'info');
    });
  });
};

document.getElementById('save-general-settings').addEventListener('click', async () => {
  if (!state.isMaster) return toast('Only Master can change settings', 'error');
  const s = await api('/api/settings', 'PUT', {
    apartmentName: document.getElementById('setting-apt-name').value,
    weatherLocation: document.getElementById('setting-weather-loc').value,
  });
  state.settings = s;
  toast('Settings saved!', 'success');
});

document.getElementById('save-pin-btn').addEventListener('click', async () => {
  if (!state.isMaster) return toast('Only Master can change the PIN', 'error');
  const newPin = document.getElementById('new-pin-input').value.trim();
  if (!newPin || newPin.length < 4) return toast('PIN must be at least 4 characters', 'error');
  const s = await api('/api/settings', 'PUT', { masterPin: newPin });
  state.settings = s;
  document.getElementById('new-pin-input').value = '';
  renderSettings();
  toast('PIN updated!', 'success');
});

document.getElementById('detect-location-btn').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Geolocation not supported', 'error');
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
      const d = await r.json();
      const loc = d.address?.city || d.address?.town || d.address?.village || '';
      const state2 = d.address?.state || '';
      document.getElementById('setting-weather-loc').value = loc + (state2 ? `, ${state2}` : '');
      toast('Location detected!', 'success');
    } catch { toast('Could not detect location', 'error'); }
  }, () => toast('Location denied', 'error'));
});

// Add roommate
document.getElementById('add-roommate-btn').addEventListener('click', () => {
  if (!state.isMaster) return toast('Only Master can add roommates', 'error');
  document.getElementById('new-roommate-name').value = '';
  document.getElementById('add-roommate-modal').classList.remove('hidden');
});
document.getElementById('cancel-add-roommate').addEventListener('click', () => document.getElementById('add-roommate-modal').classList.add('hidden'));
document.getElementById('confirm-add-roommate').addEventListener('click', async () => {
  const name = document.getElementById('new-roommate-name').value.trim();
  if (!name) return toast('Enter a name!', 'error');
  state.roommates = await api('/api/roommates', 'POST', { names: [name] });
  document.getElementById('add-roommate-modal').classList.add('hidden');
  renderSettingsRoommates();
  toast(`${name} added!`, 'success');
});

// Edit roommate modal
let editLikes = [], editDislikes = [];
const openEditRoommateModal = (id) => {
  const r = state.roommates.find(rm => rm.id === id);
  if (!r) return;
  document.getElementById('edit-roommate-id').value = id;
  document.getElementById('edit-roommate-name-input').value = r.name;
  editLikes = [...(r.likes || [])];
  editDislikes = [...(r.dislikes || [])];
  const photoPreview = document.getElementById('edit-photo-preview');
  const photoPlaceholder = document.getElementById('edit-photo-placeholder');
  if (r.photo) { photoPreview.src = r.photo; photoPreview.style.display = 'block'; photoPlaceholder.style.display = 'none'; }
  else { photoPreview.style.display = 'none'; photoPlaceholder.style.display = 'block'; }
  renderTagEditor('edit-likes-list', editLikes, 'like');
  renderTagEditor('edit-dislikes-list', editDislikes, 'dislike');
  document.getElementById('edit-roommate-modal').classList.remove('hidden');
};

const renderTagEditor = (containerId, tags, type) => {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="tag-editor">${tags.map((t, i) => `<span class="editable-tag"><span>${t}</span><span class="del-tag" data-i="${i}" data-type="${type}">×</span></span>`).join('')}</div>`;
  container.querySelectorAll('.del-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.type === 'like') { editLikes.splice(parseInt(btn.dataset.i), 1); renderTagEditor('edit-likes-list', editLikes, 'like'); }
      else { editDislikes.splice(parseInt(btn.dataset.i), 1); renderTagEditor('edit-dislikes-list', editDislikes, 'dislike'); }
    });
  });
};

document.getElementById('add-like-btn').addEventListener('click', () => {
  const val = prompt('Add a food you like:');
  if (val?.trim()) { editLikes.push(val.trim()); renderTagEditor('edit-likes-list', editLikes, 'like'); }
});
document.getElementById('add-dislike-btn').addEventListener('click', () => {
  const val = prompt('Add a dislike or allergy:');
  if (val?.trim()) { editDislikes.push(val.trim()); renderTagEditor('edit-dislikes-list', editDislikes, 'dislike'); }
});

document.getElementById('edit-photo-area').addEventListener('click', () => document.getElementById('edit-photo-input').click());
document.getElementById('edit-photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById('edit-photo-preview');
    preview.src = ev.target.result;
    preview.style.display = 'block';
    document.getElementById('edit-photo-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

document.getElementById('cancel-edit-roommate').addEventListener('click', () => document.getElementById('edit-roommate-modal').classList.add('hidden'));
document.getElementById('confirm-edit-roommate').addEventListener('click', async () => {
  const id = document.getElementById('edit-roommate-id').value;
  const name = document.getElementById('edit-roommate-name-input').value.trim();
  if (!name) return toast('Enter a name!', 'error');
  const form = new FormData();
  form.append('name', name);
  form.append('likes', JSON.stringify(editLikes));
  form.append('dislikes', JSON.stringify(editDislikes));
  const photoFile = document.getElementById('edit-photo-input').files[0];
  if (photoFile) form.append('photo', photoFile);
  const updated = await api(`/api/roommates/${id}`, 'PUT', form);
  const idx = state.roommates.findIndex(r => r.id === id);
  if (idx !== -1) state.roommates[idx] = updated;
  document.getElementById('edit-roommate-modal').classList.add('hidden');
  renderSettingsRoommates();
  renderDietaryGrid();
  toast('Profile updated!', 'success');
});

// ICS Upload
document.getElementById('save-ics-url-btn').addEventListener('click', async () => {
  if (!state.isMaster) return toast('Only Master can change the calendar URL', 'error');
  const url = document.getElementById('ics-url-input').value.trim();
  if (!url) return toast('Enter a URL', 'error');
  await api('/api/calendar/url', 'PUT', { url });
  state.settings.calendarUrl = url;
  document.getElementById('ics-status').textContent = '✓ Calendar URL saved';
  document.getElementById('ics-status').style.color = 'var(--green)';
  toast('Calendar URL saved!', 'success');
});

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

// ── INIT ──────────────────────────────────────────────────────────────
const init = async () => {
  const status = await api('/api/setup-status');
  if (!status.setupComplete) {
    document.getElementById('setup-overlay').classList.remove('hidden');
    initSetup();
    return;
  }

  await loadAll();
  document.getElementById('app').classList.remove('hidden');

  // Restore session from cookie
  const savedId = getCookie('hb_user');
  if (savedId === 'master') {
    setCurrentUser({ id: 'master', name: 'Master' }, true);
    renderHome();
  } else if (savedId) {
    const r = state.roommates.find(rm => rm.id === savedId);
    if (r) {
      // If they're an admin, restore full master access
      setCurrentUser(r, r.isAdmin === true);
      renderHome();
    } else {
      // Cookie points to a deleted roommate — clear it and show picker
      deleteCookie('hb_user');
      showUserPicker();
      renderHome();
    }
  } else {
    showUserPicker();
    renderHome();
  }
};

init();
