/**
 * Anthropic Claude 模型适配器
 */

class ClaudeAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.modelName = 'claude-3-haiku-20240307'; // 使用 Haiku，速度快且便宜
  }
  
  getEndpoint() {
    return 'https://api.anthropic.com/v1/messages';
  }
  
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
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
${text.substring(0, 8000)}

请直接返回 JSON 格式的结果，不要包含其他文字。`;
  }
  
  buildRequestBody(text) {
    const prompt = this.generatePrompt(text);
    
    return {
      model: this.modelName,
      max_tokens: 1024,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
  }
  
  parseResponse(data) {
    try {
      if (!data.content || data.content.length === 0) {
        throw new Error('API 返回了空结果');
      }
      
      const content = data.content[0];
      if (!content.text) {
        throw new Error('API 返回格式错误');
      }
      
      const text = content.text;
      const result = this.extractJSON(text);
      
      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || []
      };
    } catch (error) {
      console.error('解析 Claude 响应失败:', error);
      throw new Error('解析 AI 响应失败: ' + error.message);
    }
  }
  
  extractJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        return JSON.parse(braceMatch[0]);
      }
      
      throw new Error('无法从响应中提取 JSON');
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
        throw new Error(`Claude API 请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('Claude API 调用失败:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaudeAdapter;
}

