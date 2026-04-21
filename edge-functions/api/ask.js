// 文件位置: edge-functions/api/ask.js
export async function onRequestPost(context) {
  const { request, env } = context;

  // 处理 CORS 预检请求（浏览器会自动发送 OPTIONS 请求）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // 解析前端传来的请求体
    const { question, context } = await request.json();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Missing question' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 构建给大模型的提示词（融合展品知识库）
    const systemPrompt = `你是陕西历史博物馆的陶器专家。请根据以下展品信息回答用户问题，回答要专业、准确、简洁。
展品信息：
${context.map(item => `- ${item.title}（${item.era}）：${item.details}`).join('\n')}

如果问题超出陶器范围，请礼貌引导回陶器主题。`;

    // 从环境变量中读取 DeepSeek API 密钥
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('Missing DEEPSEEK_API_KEY environment variable');
    }

    // 调用 DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await response.json();

    // 如果 DeepSeek 返回错误，抛出异常
    if (data.error) {
      throw new Error(data.error.message);
    }

    // 返回成功响应
    return new Response(JSON.stringify({ answer: data.choices[0].message.content }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('LLM Error:', error);
    return new Response(JSON.stringify({ error: 'AI 服务暂时不可用，请稍后重试' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}