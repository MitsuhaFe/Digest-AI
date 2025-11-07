/**
 * OpenAI GPT 模型适配器
 */

class OpenAIAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.modelName = 'gpt-3.5-turbo';
  }
  
  getEndpoint() {
    return 'https://api.openai.com/v1/chat/completions';
  }
  
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }
  
  generatePrompt(text) {
    return `请分析以下文章内容，生成一个简洁的中文摘要（3-5句话）和3-5个核心观点。

请按照以下 JSON 格式返回结果：
{
  "summary": "文章摘要内容...",
  "keyPoints": [
    "核心观点1",
    "核心观点2",
    "核心观点3"
  ]
}

文章内容：
${text.substring(0, 8000)}`;
  }
  
  buildRequestBody(text) {
    const prompt = this.generatePrompt(text);
    
    return {
      model: this.modelName,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    };
  }
  
  parseResponse(data) {
    try {
      if (!data.choices || data.choices.length === 0) {
        throw new Error('API 返回了空结果');
      }
      
      const choice = data.choices[0];
      if (!choice.message || !choice.message.content) {
        throw new Error('API 返回格式错误');
      }
      
      const result = JSON.parse(choice.message.content);
      
      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || []
      };
    } catch (error) {
      console.error('解析 OpenAI 响应失败:', error);
      throw new Error('解析 AI 响应失败: ' + error.message);
    }
  }
  
  async generateSummary(text) {
    const endpoint = this.getEndpoint();
    const requestBody = this.buildRequestBody(text);
    const headers = this.getHeaders();
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API 请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('OpenAI API 调用失败:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenAIAdapter;
}

