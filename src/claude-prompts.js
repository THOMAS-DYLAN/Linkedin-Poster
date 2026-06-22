require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const VOICE_GUIDE = fs.readFileSync(path.join(__dirname, '../linkedin-voice.md'), 'utf8');

async function generateTopic(weekNumber, usedTopics) {
  const type = weekNumber % 2 === 1 ? 'calculator' : 'explainer';
  const usedList = usedTopics.length > 0
    ? `\n\nAvoid these topics already used:\n${usedTopics.map(t => `- ${t.title}`).join('\n')}`
    : '';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `You generate content ideas for Deadwood Digital, a one-person web development studio that builds e-commerce stores for small sellers — people currently selling on Etsy, eBay, Amazon, or TikTok Shop who want their own store. Ideas must be directly useful and compelling to non-technical small sellers. NEVER suggest developer-facing topics (no git, no code tools, no programming concepts). Every idea must connect to one of these content pillars: marketplace fees and platform risk, owning your store vs renting space on a platform, what makes shoppers trust and buy (conversion/checkout), the real cost of not having your own store, or myths about what it takes to sell online independently.`,
    messages: [{
      role: 'user',
      content: `Week ${weekNumber}. Type: ${type}.

Generate one mini-webpage idea. ${type === 'calculator' ? 'It should be an interactive tool with inputs and a calculated result (e.g. revenue leak calculator, cost-of-no-website estimator, abandoned cart loss calculator, mobile speed impact estimator, monthly ad spend vs website ROI calculator).' : 'It should be an explainer page — plain writing that educates a business owner on one concept (e.g. why slow sites lose sales, what a bounce rate actually means, why most small business websites don\'t convert).'}${usedList}

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "title": "Short title (5 words max)",
  "slug": "url-friendly-slug",
  "description": "One sentence describing what this page does for the reader",
  "type": "${type}"
}`
    }]
  });

  const raw = message.content[0].text.trim();
  return JSON.parse(raw);
}

async function generatePageHTML(topic, templateHTML, contactUrl) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are an expert front-end developer. You write clean, self-contained HTML pages. No external CSS or JS dependencies. Mobile-friendly. Plain, honest design.`,
    messages: [{
      role: 'user',
      content: `Build a complete, working HTML page for this tool:

Title: ${topic.title}
Description: ${topic.description}
Type: ${topic.type}
Contact URL for CTA: ${contactUrl}

Use this base template exactly — replace all <!-- PLACEHOLDER --> comments with real content and working code. Do not change the CSS structure. Fill in the JavaScript logic to make the ${topic.type === 'calculator' ? 'calculator fully functional' : 'page complete and readable'}.

For calculators: write real JS that reads the inputs, does the math, and shows meaningful results. Include 3-5 input fields relevant to the topic.
For explainers: write real, plain-English content in each section. Include real stats if relevant. Make the checklist items specific and useful.

BASE TEMPLATE:
${templateHTML}

Return ONLY the complete HTML — no markdown fences, no explanation, just the HTML starting with <!DOCTYPE html>.`
    }]
  });

  return message.content[0].text.trim();
}

async function generatePosts(topic, pageUrl) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You write LinkedIn posts for Deadwood Digital. Read the full voice guide below and follow every rule exactly — the hard rules, the post anatomy, the hashtag sets, the CTA rotation, the checklist.\n\n${VOICE_GUIDE}`,
    messages: [{
      role: 'user',
      content: `Write three LinkedIn posts for this week's content. The page is live at: ${pageUrl}

Topic: ${topic.title}
Description: ${topic.description}

INSTRUCTIONS — follow these precisely:

1. CONTENT PILLARS (section 5): Choose the best-fit pillar for each post. Use a different pillar for each of the three posts — don't repeat.

2. POST TYPE (section 6): Choose the best-fit post type (Insight, Problem, Story, Myth-bust, List, Hook-only) for each post. Vary the types across the three posts.

3. CTA ROTATION (section 7) — this is mandatory:
   - Monday: soft CTA — e.g. "Comment if this sounds familiar."
   - Wednesday: no CTA — let the value stand alone, end on the point.
   - Friday: direct but warm CTA — e.g. "If you're still renting space on someone else's platform, let's talk. DM me."

4. HASHTAGS (section 9): End each post with 5–8 tiered hashtags after a blank line. Use a different set (A, B, C, or D) for each post — don't reuse the same set.

5. HOOK (section 7 + section 8): Line 1 must stop the scroll. Use a bold specific claim, a stat, or an unexpected observation. Never open with "I". Never open with a one-word question. Use the hook bank in section 8 as inspiration — don't copy verbatim.

6. FORMATTING (section 10): Single or two-sentence paragraphs. Blank line between every thought. No em-dashes in run-on sentences.

7. Run the checklist from section 13 mentally before outputting each post.

Connect each post naturally to the tool/topic:
- Monday: introduce the tool or insight — what it is, what it shows, why it matters. Link to ${pageUrl}.
- Wednesday: ground it in the seller's real experience — fees, lost customers, no control. Reference the tool as a resource.
- Friday: draw the line to owning your store. Make the reader feel the difference between renting space on a platform and having something real.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "monday": "full post text including hashtags",
  "wednesday": "full post text including hashtags",
  "friday": "full post text including hashtags"
}`
    }]
  });

  const raw = message.content[0].text.trim();
  return JSON.parse(raw);
}

module.exports = { generateTopic, generatePageHTML, generatePosts };
