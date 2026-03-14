# Averom — Supplier Risk Intelligence
**averom.co · verify before you wire**

---

## Deploy in 10 minutes

### Step 1 — Get your Anthropic API key
Go to https://console.anthropic.com → API Keys → Create Key
Copy it. You'll need it in Step 3.

---

### Step 2 — Push to GitHub
```bash
git init
git add .
git commit -m "averom mvp launch"
git remote add origin https://github.com/YOUR_USERNAME/averom
git push -u origin main
```

---

### Step 3 — Deploy to Vercel
1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Click **Environment Variables** → Add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (your key from Step 1)
3. Click **Deploy**

Vercel auto-detects the `api/` folder and deploys it as serverless functions.

---

### Step 4 — Connect averom.co
1. In Vercel → your project → Settings → Domains
2. Add `averom.co` and `www.averom.co`
3. Update your domain's DNS to point to Vercel (they give you exact records)
4. SSL is automatic

Done. Your tool is live.

---

## File Structure
```
averom/
├── index.html          ← Frontend (the full UI)
├── api/
│   └── analyze.js      ← Serverless function (proxies Anthropic API)
├── vercel.json         ← Vercel config (60s timeout for AI analysis)
└── README.md
```

---

## Cost Estimate (per analysis)
- Claude Sonnet 4: ~$0.003 per report (input + output tokens)
- Web search calls: ~$0.01 per analysis (bundled in Anthropic API)
- **Total: ~$0.013 per report**

At $9.99/report → ~769x markup per transaction.

---

## Next upgrades (post-launch)
1. **PDF export** — add jsPDF, one button
2. **Stripe paywall** — charge per report or monthly subscription
3. **Report history** — store JSON in Vercel KV or Supabase
4. **White-label** — sell report access to consulting clients (your existing base)
