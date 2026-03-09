# 🏠 HomeBase — College Room Manager

A sleek, full-featured room management app for your college dorm or apartment. Built with Node.js + vanilla JS.

## Features

- **🏠 Home Dashboard** — Live clock, weather, tonight's dinner, chef ratings, and imported calendar events
- **🍳 Cooking** — Weekly schedule with random assignment, manual overrides, recipe links with auto-fetched images, and per-roommate dietary notes (likes/dislikes/allergies)
- **⭐ Reviews** — Mini-Yelp for rating meals, chef leaderboard, written reviews
- **🧹 Cleaning** — Task-based weekly schedule with random assignment, overrides, and completion tracking
- **⚙️ Settings** — Roommate profiles with photos, weather location, .ics calendar import

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
open http://localhost:3000
```

## First Run

On first visit, you'll be prompted to enter all roommate names. You can add profile photos and dietary preferences in Settings.

## Running on a Tablet

The app is designed to run on a central tablet in your room. It works fine on any device — just navigate to the server's IP address:

```
http://<your-computer-ip>:3000
```

To find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

## Tech Stack

- **Backend:** Node.js + Express
- **Storage:** JSON files (no database needed)
- **Frontend:** Vanilla JS + CSS (no build step)
- **Fonts:** Syne + DM Sans
- **Weather:** Open-Meteo API (free, no key needed)
- **Geocoding:** Nominatim (free, no key needed)

## File Structure

```
homebase/
├── server.js          # Express API server
├── public/
│   ├── index.html     # Main app HTML
│   ├── css/style.css  # All styles
│   ├── js/app.js      # All client logic
│   └── uploads/       # Profile photos (auto-created)
└── data/              # JSON data storage (auto-created)
    ├── roommates.json
    ├── cooking_schedule.json
    ├── cleaning_schedule.json
    ├── cleaning_tasks.json
    ├── reviews.json
    ├── settings.json
    └── calendar.ics   # (after import)
```
