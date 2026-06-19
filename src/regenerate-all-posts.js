require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { generatePosts } = require('./claude-prompts');

const PENDING_FILE = path.join(__dirname, '../data/pending-week.json');

async function main() {
  const raw = fs.readFileSync(PENDING_FILE, 'utf8').trim();
  if (!raw || raw === '{}') {
    console.error('No pending week data. Run npm run generate first.');
    process.exit(1);
  }

  const pending = JSON.parse(raw);
  console.log(`Regenerating all posts for week of ${pending.weekOf}…`);

  const posts = await generatePosts(pending.topic, pending.pageUrl);

  pending.posts = [
    { day: 'monday',    text: posts.monday,    sent: false },
    { day: 'wednesday', text: posts.wednesday, sent: false },
    { day: 'friday',    text: posts.friday,    sent: false },
  ];

  // Reset approval since posts are new and need review
  pending.status = 'pending';
  delete pending.approvedAt;
  delete pending.approvedVia;

  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
  console.log('Done. All three posts regenerated.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
