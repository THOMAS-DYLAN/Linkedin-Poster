require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const { fetchPendingFromRepo } = require('./github-deploy');

const PENDING_FILE = path.join(__dirname, '../data/pending-week.json');

function loadPending() {
  const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
  if (!raw || raw === '{}') return null;
  return JSON.parse(raw);
}

function savePending(data) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

function connectImap() {
  return new Imap({
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: true }
  });
}

async function checkForApproval(pending) {
  const searchSubject = `Re: [LinkedIn Bot] Week of ${pending.weekOf}`;

  return new Promise((resolve, reject) => {
    const imap = connectImap();
    let found = false;
    let approvedText = null;

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN', ['SUBJECT', searchSubject]], (err, uids) => {
          if (err) { imap.end(); return reject(err); }

          if (!uids || uids.length === 0) {
            imap.end();
            return resolve(null);
          }

          const fetch = imap.fetch(uids, { bodies: '', markSeen: true });
          const mails = [];

          fetch.on('message', (msg) => {
            let buffer = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
              stream.once('end', () => mails.push(buffer));
            });
          });

          fetch.once('end', async () => {
            for (const rawEmail of mails) {
              const parsed = await simpleParser(rawEmail);
              const bodyText = (parsed.text || '').toLowerCase().trim();

              if (bodyText.startsWith('approved')) {
                found = true;
                approvedText = parsed.text.trim();
                break;
              }
            }
            imap.end();
            resolve(found ? approvedText : null);
          });

          fetch.once('error', (err) => { imap.end(); reject(err); });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

function parseChanges(approvedText, posts) {
  // Syntax: "approved with changes: monday: new text here"
  const lc = approvedText.toLowerCase();
  if (!lc.includes('with changes')) return posts;

  const updated = posts.map(p => ({ ...p }));
  const changesSection = approvedText.slice(approvedText.toLowerCase().indexOf('with changes:') + 13).trim();

  ['monday', 'wednesday', 'friday'].forEach((day, idx) => {
    const re = new RegExp(`${day}:\\s*(.+?)(?=monday:|wednesday:|friday:|$)`, 'is');
    const match = changesSection.match(re);
    if (match) {
      updated[idx].text = match[1].trim();
      console.log(`  Applied change to ${day} post.`);
    }
  });

  return updated;
}

async function main() {
  const pending = loadPending();

  if (!pending || !pending.weekOf) {
    console.log('No pending week found. Run npm run generate first.');
    return;
  }

  if (pending.status === 'approved') {
    console.log(`Week of ${pending.weekOf} is already approved.`);
    return;
  }

  console.log(`Checking approval for week of ${pending.weekOf}...`);

  // Check dashboard (GitHub repo) approval first — it captures any edits made in the browser
  try {
    const repoData = await fetchPendingFromRepo();
    if (repoData && repoData.weekOf === pending.weekOf && repoData.status === 'approved') {
      console.log('Approval found via dashboard.');
      savePending(repoData); // sync full repo version (includes any edits from the dashboard)
      console.log(`Status updated to "approved". Posts will go out Mon/Wed/Fri at 9 AM.`);
      return;
    }
  } catch (e) {
    console.log(`(GitHub check skipped: ${e.message})`);
  }

  // Fall back to email approval
  const approvedText = await checkForApproval(pending);

  if (!approvedText) {
    console.log('No approval reply found yet.');
    return;
  }

  console.log('Approval found via email.');
  pending.posts = parseChanges(approvedText, pending.posts);
  pending.status = 'approved';
  pending.approvedAt = new Date().toISOString();
  savePending(pending);

  console.log(`Status updated to "approved". Posts will go out Mon/Wed/Fri at 9 AM.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
