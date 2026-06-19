require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const VOICE_GUIDE = fs.readFileSync(path.join(__dirname, '../data/voice-guide.txt'), 'utf8');

async function generateTopic(weekNumber, usedTopics) {
  const type = weekNumber % 2 === 1 ? 'calculator' : 'explainer';
  const usedList = usedTopics.length > 0
    ? `\n\nAvoid these topics already used:\n${usedTopics.map(t => `- ${t.title}`).join('\n')}`
    : '';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `You generate content ideas for a solo web developer who builds e-commerce sites for small businesses. Ideas must be directly useful to non-technical small business owners.`,
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
    system: `You write LinkedIn posts for a solo web developer. You must follow these voice rules exactly:\n\n${VOICE_GUIDE}`,
    messages: [{
      role: 'user',
      content: `Write three LinkedIn posts for this week's content. The page is live at: ${pageUrl}

Topic: ${topic.title}
Description: ${topic.description}

POST 1 — MONDAY (Introduction)
Introduce what this tool/page is and what it does. Hook in the first line — make someone stop scrolling. Describe the tool plainly. Link to the page. No sales pitch. 100-150 words.

POST 2 — WEDNESDAY (Value for businesses)
Why would a small business owner care about this? Make it feel real and relevant to someone running an actual shop. No mention of the tool yet — lead with the problem or insight, then reference the tool naturally as a resource. 100-150 words.

POST 3 — FRIDAY (Web development tie-in)
Connect this topic back to why having a good website matters for a small business. This is where you draw the line between the tool/insight and the real business impact of their online presence. Soft mention that this is what you help businesses with. 100-150 words.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "monday": "full post text",
  "wednesday": "full post text",
  "friday": "full post text"
}`
    }]
  });

  const raw = message.content[0].text.trim();
  return JSON.parse(raw);
}

module.exports = { generateTopic, generatePageHTML, generatePosts };
