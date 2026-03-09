# 🏠 HomeBase — Vercel Deployment Guide

## Prerequisites
- A [Vercel](https://vercel.com) account
- Your code pushed to GitHub

---

## Step 1 — Add Vercel KV (database)

1. Go to your Vercel dashboard → **Storage** tab → **Create Database**
2. Choose **KV** → give it any name (e.g. `homebase-kv`) → **Create**
3. On the next screen, click **Connect to Project** and select your roomapp project
4. Vercel will automatically add the required environment variables to your project:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

---

## Step 2 — Add Vercel Blob (photo storage)

1. Still in **Storage** → **Create Database**
2. Choose **Blob** → name it (e.g. `homebase-blob`) → **Create**
3. Click **Connect to Project** → select your roomapp project
4. Vercel adds this env var automatically:
   - `BLOB_READ_WRITE_TOKEN`

---

## Step 3 — Deploy

Push to GitHub — Vercel will auto-deploy. Or run:

```bash
npx vercel --prod
```

That's it. No other configuration needed.

---

## Local development

To run locally with the real KV/Blob services, pull your env vars first:

```bash
npm install -g vercel
vercel link        # link to your project
vercel env pull    # downloads .env.local with all keys
npm install
npm start
```

---

## How data is stored

| Old (filesystem)        | New (Vercel)             |
|-------------------------|--------------------------|
| `data/roommates.json`   | Vercel KV key: `roommates` |
| `data/reviews.json`     | Vercel KV key: `reviews` |
| `data/settings.json`    | Vercel KV key: `settings` |
| `data/cooking_schedule.json` | Vercel KV key: `cooking_schedule` |
| `data/cleaning_schedule.json` | Vercel KV key: `cleaning_schedule` |
| `data/cleaning_tasks.json` | Vercel KV key: `cleaning_tasks` |
| `public/uploads/*.jpg`  | Vercel Blob (public CDN URL) |
