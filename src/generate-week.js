require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateTopic, generatePageHTML, generatePosts } = require('./claude-prompts');
const { deployPage } = require('./github-deploy');

const DRY_RUN = process.argv.includes('--dry-run');
const DATA_DIR = path.join(__dirname, '../data');
const TOPICS_FILE = path.join(DATA_DIR, 'topics-used.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending-week.json');
const TEMPLATES_DIR = path.join(__dirname, '../templates');

function getWeekOf() {
  const now = new Date();
  // Find the upcoming Monday
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  return monday.toISOString().split('T')[0];
}

function getWeekNumber() {
  const usedTopics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  return usedTopics.length + 1;
}

async function main() {
  if (!DRY_RUN) {
    const missing = ['ANTHROPIC_API_KEY', 'GH_PAGES_TOKEN'].filter(k => !process.env[k]);
    if (missing.length) {
      console.error(`Missing required GitHub secrets: ${missing.join(', ')}`);
      console.error('Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret');
      process.exit(1);
    }
  }

  console.log(DRY_RUN ? '\n-- DRY RUN MODE --\n' : '\nGenerating this week\'s content...\n');

  const weekOf = getWeekOf();
  const weekNumber = getWeekNumber();
  const usedTopics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  const contactUrl = process.env.YOUR_CONTACT_URL || 'https://yourwebsite.com/contact';

  // 1. Generate topic
  console.log(`Week ${weekNumber} · ${weekOf}`);
  process.stdout.write('Generating topic...');
  const topic = await generateTopic(weekNumber, usedTopics);
  console.log(` done.\nTopic: ${topic.title} (${topic.type})\nSlug: ${topic.slug}\n`);

  // 2. Generate HTML page
  process.stdout.write('Generating page HTML...');
  const templateFile = topic.type === 'calculator' ? 'calculator.html' : 'explainer.html';
  const templateHTML = fs.readFileSync(path.join(TEMPLATES_DIR, templateFile), 'utf8');
  const pageHTML = await generatePageHTML(topic, templateHTML, contactUrl);
  console.log(' done.');

  // 3. Deploy to GitHub Pages (skip in dry-run)
  let pageUrl;
  if (DRY_RUN) {
    pageUrl = `https://example.github.io/tools/pages/${topic.slug}/`;
    console.log(`[DRY RUN] Would deploy to: ${pageUrl}`);
  } else {
    process.stdout.write('Deploying to GitHub Pages...');
    pageUrl = await deployPage(topic.slug, pageHTML);
    console.log(' done.');
    // Brief pause for Pages to propagate
    await new Promise(r => setTimeout(r, 3000));
  }

  // 4. Generate 3 posts
  process.stdout.write('Generating LinkedIn posts...');
  const postsRaw = await generatePosts(topic, pageUrl);
  console.log(' done.\n');

  const posts = [
    { day: 'monday', text: postsRaw.monday, sent: false },
    { day: 'wednesday', text: postsRaw.wednesday, sent: false },
    { day: 'friday', text: postsRaw.friday, sent: false }
  ];

  if (DRY_RUN) {
    console.log('=== MONDAY POST ===');
    console.log(posts[0].text);
    console.log('\n=== WEDNESDAY POST ===');
    console.log(posts[1].text);
    console.log('\n=== FRIDAY POST ===');
    console.log(posts[2].text);
    console.log('\n[DRY RUN] No data saved. Done.');
    return;
  }

  // 5. Save pending week data
  const weekData = {
    weekOf,
    weekNumber,
    topic,
    pageUrl,
    posts,
    status: 'pending',
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(PENDING_FILE, JSON.stringify(weekData, null, 2));

  // 6. Record topic as used
  usedTopics.push({ title: topic.title, slug: topic.slug, weekOf });
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(usedTopics, null, 2));

  console.log('All done. Posts are ready for review on the dashboard.');
}

main().catch(err => {
  console.error('\nError:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
