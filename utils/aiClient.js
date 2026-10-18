function hasAIKey() {
  return Boolean(process.env.AI_API_KEY?.trim());
}

async function createAICompletion(messages, options = {}) {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error('AI_API_KEY não configurada.');
    error.code = 'AI_KEY_MISSING';
    throw error;
  }

  const baseUrl = (process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs) || 25000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || process.env.AI_MODEL || 'nvidia/nvidia-nemotron-nano-9b-v2',
        messages,
        temperature: Number(options.temperature ?? 0.1),
        top_p: Number(options.topP ?? 0.9),
        max_tokens: Number(options.maxTokens ?? 900),
        stream: false
      }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || `Falha na IA HTTP ${response.status}.`);
      error.code = body?.error?.code || `HTTP_${response.status}`;
      throw error;
    }
    const content = body?.choices?.[0]?.message?.content;
    if (!content) {
      const error = new Error('IA retornou conteúdo vazio.');
      error.code = 'AI_EMPTY_RESPONSE';
      throw error;
    }
    return String(content).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch {}

  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(raw.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function analyzeTextWithAI(content, context, config) {
  if (!config.ai?.enabled || !hasAIKey()) return null;
  const prompt = [
    'Você é o motor de segurança do Mineiro Security para Discord.',
    'Analise a mensagem pelo contexto. Não puna conversa inocente, ironia leve ou erro de digitação.',
    'Detecte phishing, roubo de contas, golpe, assédio, ameaça, racismo/discriminação, spam e conteúdo perigoso.',
    'Responda somente JSON válido neste formato:',
    '{"risk":0-100,"category":"safe|spam|scam|phishing|harassment|threat|hate|malware|sexual|other","severity":"safe|low|medium|high|critical","reason":"motivo curto","recommendedAction":"ignore|log|delete|warn|timeout|kick|ban"}'
  ].join('\n');
  const raw = await createAICompletion([
    { role: 'system', content: prompt },
    { role: 'user', content: `Contexto:\n${context || 'sem contexto'}\n\nMensagem:\n${content}` }
  ], {
    maxTokens: config.ai.maxTokens || 900,
    temperature: 0.05,
    timeoutMs: 25000
  });
  return extractJson(raw);
}

module.exports = {
  analyzeTextWithAI,
  createAICompletion,
  extractJson,
  hasAIKey
};
