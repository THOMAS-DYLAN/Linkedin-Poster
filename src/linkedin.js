require('dotenv').config();
const http = require('http');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');

// Post text to LinkedIn feed, optionally with a link
async function postToLinkedIn(text, articleUrl) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = process.env.LINKEDIN_AUTHOR_URN;

  if (!token || !author) {
    throw new Error('LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN not set. Run: npm run auth-linkedin');
  }

  let shareContent;

  if (articleUrl) {
    shareContent = {
      shareCommentary: { text },
      shareMediaCategory: 'ARTICLE',
      media: [{
        status: 'READY',
        originalUrl: articleUrl
      }]
    };
  } else {
    shareContent = {
      shareCommentary: { text },
      shareMediaCategory: 'NONE'
    };
  }

  const body = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });

  console.log(`Posted to LinkedIn. Post ID: ${response.data.id}`);
  return response.data.id;
}

// OAuth2 authorization flow — run once with: npm run auth-linkedin
async function authorize() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log(`
SETUP REQUIRED
--------------
1. Go to https://www.linkedin.com/developers/apps and create a new app.
2. Under "Auth", add redirect URL: http://localhost:3333/callback
3. Request the "w_member_social" product (Share on LinkedIn).
4. Add to your .env file:
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
5. Run "npm run auth-linkedin" again.
`);
    process.exit(1);
  }

  const redirectUri = 'http://localhost:3333/callback';
  const scope = 'openid profile w_member_social';
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

  console.log('\nOpening browser for LinkedIn authorization...');
  console.log(`If the browser does not open, visit:\n${authUrl}\n`);

  try {
    execSync(`start "" "${authUrl}"`);
  } catch (_) {}

  // Local callback server to capture the auth code
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3333');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code) {
        res.end('<h2>Authorization successful. You can close this tab.</h2>');
        server.close();
        resolve(code);
      } else {
        res.end(`<h2>Authorization failed: ${error}</h2>`);
        server.close();
        reject(new Error(error || 'Authorization denied'));
      }
    });

    server.listen(3333, () => console.log('Waiting for LinkedIn callback on http://localhost:3333...'));
    server.on('error', reject);
  });

  // Exchange code for access token
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const { access_token, expires_in } = tokenResponse.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString().split('T')[0];

  // Fetch the user's URN via OpenID Connect userinfo endpoint
  const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const authorUrn = `urn:li:person:${profileResponse.data.sub}`;

  // Write tokens into .env
  let envContents = fs.readFileSync(ENV_PATH, 'utf8');
  envContents = envContents.replace(/^LINKEDIN_ACCESS_TOKEN=.*/m, `LINKEDIN_ACCESS_TOKEN=${access_token}`);
  envContents = envContents.replace(/^LINKEDIN_AUTHOR_URN=.*/m, `LINKEDIN_AUTHOR_URN=${authorUrn}`);
  fs.writeFileSync(ENV_PATH, envContents);

  console.log(`\nAuthorization complete.`);
  console.log(`Access token saved to .env (expires ${expiresAt}).`);
  console.log(`Author URN: ${authorUrn}`);
}

// Entry points for CLI flags
if (require.main === module) {
  if (process.argv.includes('--auth')) {
    authorize().catch(err => { console.error(err.message); process.exit(1); });
  } else if (process.argv.includes('--test')) {
    postToLinkedIn('Test post — ignore. Verifying LinkedIn bot connection.')
      .then(() => console.log('Test post successful.'))
      .catch(err => { console.error('Post failed:', err.response?.data || err.message); process.exit(1); });
  }
}

module.exports = { postToLinkedIn };
