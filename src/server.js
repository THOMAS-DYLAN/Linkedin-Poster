require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;
const PENDING_FILE = path.join(__dirname, '../data/pending-week.json');

app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/dashboard.html'));
});

app.get('/api/pending', (req, res) => {
  const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
  if (!raw || raw === '{}') return res.json(null);
  res.json(JSON.parse(raw));
});

app.post('/api/approve', (req, res) => {
  const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
  if (!raw || raw === '{}') return res.status(400).json({ error: 'No pending week found.' });

  const pending = JSON.parse(raw);

  if (pending.status === 'approved') {
    return res.status(400).json({ error: 'This week is already approved.' });
  }

  if (req.body.posts && Array.isArray(req.body.posts)) {
    req.body.posts.forEach((edited, i) => {
      if (pending.posts[i] && edited.text) {
        pending.posts[i].text = edited.text;
      }
    });
  }

  pending.status = 'approved';
  pending.approvedAt = new Date().toISOString();
  pending.approvedVia = 'dashboard';

  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
  console.log(`Approved week of ${pending.weekOf} via dashboard.`);
  res.json({ success: true, weekOf: pending.weekOf });
});

app.listen(PORT, () => {
  console.log(`LinkedIn Bot dashboard running at http://localhost:${PORT}`);
});
