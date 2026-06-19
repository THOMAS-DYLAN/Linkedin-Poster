require('dotenv').config();
const { Octokit } = require('@octokit/rest');

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

module.exports = { deployPage };
