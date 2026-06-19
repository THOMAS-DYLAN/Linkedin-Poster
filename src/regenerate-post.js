require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { generatePosts } = require('./claude-prompts');

const DAY = process.env.POST_DAY || process.argv[2];

if (!['monday', 'wednesday', 'friday'].includes(DAY)) {
  console.error('Usage: POST_DAY=monday node src/regenerate-post.js');
  process.exit(1);
}

const PENDING_FILE = path.join(__dirname, '../data/pending-week.json');

async function main() {
  const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
  if (!raw || raw === '{}') {
    console.error('No pending week data. Run npm run generate first.');
    process.exit(1);
  }

  const pending = JSON.parse(raw);
  console.log(`Regenerating ${DAY} post for week of ${pending.weekOf}…`);

  const posts = await generatePosts(pending.topic, pending.pageUrl);

  const post = pending.posts.find(p => p.day === DAY);
  if (!post) {
    console.error(`No ${DAY} post found in pending data.`);
    process.exit(1);
  }

  post.text = posts[DAY];
  post.sent = false;

  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
  console.log(`Done. ${DAY} post regenerated.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
