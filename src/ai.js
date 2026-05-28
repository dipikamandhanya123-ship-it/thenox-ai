// Direct AI — calls Gemini API directly from frontend
// This is safe for Gemini because we use domain restrictions

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY;

const SYSTEM = `You are Thenox AI, a powerful and helpful AI assistant.
Help with coding, writing, analysis, math, research and more.
Format responses clearly with markdown. Be accurate and concise.
NEVER assist with illegal, harmful, gambling, adult or unethical content.`;

export async function askAI(messages, opts = {}) {
  const sys = SYSTEM + (opts.thinking ? '\nThink step by step before answering.' : '') + (opts.webSearch ? '\nWeb search is enabled - note if info may be outdated.' : '');

  // 1. Try Gemini direct
  if (GEMINI_KEY) {
    try {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: sys }] },
            generationConfig: { temperature: opts.thinking ? 0.3 : 0.7, maxOutputTokens: 2048 }
          })
        }
      );
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { reply: data.candidates[0].content.parts[0].text, model: 'Gemini 2.0 Flash' };
      }
      if (data.error) console.warn('Gemini error:', data.error.message);
    } catch (e) { console.warn('Gemini failed:', e.message); }
  }

  // 2. Try OpenRouter free models
  if (OPENROUTER_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://thenox-ai.vercel.app',
          'X-Title': 'Thenox AI'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [{ role: 'system', content: sys }, ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))],
          max_tokens: 2048
        })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        return { reply: data.choices[0].message.content, model: 'DeepSeek R1' };
      }
    } catch (e) { console.warn('OpenRouter failed:', e.message); }
  }

  // 3. Fallback message
  throw new Error(
    'AI not configured. Please add VITE_GEMINI_KEY in Vercel Environment Variables.\n\n' +
    'Get free key from: aistudio.google.com/app/apikey'
  );
}
