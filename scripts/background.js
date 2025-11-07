/**
 * Background Service Worker
 * 处理消息路由、AI API 调用和数据管理
 */

// ============================================
// AI 模型适配器类（直接包含在此文件中）
// ============================================

/**
 * 默认提示词模板
 */
const DEFAULT_PROMPT_TEMPLATE = `请分析以下文章内容，生成一个约 {{SUMMARY_LENGTH}} 字的简洁中文摘要、{{TAG_COUNT}} 个核心观点和 {{TAG_COUNT}} 个相关标签。

请按照以下 JSON 格式返回结果：
{
  "summary": "文章摘要内容...",
  "keyPoints": [
    "核心观点1",
    "核心观点2",
    "核心观点3"
  ],
  "tags": [
    "标签1",
    "标签2",
    "标签3"
  ]
}

文章内容：
{{TEXT}}

请直接返回 JSON 格式的结果，不要包含其他文字。`;

/**
 * Google Gemini 模型适配器
 */
class GeminiAdapter {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.modelName = 'gemini-2.5-flash';
    this.config = {
      summaryLength: config.summaryLength || 200,
      tagCount: config.tagCount || 3,
      enableAutoTags: config.enableAutoTags !== false,
      customPrompt: config.customPrompt || null,
      enableCustomPrompt: config.enableCustomPrompt || false
    };
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
    // 使用自定义提示词或默认提示词
    const template = this.config.enableCustomPrompt && this.config.customPrompt 
      ? this.config.customPrompt 
      : DEFAULT_PROMPT_TEMPLATE;
    
