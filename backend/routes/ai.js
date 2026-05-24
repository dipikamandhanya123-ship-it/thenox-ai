const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db, admin } = require('../config/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const axios = require('axios');
const xss = require('xss');

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// Content moderation
const BLOCKED = ['gambling','casino','porn','adult content','phishing','malware','illegal','betting','violence','hate speech'];
const isBlocked = (text) => BLOCKED.some(w => text.toLowerCase().includes(w));

// Smart token counting
const countTokens = (text) => Math.ceil(text.length / 4);

// Plan limits
const MESSAGE_LIMITS = { free: 100, pro: 1000, ultra: 99999 };

// AI generation with fallback chain
async function generateAI(messages, workers = [], options = {}) {
  const systemPrompt = `You are Thenox AI, an intelligent, helpful, and accurate assistant.
You can help with coding, analysis, writing, math, research, and much more.
Be concise but thorough. Format responses with markdown when helpful.
IMPORTANT: Never help with illegal, harmful, adult, gambling, or unethical content.
If unsure about something, say so clearly rather than guessing.
${options.webSearch ? 'The user has web search enabled - mention if information might be outdated.' : ''}
${options.thinking ? 'Think step by step before answering.' : ''}`;

  // Determine which model to use based on active workers
  const hasDeepSeek = workers.includes('deepseek-r1') || workers.includes('deepseek-v3');
  const hasLlama = workers.includes('llama-3-3-70b');
  const hasGroq = workers.some(w => ['llama-3-3-70b','llama-3-1-8b','mixtral-8x7b'].includes(w));

  // Try Gemini first (always available)
  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const history = messages.slice(0,-1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    const chat = model.startChat({
      history,
      systemInstruction: systemPrompt,
      generationConfig: { temperature: options.thinking ? 0.3 : 0.7, maxOutputTokens: 2048 }
    });
    const lastMsg = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMsg.content);
    return { reply: result.response.text(), model: 'Gemini 2.0 Flash' };
  } catch (geminiErr) {
    console.warn('Gemini failed:', geminiErr.message);
  }

  // Try Groq (fast fallback)
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))],
      max_tokens: 2048, temperature: 0.7
    });
    return { reply: completion.choices[0].message.content, model: 'Llama 3.3 70B' };
  } catch (groqErr) {
    console.warn('Groq failed:', groqErr.message);
  }

  // Try OpenRouter (final fallback)
  try {
    const model = hasDeepSeek ? 'deepseek/deepseek-r1:free' : 'mistralai/mistral-7b-instruct:free';
    const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))],
      max_tokens: 2048
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://thenox-ai.vercel.app', 'X-Title': 'Thenox AI' }
    });
    return { reply: resp.data.choices[0].message.content, model: model.split('/')[1] };
  } catch (orErr) {
    console.warn('OpenRouter failed:', orErr.message);
  }

  throw new Error('All AI providers are currently unavailable. Please try again.');
}

// POST /api/ai/chat
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { message, history = [], workers = [], webSearch = false, thinking = false } = req.body;
    const userData = req.userData;

    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    // Safety check
    if (isBlocked(message)) return res.status(400).json({ error: 'This type of content is not allowed on Thenox AI.' });

    // Check message limit
    const plan = userData?.plan || 'free';
    const used = userData?.messagesUsedToday || 0;
    const limit = MESSAGE_LIMITS[plan] || 100;
    if (used >= limit) return res.status(402).json({ error: `Daily message limit reached (${limit}/day). Upgrade your plan!` });

    // Build context (smart: last N messages based on plan)
    const contextLimit = plan === 'ultra' ? 50 : plan === 'pro' ? 30 : 10;
    const safeHistory = history.slice(-contextLimit).map(m => ({ role: m.role, content: xss(m.content, { whiteList: {}, stripIgnoreTag: true }) }));
    safeHistory.push({ role: 'user', content: xss(message, { whiteList: {}, stripIgnoreTag: true }) });

    // Generate response
    const result = await generateAI(safeHistory, workers, { webSearch, thinking });

    // Count tokens used
    const tokensUsed = countTokens(message) + countTokens(result.reply);

    // Update usage in background
    db.collection('users').doc(req.user.uid).update({
      messagesUsedToday: admin.firestore.FieldValue.increment(1),
      tokensUsedToday: admin.firestore.FieldValue.increment(tokensUsed),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    res.json({ success: true, reply: result.reply, model: result.model, tokensUsed });
  } catch (e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
