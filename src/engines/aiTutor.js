/**
 * AI Tutor Module — LLM Integration
 * 
 * Connects to OpenAI, Google Gemini, or Anthropic Claude APIs
 * for intelligent grammar analysis, error explanation, and transformation guidance.
 * API keys are stored in localStorage for security.
 */

const STORAGE_KEY = 'parser_app_ai_config';

export function getAIConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { provider: 'openai', apiKey: '' };
  } catch {
    return { provider: 'openai', apiKey: '' };
  }
}

export function saveAIConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Send a prompt to the configured LLM provider.
 */
async function callLLM(systemPrompt, userPrompt) {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error('No API key configured. Please add your API key in Settings.');
  }

  const { provider, apiKey } = config;

  try {
    switch (provider) {
      case 'openai':
        return await callOpenAI(apiKey, systemPrompt, userPrompt);
      case 'gemini':
        return await callGemini(apiKey, systemPrompt, userPrompt);
      case 'claude':
        return await callClaude(apiKey, systemPrompt, userPrompt);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error('Invalid API key. Please check your key in Settings.');
    }
    throw error;
  }
}

async function callOpenAI(apiKey, system, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(apiKey, system, user) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callClaude(apiKey, system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

// ========== AI Tutor Functions ==========

const SYSTEM_PROMPT = `You are an expert Computer Science professor specializing in Compilers and Formal Languages.
You explain concepts clearly using formal notation, concrete examples, and step-by-step reasoning.
Format your responses in Markdown. Use LaTeX notation for formal expressions where helpful.
Be concise but thorough. Always relate explanations back to the specific grammar provided.`;

/**
 * Explain why a string failed to parse.
 */
export async function explainParseError(grammar, inputStr, steps, error) {
  const grammarStr = grammar.productions.map(p => `${p.lhs} → ${p.rhs.join(' ')}`).join('\n');
  const lastSteps = steps.slice(-5).map(s => `Step ${s.step}: Stack=[${s.stack}] Input=[${s.input}] Action=[${s.action}]`).join('\n');

  const prompt = `The following Context-Free Grammar failed to parse the input string "${inputStr}".

**Grammar:**
\`\`\`
${grammarStr}
\`\`\`

**Error:** ${error}

**Last parsing steps:**
\`\`\`
${lastSteps}
\`\`\`

Please explain:
1. WHY this string cannot be derived from this grammar.
2. What the parser was trying to do when it failed.
3. If possible, suggest a similar string that WOULD be accepted.`;

  return await callLLM(SYSTEM_PROMPT, prompt);
}

/**
 * Analyze grammar conflicts and suggest fixes.
 */
export async function analyzeConflicts(grammar, conflicts, method) {
  const grammarStr = grammar.productions.map(p => `${p.lhs} → ${p.rhs.join(' ')}`).join('\n');
  const conflictStr = conflicts.map(c => c.message).join('\n');

  const prompt = `The following grammar has ${method} conflicts:

**Grammar:**
\`\`\`
${grammarStr}
\`\`\`

**Conflicts found:**
\`\`\`
${conflictStr}
\`\`\`

Please:
1. Explain each conflict and why it occurs in terms of formal language theory.
2. Classify the type of ambiguity (inherent vs. removable).
3. Suggest specific grammar transformations to eliminate the conflicts.
4. Show the transformed grammar that would be conflict-free.`;

  return await callLLM(SYSTEM_PROMPT, prompt);
}

/**
 * Generate step-by-step LL(1) transformation instructions.
 */
export async function suggestLL1Transformations(grammar) {
  const grammarStr = grammar.productions.map(p => `${p.lhs} → ${p.rhs.join(' ')}`).join('\n');

  const prompt = `Analyze this grammar and provide step-by-step instructions to transform it into an equivalent LL(1) grammar:

**Grammar:**
\`\`\`
${grammarStr}
\`\`\`

Please provide:
1. **Left Recursion Detection:** Identify any direct or indirect left recursion.
2. **Left Recursion Elimination:** Show the step-by-step transformation for each left-recursive rule.
3. **Left Factoring:** Identify common prefixes and show the factoring steps.
4. **Final Grammar:** Show the complete transformed grammar.
5. **Verification:** Explain why the result is LL(1) (or if it still isn't, explain why).`;

  return await callLLM(SYSTEM_PROMPT, prompt);
}