    // 替换模板变量
    return template
      .replace(/\{\{TEXT\}\}/g, text.substring(0, 8000))
      .replace(/\{\{SUMMARY_LENGTH\}\}/g, this.config.summaryLength)
      .replace(/\{\{TAG_COUNT\}\}/g, this.config.tagCount);
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
        keyPoints: result.keyPoints || [],
        suggestedTags: this.config.enableAutoTags ? (result.tags || []) : []
      };
    } catch (error) {
      console.error('❌ 解析 Gemini 响应失败:', error);
      console.error('❌ 原始数据:', data);
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

/**
 * OpenAI GPT 模型适配器
 */
class OpenAIAdapter {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.modelName = 'gpt-3.5-turbo';
    this.config = {
      summaryLength: config.summaryLength || 200,
      tagCount: config.tagCount || 3,
      enableAutoTags: config.enableAutoTags !== false,
      customPrompt: config.customPrompt || null,
      enableCustomPrompt: config.enableCustomPrompt || false
    };
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
    const template = this.config.enableCustomPrompt && this.config.customPrompt 
      ? this.config.customPrompt 
      : DEFAULT_PROMPT_TEMPLATE;
    
    return template
      .replace(/\{\{TEXT\}\}/g, text.substring(0, 8000))
      .replace(/\{\{SUMMARY_LENGTH\}\}/g, this.config.summaryLength)
      .replace(/\{\{TAG_COUNT\}\}/g, this.config.tagCount);
  }
  
  buildRequestBody(text) {
    const prompt = this.generatePrompt(text);
    
    const systemPrompt = this.config.enableAutoTags
      ? '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点，并能推荐相关标签。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。'
      : '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。';
    
    return {
      model: this.modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt
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
        keyPoints: result.keyPoints || [],
        suggestedTags: this.config.enableAutoTags ? (result.tags || []) : []
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

/**
 * Anthropic Claude 模型适配器
 */
class ClaudeAdapter {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.modelName = 'claude-3-haiku-20240307';
    this.config = {
      summaryLength: config.summaryLength || 200,
      tagCount: config.tagCount || 3,
      enableAutoTags: config.enableAutoTags !== false,
      customPrompt: config.customPrompt || null,
      enableCustomPrompt: config.enableCustomPrompt || false
    };
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
    const template = this.config.enableCustomPrompt && this.config.customPrompt 
      ? this.config.customPrompt 
      : DEFAULT_PROMPT_TEMPLATE;
    
    return template
      .replace(/\{\{TEXT\}\}/g, text.substring(0, 8000))
      .replace(/\{\{SUMMARY_LENGTH\}\}/g, this.config.summaryLength)
      .replace(/\{\{TAG_COUNT\}\}/g, this.config.tagCount);
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
        keyPoints: result.keyPoints || [],
        suggestedTags: this.config.enableAutoTags ? (result.tags || []) : []
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

/**
 * 通义千问模型适配器
 */
class QwenAdapter {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.modelName = 'qwen-plus';
    this.config = {
      summaryLength: config.summaryLength || 200,
      tagCount: config.tagCount || 3,
      enableAutoTags: config.enableAutoTags !== false,
      customPrompt: config.customPrompt || null,
      enableCustomPrompt: config.enableCustomPrompt || false
    };
  }
  
  getEndpoint() {
    return 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  }
  
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }
  
  generatePrompt(text) {
    const template = this.config.enableCustomPrompt && this.config.customPrompt 
      ? this.config.customPrompt 
      : DEFAULT_PROMPT_TEMPLATE;
    
    return template
      .replace(/\{\{TEXT\}\}/g, text.substring(0, 8000))
      .replace(/\{\{SUMMARY_LENGTH\}\}/g, this.config.summaryLength)
      .replace(/\{\{TAG_COUNT\}\}/g, this.config.tagCount);
  }
  
  buildRequestBody(text) {
    const prompt = this.generatePrompt(text);
    
    const systemPrompt = this.config.enableAutoTags
      ? '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点，并能推荐相关标签。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。'
      : '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。';
    
    return {
      model: this.modelName,
      input: {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: 0.4,
        max_tokens: 1024,
        result_format: 'message'
      }
    };
  }
  
  parseResponse(data) {
    try {
      if (!data.output || !data.output.choices || data.output.choices.length === 0) {
        throw new Error('API 返回了空结果');
      }
      
      const choice = data.output.choices[0];
      if (!choice.message || !choice.message.content) {
        throw new Error('API 返回格式错误');
      }
      
      const text = choice.message.content;
      const result = this.extractJSON(text);
      
      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || [],
        suggestedTags: this.config.enableAutoTags ? (result.tags || []) : []
      };
    } catch (error) {
      console.error('解析通义千问响应失败:', error);
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
        throw new Error(`通义千问 API 请求失败: ${response.status} - ${errorData.message || response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('通义千问 API 调用失败:', error);
      throw error;
    }
  }
}

/**
 * DeepSeek 模型适配器
 */
class DeepSeekAdapter {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.modelName = 'deepseek-chat';
    this.config = {
      summaryLength: config.summaryLength || 200,
      tagCount: config.tagCount || 3,
      enableAutoTags: config.enableAutoTags !== false,
      customPrompt: config.customPrompt || null,
      enableCustomPrompt: config.enableCustomPrompt || false
    };
  }
  
  getEndpoint() {
    return 'https://api.deepseek.com/v1/chat/completions';
  }
  
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }
  
  generatePrompt(text) {
    const template = this.config.enableCustomPrompt && this.config.customPrompt 
      ? this.config.customPrompt 
      : DEFAULT_PROMPT_TEMPLATE;
    
    return template
      .replace(/\{\{TEXT\}\}/g, text.substring(0, 8000))
      .replace(/\{\{SUMMARY_LENGTH\}\}/g, this.config.summaryLength)
      .replace(/\{\{TAG_COUNT\}\}/g, this.config.tagCount);
  }
  
  buildRequestBody(text) {
    const prompt = this.generatePrompt(text);
    
    const systemPrompt = this.config.enableAutoTags
      ? '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点，并能推荐相关标签。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。'
      : '你是一个专业的文章摘要助手，擅长提取文章的核心内容和关键观点。请始终用中文回复，并严格按照要求的 JSON 格式返回结果。';
    
    return {
      model: this.modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1024
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
      
      const text = choice.message.content;
      const result = this.extractJSON(text);
      
      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || [],
        suggestedTags: this.config.enableAutoTags ? (result.tags || []) : []
      };
    } catch (error) {
      console.error('解析 DeepSeek 响应失败:', error);
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
        throw new Error(`DeepSeek API 请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('DeepSeek API 调用失败:', error);
      throw error;
    }
  }
}

// ============================================
// 适配器工厂函数
// ============================================

/**
 * 创建 AI 适配器工厂
 */
function createAIAdapter(modelType, apiKey, config = {}) {
  switch (modelType) {
    case 'gemini':
      return new GeminiAdapter(apiKey, config);
    case 'openai':
      return new OpenAIAdapter(apiKey, config);
    case 'claude':
      return new ClaudeAdapter(apiKey, config);
    case 'deepseek':
      return new DeepSeekAdapter(apiKey, config);
    case 'qwen':
      return new QwenAdapter(apiKey, config);
    default:
      throw new Error(`不支持的模型类型: ${modelType}`);
  }
}

/**
 * 生成唯一 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 获取存储的文章列表
 */
async function getArticles() {
  try {
    const result = await chrome.storage.local.get(['articles']);
    return result.articles || [];
  } catch (error) {
    console.error('获取文章列表失败:', error);
    return [];
  }
}

/**
 * 保存文章到存储
 */
async function saveArticleToStorage(article) {
  try {
    const articles = await getArticles();
    articles.unshift(article); // 新文章添加到开头
    
    await chrome.storage.local.set({ articles });
    return true;
  } catch (error) {
    console.error('保存文章失败:', error);
    throw error;
  }
}

/**
 * 更新文章标签
 */
async function updateArticleTags(articleId, tags) {
  try {
    const articles = await getArticles();
    const article = articles.find(a => a.id === articleId);
    
    if (article) {
      article.tags = tags;
      await chrome.storage.local.set({ articles });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('更新文章标签失败:', error);
    throw error;
  }
}

/**
 * 处理保存文章请求
 */
async function handleSaveArticle(tabId, url, title, saveOriginalContent, saveImages) {
  try {
    // 1. 从 content script 提取内容
    const contentResponse = await chrome.tabs.sendMessage(tabId, {
      action: 'extractContent'
    });
    
    if (!contentResponse.success) {
      throw new Error(contentResponse.error || '提取内容失败');
    }
    
    const extractedContent = contentResponse.content;
    
    // 2. 获取用户设置
    const settings = await chrome.storage.local.get([
      'aiModel',
      // 旧版本的单一 apiKey（用于向后兼容）
      'apiKey',
      // 新版本的多模型 API Keys
      'geminiApiKey',
      'openaiApiKey',
      'claudeApiKey',
      'deepseekApiKey',
      'qwenApiKey',
      'summaryLength',
      'tagCount',
      'enableAutoTags',
      'enableCustomPrompt',
      'customPrompt',
      'saveOriginalContent',
      'saveImages'
    ]);
    
    // 使用传入的参数，如果未提供则使用设置中的默认值
    const shouldSaveOriginal = saveOriginalContent !== undefined ? saveOriginalContent : (settings.saveOriginalContent !== undefined ? settings.saveOriginalContent : true);
    const shouldSaveImages = saveImages !== undefined ? saveImages : (settings.saveImages !== undefined ? settings.saveImages : true);
    
    console.log('最终保存选项 - 原文:', shouldSaveOriginal, '图片:', shouldSaveImages);
    
    if (!settings.aiModel) {
      throw new Error('未配置 AI 模型');
    }
    
    // 根据选择的模型获取对应的 API Key
    const apiKeyMap = {
      'gemini': settings.geminiApiKey,
      'openai': settings.openaiApiKey,
      'claude': settings.claudeApiKey,
      'deepseek': settings.deepseekApiKey,
      'qwen': settings.qwenApiKey
    };
    
    let apiKey = apiKeyMap[settings.aiModel];
    
    // 向后兼容：如果新 key 不存在，尝试使用旧的 apiKey
    if (!apiKey && settings.apiKey) {
      apiKey = settings.apiKey;
      console.log('使用旧版 API Key（向后兼容）');
    }
    
    if (!apiKey) {
      const modelNames = {
        'gemini': 'Google Gemini',
        'openai': 'OpenAI',
        'claude': 'Anthropic Claude',
        'deepseek': 'DeepSeek',
        'qwen': '通义千问'
      };
      throw new Error(`未配置 ${modelNames[settings.aiModel] || settings.aiModel} 的 API Key，请前往设置页面配置`);
    }
    
    // 3. 构建适配器配置
    const adapterConfig = {
      summaryLength: settings.summaryLength || 200,
      tagCount: settings.tagCount || 3,
      enableAutoTags: settings.enableAutoTags !== false,
      enableCustomPrompt: settings.enableCustomPrompt || false,
      customPrompt: settings.customPrompt || null
    };
    
    // 4. 检测内容类型
    const contentType = extractedContent.type || 'webpage';
    const isVideo = contentType.startsWith('video-');
    
    console.log('内容类型:', contentType);
    
    // 5. 处理图片和原文（根据用户选择和内容类型）
    let htmlContent = extractedContent.htmlContent || '';
    let textContent = extractedContent.content || '';
    
    // 对于非视频内容，按照原有逻辑处理
    if (!isVideo) {
      console.log('原始HTML长度:', htmlContent.length);
      
      if (!shouldSaveImages && htmlContent) {
        // 移除所有图片标签
        htmlContent = htmlContent.replace(/<img[^>]*>/gi, '');
        // 移除包含图片的 figure 标签
        htmlContent = htmlContent.replace(/<figure[^>]*>.*?<\/figure>/gi, '');
        console.log('移除图片后HTML长度:', htmlContent.length);
      }
      
      if (!shouldSaveOriginal) {
        // 不保存原文，清空内容
        textContent = '';
        htmlContent = '';
        console.log('已清空原文内容，仅保存摘要');
      }
    }
    
    // 6. 调用 AI 生成摘要、核心观点和标签
    const adapter = createAIAdapter(settings.aiModel, apiKey, adapterConfig);
    const aiResult = await adapter.generateSummary(textContent);
    
    // 7. 构建文章/视频对象
    const article = {
      id: generateId(),
      type: contentType,
      title: extractedContent.title || title,
      url: url,
      source: extractedContent.siteName || (extractedContent.videoInfo?.author) || new URL(url).hostname,
      dateAdded: new Date().toISOString(),
      content: textContent,
      htmlContent: htmlContent,
      excerpt: extractedContent.excerpt || '',
      summary: aiResult.summary,
      keyPoints: aiResult.keyPoints,
      tags: [],
      suggestedTags: aiResult.suggestedTags || [],
      byline: extractedContent.byline || extractedContent.videoInfo?.author || '',
      hasOriginalContent: shouldSaveOriginal
    };
    
    // 对于视频内容，添加额外的元数据
    if (isVideo) {
      article.videoMetadata = {
        duration: extractedContent.metadata?.duration || 0,
        author: extractedContent.metadata?.author || '',
        cover: extractedContent.metadata?.cover || '',
        pubdate: extractedContent.metadata?.pubdate || '',
        tags: extractedContent.metadata?.tags || [],
        stats: extractedContent.metadata?.stats || {},
        subtitles: extractedContent.subtitles || { available: false },
        comments: extractedContent.comments || null
      };
      
      // 视频描述作为excerpt
      if (extractedContent.videoInfo?.description) {
        article.excerpt = extractedContent.videoInfo.description.substring(0, 300);
      }
    }
    
    // 6. 保存到存储
    await saveArticleToStorage(article);
    
    return {
      success: true,
      article: article
    };
  } catch (error) {
    console.error('保存文章失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 消息监听器
 */
// 确保 service worker 立即响应消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📬 Background 收到消息:', request.action || request);
  
    // 保存文章
    if (request.action === 'saveArticle') {
      // 获取 tabId：优先从 request 获取（popup 发送），其次从 sender 获取（content script 发送）
      const tabId = request.tabId || sender.tab?.id;
      
      if (!tabId) {
        console.error('无法获取 tabId');
        sendResponse({ success: false, error: '无法获取标签页ID' });
        return true;
      }
      
      console.log('保存文章请求 - 来源:', sender.tab ? 'content script' : 'popup', 'tabId:', tabId, 'url:', request.url);
      console.log('保存选项 - 原文:', request.saveOriginalContent, '图片:', request.saveImages);
      
      handleSaveArticle(tabId, request.url, request.title, request.saveOriginalContent, request.saveImages)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启
  }
  
  // 更新文章标签
  if (request.action === 'updateArticleTags') {
    updateArticleTags(request.articleId, request.tags)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // 获取所有文章
  if (request.action === 'getArticles') {
    getArticles()
      .then(articles => sendResponse({ success: true, articles }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // 删除文章
  if (request.action === 'deleteArticle') {
    getArticles()
      .then(async (articles) => {
        const filtered = articles.filter(a => a.id !== request.articleId);
        await chrome.storage.local.set({ articles: filtered });
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  return false;
});

/**
 * 扩展安装时的初始化
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Digest AI 已安装');
    
    // 打开欢迎页面或设置页面
    chrome.tabs.create({ url: 'settings.html' });
  } else if (details.reason === 'update') {
    console.log('Digest AI 已更新到版本:', chrome.runtime.getManifest().version);
  }
});

console.log('Background service worker 已启动');

