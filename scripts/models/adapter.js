/**
 * AI 模型适配器基类
 * 定义了所有 AI 模型适配器的通用接口
 */

class AIModelAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  
  /**
   * 获取 API 端点
   * 子类必须实现此方法
   */
  getEndpoint() {
    throw new Error('子类必须实现 getEndpoint 方法');
  }
  
  /**
   * 构建请求体
   * 子类必须实现此方法
   */
  buildRequestBody(text) {
    throw new Error('子类必须实现 buildRequestBody 方法');
  }
  
  /**
   * 解析响应
   * 子类必须实现此方法
   */
  parseResponse(response) {
    throw new Error('子类必须实现 parseResponse 方法');
  }
  
  /**
   * 生成摘要和核心观点
   * 这是主要的调用方法
   */
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
        throw new Error(`API 请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('AI API 调用失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取请求头
   * 子类可以覆盖此方法以自定义请求头
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * 生成提示词
   * 可以被子类覆盖以自定义提示词
   */
  generatePrompt(text) {
    return `请分析以下文章内容，生成一个简洁的摘要（3-5句话）和3-5个核心观点。

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
  
  /**
   * 从文本中提取 JSON
   */
  extractJSON(text) {
    // 尝试直接解析
    try {
      return JSON.parse(text);
    } catch (e) {
      // 尝试提取 JSON 代码块
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // 尝试提取花括号内容
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        return JSON.parse(braceMatch[0]);
      }
      
      throw new Error('无法从响应中提取 JSON');
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIModelAdapter;
}

