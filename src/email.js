require('dotenv').config();
const nodemailer = require('nodemailer');

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

function buildSubject(weekOf) {
  return `[LinkedIn Bot] Week of ${weekOf} — Awaiting Approval`;
}

function buildHtmlBody(weekData) {
  const { topic, pageUrl, posts, weekOf } = weekData;
  const postBlocks = [
    { day: 'Monday', label: 'POST 1 — Introduction', text: posts[0].text },
    { day: 'Wednesday', label: 'POST 2 — Why businesses care', text: posts[1].text },
    { day: 'Friday', label: 'POST 3 — Web development tie-in', text: posts[2].text }
  ];

  const postHTML = postBlocks.map(p => `
    <div style="margin-bottom:28px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#888;margin:0 0 6px;">${p.label} · goes out ${p.day} at 9 AM</p>
      <div style="background:#f9f9f7;border:1px solid #e5e5e5;border-radius:8px;padding:16px 18px;white-space:pre-line;font-size:14px;line-height:1.7;color:#1a1a1a;">
${p.text}
      </div>
    </div>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#1a1a1a;color:#fff;padding:28px 28px 24px;border-radius:10px 10px 0 0;">
        <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;">LinkedIn Bot</p>
        <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;">Week of ${weekOf}</h1>
      </div>
      <div style="border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444;">
          This week's tool is live. Review the three posts below and reply <strong>"approved"</strong> to schedule them. Reply "approved with changes:" followed by your edits if you want to adjust anything.
        </p>

        <div style="background:#f0f7ff;border:1px solid #c2dafb;border-radius:8px;padding:14px 16px;margin-bottom:28px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#4a7fd4;">This week's page</p>
          <p style="margin:0;font-size:15px;font-weight:700;">${topic.title}</p>
          <p style="margin:4px 0 8px;font-size:13px;color:#555;">${topic.description}</p>
          <a href="${pageUrl}" style="font-size:13px;color:#0070f3;">${pageUrl}</a>
        </div>

        ${postHTML}

        <div style="border-top:1px solid #e5e5e5;padding-top:20px;margin-top:8px;">
          <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
            Reply <strong>"approved"</strong> to schedule all three posts.<br>
            Reply <strong>"approved with changes: [post day]: [new text]"</strong> to update a specific post before it goes out.<br>
            If you don't reply, nothing will be posted.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function sendDraftEmail(weekData) {
  const transport = getTransport();
  const subject = buildSubject(weekData.weekOf);

  const info = await transport.sendMail({
    from: `"LinkedIn Bot" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject,
    html: buildHtmlBody(weekData)
  });

  console.log(`Approval email sent. Message-ID: ${info.messageId}`);
  return { subject, messageId: info.messageId };
}

// Test mode: npm run test:email
if (require.main === module && process.argv.includes('--test')) {
  const mockData = {
    weekOf: '2026-06-22',
    topic: {
      title: 'Revenue Leak Calculator',
      description: 'Find out how much money a slow or broken website is costing your business each month.'
    },
    pageUrl: 'https://example.github.io/tools/pages/revenue-leak-calculator/',
    posts: [
      { text: 'Most small business websites lose money every day.\n\nNot from hackers. Not from bad products.\n\nFrom a form that breaks on mobile. A checkout page that loads slow. A phone number that goes nowhere.\n\nThis calculator shows you how much that actually costs.\n\nLink in comments.' },
      { text: 'Here\'s a number I think about a lot: 53% of visitors leave a site if it takes more than 3 seconds to load.\n\nFor a shop doing $10,000 a month online, that could be $2,000-$4,000 walking out the door.\n\nNot because the product is bad. Because the website is slow.\n\nThis week I built a calculator that puts a number on it.' },
      { text: 'The thing most people don\'t realize about websites:\n\nA bad one isn\'t neutral. It\'s actively working against you.\n\nEvery broken link, every form that doesn\'t work on a phone, every page that loads slow — it\'s costing real money.\n\nThis is exactly why I build websites that are fast, clean, and built to convert. Not just to look good.\n\nLink to the calculator if you want to see the math.' }
    ]
  };
  sendDraftEmail(mockData)
    .then(() => console.log('Test email sent successfully.'))
    .catch(err => { console.error('Email failed:', err.message); process.exit(1); });
}

module.exports = { sendDraftEmail, buildSubject };
