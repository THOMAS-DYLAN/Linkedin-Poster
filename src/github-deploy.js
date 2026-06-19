require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { buildDashboardHtml } = require('./build-dashboard-html');

const octokit = new Octokit({ auth: process.env.GH_PAGES_TOKEN });

function parseRepo(repoString) {
  const [owner, repo] = repoString.split('/');
  if (!owner || !repo) throw new Error(`GITHUB_REPO must be "owner/repo", got: ${repoString}`);
  return { owner, repo };
}

async function deployPage(slug, htmlContent) {
  const { owner, repo } = parseRepo(process.env.GITHUB_REPO);
  const filePath = `pages/${slug}/index.html`;
  const encodedContent = Buffer.from(htmlContent).toString('base64');

  // Check if file already exists (needed for updates)
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    sha = data.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `Add ${slug} page`,
    content: encodedContent,
    ...(sha ? { sha } : {})
  });

  // GitHub Pages URL
  const pageUrl = `https://${owner}.github.io/${repo}/pages/${slug}/`;
  console.log(`Deployed: ${pageUrl}`);
  return pageUrl;
}

async function commitPendingToRepo(weekData) {
  const { owner, repo } = parseRepo(process.env.GITHUB_REPO);
  const filePath = 'data/pending-week.json';
  const content = Buffer.from(JSON.stringify(weekData, null, 2)).toString('base64');

  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    sha = data.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: filePath,
    message: `Update pending week (${weekData.weekOf})`,
    content,
    ...(sha ? { sha } : {})
  });
}

async function fetchPendingFromRepo() {
  if (!process.env.GH_PAGES_TOKEN || !process.env.GITHUB_REPO) return null;
  const { owner, repo } = parseRepo(process.env.GITHUB_REPO);
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: 'data/pending-week.json' });
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function deployDashboard(weekData) {
  const { owner, repo } = parseRepo(process.env.GITHUB_REPO);
  const token = process.env.GH_PAGES_TOKEN;
  const html = buildDashboardHtml({ weekData, owner, repoName: repo, token });
  const filePath = 'dashboard/index.html';
  const encodedContent = Buffer.from(html).toString('base64');

  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    sha = data.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: filePath,
    message: `Deploy dashboard (week of ${weekData.weekOf})`,
    content: encodedContent,
    ...(sha ? { sha } : {})
  });

  return `https://${owner}.github.io/${repo}/dashboard/`;
}

module.exports = { deployPage, commitPendingToRepo, fetchPendingFromRepo, deployDashboard };
