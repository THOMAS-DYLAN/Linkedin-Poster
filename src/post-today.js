require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { postToLinkedIn } = require('./linkedin');

const PENDING_FILE = path.join(__dirname, '../data/pending-week.json');

const DAY_MAP = {
  1: 'monday',
  3: 'wednesday',
  5: 'friday'
};

const DAY_OVERRIDE = process.env.POST_DAY_OVERRIDE;
const FORCE        = process.env.POST_FORCE === '1';

function todayDayKey() {
  if (DAY_OVERRIDE) return DAY_OVERRIDE;
  return DAY_MAP[new Date().getDay()];
}

async function main() {
  const dayKey = todayDayKey();

  if (!dayKey) {
    console.log(`Today is not a posting day (Mon/Wed/Fri). Exiting.`);
    return;
  }

  const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
  if (!raw || raw === '{}') {
    console.log('No pending week data found. Run npm run generate first.');
    return;
  }

  const pending = JSON.parse(raw);

  if (!FORCE && pending.status !== 'approved') {
    console.log(`Week of ${pending.weekOf} is not approved yet. Waiting for email reply.`);
    return;
  }

  const post = pending.posts.find(p => p.day === dayKey);

  if (!post) {
    console.log(`No post found for ${dayKey}.`);
    return;
  }

  if (post.sent) {
    console.log(`${dayKey} post already sent. Nothing to do.`);
    return;
  }

  console.log(`Posting ${dayKey} post for week of ${pending.weekOf}...`);

  // Monday intro post includes the page link as an article attachment.
  // Wed/Fri posts are text-only (the page URL is mentioned in the text itself).
  const articleUrl = dayKey === 'monday' ? pending.pageUrl : undefined;
  await postToLinkedIn(post.text, articleUrl);

  post.sent = true;
  post.sentAt = new Date().toISOString();
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));

  console.log(`Done. ${dayKey} post published.`);
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
