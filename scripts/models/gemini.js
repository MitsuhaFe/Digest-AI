/**
 * Google Gemini 模型适配器
 */

class GeminiAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.modelName = 'gemini-2.5-flash';
  }
  
  getEndpoint() {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
  }
  
  getHeaders() {
    return {
      'Content-Type': 'application/json'
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
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192  // 增加到8192以容纳思考过程和实际响应
      }
    };
  }
  
  parseResponse(data) {
    try {
      // 添加详细的调试日志
      console.log('🔍 Gemini API 原始响应:', JSON.stringify(data, null, 2));
      
      if (!data.candidates || data.candidates.length === 0) {
        console.error('❌ 没有候选结果:', data);
        throw new Error('API 返回了空结果');
      }
      
      const candidate = data.candidates[0];
      console.log('🔍 候选结果完整结构:', candidate);
      console.log('🔍 候选结果的所有键:', Object.keys(candidate));
      if (candidate.content) {
        console.log('🔍 content 内容:', candidate.content);
        console.log('🔍 content 的键:', Object.keys(candidate.content));
      }
      
      // 检查新格式：可能是 candidate.content.parts 或者其他结构
      let text = '';
      
      // 尝试多种可能的响应格式
      
      // 1. 标准格式：candidate.content.parts[].text
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        console.log('🔍 找到 parts 数组，长度:', candidate.content.parts.length);
        // Gemini 2.5 可能有多个 parts，包括 thought 和实际响应
        // 尝试找到包含 text 的 part
        for (let i = 0; i < candidate.content.parts.length; i++) {
          const part = candidate.content.parts[i];
          console.log(`🔍 检查 part[${i}]:`, part);
          if (part.text) {
            text = part.text;
            console.log(`✅ 在 parts[${i}] 中找到文本:`, text.substring(0, 100));
            break;
          }
        }
      }
      
      // 2. 直接文本字段
      if (!text && candidate.text) {
        text = candidate.text;
        console.log('✅ 使用直接文本格式');
      }
      
      // 3. Message 格式
      if (!text && candidate.message && candidate.message.content) {
        text = candidate.message.content;
        console.log('✅ 使用消息格式');
      }
      
      // 4. Output 字段 (某些模型可能使用)
      if (!text && candidate.output) {
        text = candidate.output;
        console.log('✅ 使用 output 字段');
      }
      
      // 5. 检查是否有 thoughts 和 response 分离的情况
      if (!text && candidate.content) {
        // 可能整个 content 就是文本
        if (typeof candidate.content === 'string') {
          text = candidate.content;
          console.log('✅ content 本身是字符串');
        }
      }
      
      if (!text) {
        console.error('❌ 无法找到文本内容');
        console.error('候选完整对象:', JSON.stringify(candidate, null, 2));
        throw new Error('API 返回格式错误：无法找到文本内容。请查看控制台日志获取详细信息。');
      }
      
      console.log('📝 提取的文本:', text);
      
      if (!text) {
        throw new Error('API 返回的文本内容为空');
      }
      
      const result = this.extractJSON(text);
      console.log('📊 解析的JSON结果:', result);
      
      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || []
      };
    } catch (error) {
      console.error('❌ 解析 Gemini 响应失败:', error);
      console.error('❌ 原始数据:', data);
      throw new Error('解析 AI 响应失败: ' + error.message);
    }
  }
  
  extractJSON(text) {
    console.log('🔧 开始提取JSON，原始文本:', text);
    
    // 1. 尝试直接解析
    try {
      const result = JSON.parse(text);
      console.log('✅ 直接解析成功');
      return result;
    } catch (e) {
      console.log('❌ 直接解析失败:', e.message);
    }
    
    // 2. 尝试提取 JSON 代码块（```json 格式）
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        console.log('🔧 找到JSON代码块，尝试解析');
        const result = JSON.parse(jsonMatch[1].trim());
        console.log('✅ JSON代码块解析成功');
        return result;
      }
    } catch (e) {
      console.log('❌ JSON代码块解析失败:', e.message);
    }
    
    // 3. 尝试提取普通代码块（``` 格式）
    try {
      const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        console.log('🔧 找到普通代码块，尝试解析');
        const result = JSON.parse(codeMatch[1].trim());
        console.log('✅ 普通代码块解析成功');
        return result;
      }
    } catch (e) {
      console.log('❌ 普通代码块解析失败:', e.message);
    }
    
    // 4. 尝试提取花括号内容（最宽松的匹配）
    try {
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        console.log('🔧 找到花括号内容，尝试解析');
        const result = JSON.parse(braceMatch[0]);
        console.log('✅ 花括号内容解析成功');
        return result;
      }
    } catch (e) {
      console.log('❌ 花括号内容解析失败:', e.message);
    }
    
    // 5. 尝试清理文本后再解析
    try {
      console.log('🔧 尝试清理文本后解析');
      // 移除常见的前后缀文字
      let cleaned = text
        .replace(/^[^{]*/, '') // 移除开头的非JSON内容
        .replace(/[^}]*$/, '') // 移除结尾的非JSON内容
        .trim();
      
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        const result = JSON.parse(cleaned);
        console.log('✅ 清理后解析成功');
        return result;
      }
    } catch (e) {
      console.log('❌ 清理后解析失败:', e.message);
    }
    
    // 6. 如果所有方法都失败，记录详细信息并抛出错误
    console.error('🚫 所有JSON提取方法都失败了');
    console.error('📝 原始文本长度:', text.length);
    console.error('📝 文本开头50字符:', text.substring(0, 50));
    console.error('📝 文本结尾50字符:', text.substring(Math.max(0, text.length - 50)));
    
    throw new Error('无法从响应中提取 JSON，请查看控制台获取详细信息');
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
        throw new Error(`Gemini API 请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('Gemini API 调用失败:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiAdapter;
}

