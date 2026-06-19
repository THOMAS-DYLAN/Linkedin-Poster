'use strict';

function buildDashboardHtml({ weekData, owner, repoName, token }) {
  // Safely embed JSON in a <script> tag
  const safeData = JSON.stringify(weekData).replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkedIn Bot — Week of ${weekData.weekOf}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f2; color: #1a1a1a; min-height: 100vh; }
    header { background: #1a1a1a; color: #fff; padding: 24px 32px; display: flex; align-items: baseline; gap: 16px; }
    header .label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; }
    header h1 { font-size: 18px; font-weight: 700; }
    .container { max-width: 720px; margin: 40px auto; padding: 0 24px 80px; }
    .status-bar { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 8px; margin-bottom: 28px; font-size: 13px; font-weight: 600; }
    .status-bar.pending  { background: #fffbe6; border: 1px solid #f0c040; color: #7a5c00; }
    .status-bar.approved { background: #edfbf1; border: 1px solid #4caf85; color: #1a6644; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .pending  .dot { background: #f0c040; }
    .approved .dot { background: #4caf85; }
    .topic-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 18px 20px; margin-bottom: 28px; }
    .topic-card .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #4a7fd4; margin-bottom: 6px; }
    .topic-card h2 { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
    .topic-card .desc { font-size: 13px; color: #555; margin-bottom: 10px; }
    .topic-card a { font-size: 13px; color: #0070f3; text-decoration: none; }
    .topic-card a:hover { text-decoration: underline; }
    .post-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    .post-card .post-meta { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .post-card .sent-badge { display: inline-block; margin-left: 8px; background: #edfbf1; color: #1a6644; border: 1px solid #4caf85; border-radius: 4px; padding: 1px 6px; font-size: 9px; letter-spacing: 0.06em; vertical-align: middle; }
    .post-card textarea { width: 100%; min-height: 160px; font-size: 14px; line-height: 1.7; color: #1a1a1a; background: #f9f9f7; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 14px; resize: vertical; font-family: inherit; transition: border-color 0.15s; }
    .post-card textarea:focus { outline: none; border-color: #0070f3; background: #fff; }
    .post-card textarea:disabled { color: #555; background: #f4f4f2; cursor: default; }
    .actions { margin-top: 32px; display: flex; align-items: center; gap: 16px; }
    .btn-confirm { background: #1a1a1a; color: #fff; border: none; border-radius: 8px; padding: 13px 28px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s; }
    .btn-confirm:hover { background: #333; }
    .btn-confirm:active { transform: scale(0.98); }
    .btn-confirm:disabled { background: #bbb; cursor: not-allowed; }
    .action-hint { font-size: 12px; color: #888; line-height: 1.5; }
    .flash { padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 20px; display: none; }
    .flash.success { background: #edfbf1; border: 1px solid #4caf85; color: #1a6644; }
    .flash.error   { background: #fff0f0; border: 1px solid #f08080; color: #8b0000; }
  </style>
</head>
<body>
<header>
  <span class="label">LinkedIn Bot</span>
  <h1>Week of ${weekData.weekOf}</h1>
</header>
<div class="container">
  <div id="status-bar" class="status-bar pending">
    <span class="dot"></span>
    <span id="status-text">Pending approval — review the posts below and click Confirm.</span>
  </div>
  <div class="topic-card">
    <div class="eyebrow">This week’s page</div>
    <h2>${escHtml(weekData.topic.title)}</h2>
    <p class="desc">${escHtml(weekData.topic.description || '')}</p>
    <a href="${escAttr(weekData.pageUrl)}" target="_blank">${escHtml(weekData.pageUrl)}</a>
  </div>
  <div id="posts"></div>
  <div id="actions" class="actions">
    <button class="btn-confirm" id="btn-confirm">Confirm &amp; Approve</button>
    <span class="action-hint">You can edit any post above before confirming.</span>
  </div>
  <div class="flash" id="flash"></div>
</div>
<script>
  var WEEK_DATA  = ${safeData};
  var GH_OWNER   = ${JSON.stringify(owner)};
  var GH_REPO    = ${JSON.stringify(repoName)};
  var GH_TOKEN   = ${JSON.stringify(token)};
  var DATA_PATH  = 'data/pending-week.json';

  var DAY_LABELS = {
    monday:    'POST 1 — Introduction · goes out Monday at 9 AM',
    wednesday: 'POST 2 — Why businesses care · goes out Wednesday at 9 AM',
    friday:    'POST 3 — Web development tie-in · goes out Friday at 9 AM'
  };

  function init() {
    if (WEEK_DATA.status === 'approved') {
      var sb = document.getElementById('status-bar');
      sb.className = 'status-bar approved';
      var via = WEEK_DATA.approvedVia ? ' (via ' + WEEK_DATA.approvedVia + ')' : '';
      document.getElementById('status-text').textContent =
        'Approved' + via + ' — posts will go out Mon / Wed / Fri at 9 AM';
      document.getElementById('actions').style.display = 'none';
    }

    var container = document.getElementById('posts');
    WEEK_DATA.posts.forEach(function(post, i) {
      var card = document.createElement('div');
      card.className = 'post-card';

      var meta = document.createElement('div');
      meta.className = 'post-meta';
      meta.textContent = DAY_LABELS[post.day] || post.day;

      if (post.sent) {
        var badge = document.createElement('span');
        badge.className = 'sent-badge';
        badge.textContent = 'SENT';
        meta.appendChild(badge);
      }

      var ta = document.createElement('textarea');
      ta.id       = 'post-' + i;
      ta.value    = post.text;
      ta.disabled = WEEK_DATA.status === 'approved';

      card.appendChild(meta);
      card.appendChild(ta);
      container.appendChild(card);
    });

    document.getElementById('btn-confirm').addEventListener('click', approve);
  }

  async function approve() {
    var btn = document.getElementById('btn-confirm');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    var editedPosts = WEEK_DATA.posts.map(function(p, i) {
      return { day: p.day, sent: p.sent || false, sentAt: p.sentAt || null,
               text: document.getElementById('post-' + i).value };
    });

    try {
      var apiBase = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + DATA_PATH;
      var headers = { Authorization: 'token ' + GH_TOKEN, Accept: 'application/vnd.github+json' };

      var headRes = await fetch(apiBase, { headers: headers });
      if (!headRes.ok) throw new Error('Could not read current file from GitHub (HTTP ' + headRes.status + ')');
      var headData = await headRes.json();

      var updated = Object.assign({}, WEEK_DATA, {
        posts: editedPosts,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedVia: 'dashboard'
      });

      var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2))));

      var putRes = await fetch(apiBase, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify({
          message: 'Approve week of ' + WEEK_DATA.weekOf + ' (via dashboard)',
          content: encoded,
          sha: headData.sha
        })
      });

      if (!putRes.ok) {
        var errBody = await putRes.json();
        throw new Error(errBody.message || 'GitHub API error');
      }

      showFlash('Week of ' + WEEK_DATA.weekOf + ' approved! Posts will go out Mon / Wed / Fri at 9 AM.', 'success');
      btn.textContent = 'Approved ✓';
      WEEK_DATA.status = 'approved';

      document.getElementById('status-bar').className = 'status-bar approved';
      document.getElementById('status-text').textContent =
        'Approved (via dashboard) — posts will go out Mon / Wed / Fri at 9 AM';
      document.getElementById('actions').style.display = 'none';
      WEEK_DATA.posts.forEach(function(_, i) {
        document.getElementById('post-' + i).disabled = true;
      });

    } catch (err) {
      showFlash(err.message, 'error');
      btn.disabled    = false;
      btn.textContent = 'Confirm & Approve';
    }
  }

  function showFlash(msg, type) {
    var el = document.getElementById('flash');
    el.textContent   = msg;
    el.className     = 'flash ' + type;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 7000);
  }

  init();
</script>
</body>
</html>`;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

module.exports = { buildDashboardHtml };
