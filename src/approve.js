require('dotenv').config();
const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, '../data/pending-week.json');

const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
if (!raw || raw === '{}') {
  console.error('No pending week found. Run npm run generate first.');
  process.exit(1);
}

const pending = JSON.parse(raw);

if (pending.status === 'approved') {
  console.log(`Week of ${pending.weekOf} is already approved.`);
  process.exit(0);
}

pending.status = 'approved';
pending.approvedAt = new Date().toISOString();
pending.approvedVia = 'cli';

fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
console.log(`Week of ${pending.weekOf} approved. Run "npm run post <day>" on Monday, Wednesday, or Friday.`);
