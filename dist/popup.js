/******/ (() => { // webpackBootstrap
/*!******************!*\
  !*** ./popup.js ***!
  \******************/
/**
 * Popup 界面逻辑
 * 处理用户交互和状态管理
 */

/**
 * 安全地发送消息给 background service worker
 * 包含重试逻辑以处理 service worker 未就绪的情况
 */
async function sendMessageSafely(message, retries = 3, delay = 100) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      // 检查是否是 "Receiving end does not exist" 错误
      if (error.message.includes('Receiving end does not exist')) {
        console.warn(`Service worker 未就绪，重试 ${i + 1}/${retries}...`);
        
        if (i < retries - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
      }
      
      // 其他错误或最后一次重试失败，抛出错误
      throw error;
    }
  }
  
  throw new Error('无法连接到扩展后台服务，请重新加载扩展');
}

// 状态管理
const STATE = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
  NO_CONFIG: 'noConfig'
};

let currentState = STATE.IDLE;
let currentArticle = null;
let currentTags = [];

// DOM 元素
const elements = {
  // 状态元素
  idleState: document.getElementById('idleState'),
  processingState: document.getElementById('processingState'),
  successState: document.getElementById('successState'),
  errorState: document.getElementById('errorState'),
  noConfigState: document.getElementById('noConfigState'),
  
  // 按钮
  saveBtn: document.getElementById('saveBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  viewLibraryBtn: document.getElementById('viewLibraryBtn'),
  closeBtn: document.getElementById('closeBtn'),
  retryBtn: document.getElementById('retryBtn'),
  goToSettingsBtn: document.getElementById('goToSettingsBtn'),
  viewAllLink: document.getElementById('viewAllLink'),
  
  // 信息显示
  processingDetail: document.getElementById('processingDetail'),
  errorMessage: document.getElementById('errorMessage'),
  articleTitle: document.getElementById('articleTitle'),
  articleUrl: document.getElementById('articleUrl'),
  
  // 保存选项
  saveOriginalCheckbox: document.getElementById('saveOriginalCheckbox'),
  saveImagesCheckbox: document.getElementById('saveImagesCheckbox'),
  
  // 标签相关
  tagInput: document.getElementById('tagInput'),
  tagList: document.getElementById('tagList'),
  suggestedTagsArea: document.getElementById('suggestedTagsArea'),
  suggestedTagsList: document.getElementById('suggestedTagsList')
};

/**
 * 切换状态显示
 */
function setState(state) {
  // 隐藏所有状态
  Object.values(elements).forEach(el => {
    if (el && el.classList && el.classList.contains('state')) {
      el.classList.add('hidden');
    }
  });
  
  // 显示当前状态
  currentState = state;
  switch (state) {
    case STATE.IDLE:
      elements.idleState.classList.remove('hidden');
      break;
    case STATE.PROCESSING:
      elements.processingState.classList.remove('hidden');
      break;
    case STATE.SUCCESS:
      elements.successState.classList.remove('hidden');
      break;
    case STATE.ERROR:
      elements.errorState.classList.remove('hidden');
      break;
    case STATE.NO_CONFIG:
      elements.noConfigState.classList.remove('hidden');
      break;
  }
}

/**
 * 检查配置是否完整
 */
async function checkConfiguration() {
  try {
    const result = await chrome.storage.local.get([
      'aiModel',
      'apiKey', // 旧版本兼容
      'geminiApiKey',
      'openaiApiKey',
      'claudeApiKey',
      'deepseekApiKey',
      'qwenApiKey'
    ]);
    
    if (!result.aiModel) {
      return false;
    }
    
    // 根据选择的模型检查对应的 API Key
    const apiKeyMap = {
      'gemini': result.geminiApiKey,
      'openai': result.openaiApiKey,
      'claude': result.claudeApiKey,
      'deepseek': result.deepseekApiKey,
      'qwen': result.qwenApiKey
    };
    
    const modelApiKey = apiKeyMap[result.aiModel];
    
    // 向后兼容：如果新 key 不存在，检查旧的 apiKey
    return !!(modelApiKey || result.apiKey);
  } catch (error) {
    console.error('检查配置失败:', error);
    return false;
  }
}

/**
 * 保存文章
 */
async function saveArticle() {
  // 检查配置
  const hasConfig = await checkConfiguration();
  if (!hasConfig) {
    setState(STATE.NO_CONFIG);
    return;
  }
  
  setState(STATE.PROCESSING);
  
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      throw new Error('无法获取当前标签页');
    }
    
    // 根据 URL 判断内容类型，显示不同的提示
    const url = tab.url || '';
    let processingText = '提取内容中...';
    
    if (url.endsWith('.pdf') || url.includes('.pdf')) {
      processingText = '提取 PDF 文档内容中...';
    } else if (url.includes('bilibili.com/video/')) {
      processingText = '提取 Bilibili 视频内容中...';
    } else if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      processingText = '提取 YouTube 视频内容中...';
    } else {
      processingText = '提取文章内容中...';
    }
    
    elements.processingDetail.textContent = processingText;
    
    // 获取用户选择的保存选项
    const saveOriginalContent = elements.saveOriginalCheckbox.checked;
    const saveImages = elements.saveImagesCheckbox.checked;
    
    // 向 background.js 发送保存请求（使用安全发送函数）
    const response = await sendMessageSafely({
      action: 'saveArticle',
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      saveOriginalContent: saveOriginalContent,
      saveImages: saveImages
    });
    
    if (response.success) {
      currentArticle = response.article;
      currentTags = response.article.tags || [];
      showSuccess();
    } else {
      throw new Error(response.error || '保存失败');
    }
  } catch (error) {
    console.error('保存文章失败:', error);
    showError(error.message);
  }
}

/**
 * 显示成功状态
 */
function showSuccess() {
  setState(STATE.SUCCESS);
  
  if (currentArticle) {
    elements.articleTitle.textContent = currentArticle.title;
    elements.articleUrl.textContent = currentArticle.url;
    renderTags();
    renderSuggestedTags();
  }
}

/**
 * 渲染 AI 推荐标签
 */
function renderSuggestedTags() {
  if (!currentArticle || !currentArticle.suggestedTags || currentArticle.suggestedTags.length === 0) {
    elements.suggestedTagsArea.classList.add('hidden');
    return;
  }
  
  elements.suggestedTagsArea.classList.remove('hidden');
  elements.suggestedTagsList.innerHTML = '';
  
  currentArticle.suggestedTags.forEach(tag => {
    // 如果标签已被添加，不显示
    if (currentTags.includes(tag)) {
      return;
    }
    
    const tagEl = document.createElement('button');
    tagEl.className = 'suggested-tag';
    tagEl.textContent = tag;
    tagEl.dataset.tag = tag;
    elements.suggestedTagsList.appendChild(tagEl);
  });
}

/**
 * 显示错误状态
 */
function showError(message) {
  setState(STATE.ERROR);
  elements.errorMessage.textContent = message || '发生未知错误';
}

/**
 * 渲染标签列表
 */
function renderTags() {
  elements.tagList.innerHTML = '';
  
  currentTags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.innerHTML = `
      ${tag}
      <span class="tag-remove" data-tag="${tag}">×</span>
    `;
    elements.tagList.appendChild(tagEl);
  });
}

/**
 * 添加标签
 */
async function addTag(tag) {
  tag = tag.trim();
  if (!tag || currentTags.includes(tag)) {
    return;
  }
  
  currentTags.push(tag);
  
  // 更新存储
  if (currentArticle) {
    try {
      await sendMessageSafely({
        action: 'updateArticleTags',
        articleId: currentArticle.id,
        tags: currentTags
      });
      renderTags();
      renderSuggestedTags(); // 重新渲染推荐标签（移除已添加的）
      elements.tagInput.value = '';
    } catch (error) {
      console.error('添加标签失败:', error);
    }
  }
}

/**
 * 删除标签
 */
async function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  
  // 更新存储
  if (currentArticle) {
    try {
      await sendMessageSafely({
        action: 'updateArticleTags',
        articleId: currentArticle.id,
        tags: currentTags
      });
      renderTags();
      renderSuggestedTags(); // 重新渲染推荐标签（可能重新显示）
    } catch (error) {
      console.error('删除标签失败:', error);
    }
  }
}

/**
 * 打开阅读库
 */
function openDashboard() {
  chrome.tabs.create({ url: 'dashboard.html' });
  window.close();
}

/**
 * 打开设置
 */
function openSettings() {
  chrome.tabs.create({ url: 'settings.html' });
  window.close();
}

// 事件监听器
elements.saveBtn.addEventListener('click', saveArticle);
elements.retryBtn.addEventListener('click', saveArticle);
elements.settingsBtn.addEventListener('click', openSettings);
elements.goToSettingsBtn.addEventListener('click', openSettings);
elements.viewLibraryBtn.addEventListener('click', openDashboard);
elements.viewAllLink.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard();
});
elements.closeBtn.addEventListener('click', () => window.close());

// 标签输入处理
elements.tagInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addTag(e.target.value);
  }
});

// 标签删除处理
elements.tagList.addEventListener('click', (e) => {
  if (e.target.classList.contains('tag-remove')) {
    const tag = e.target.dataset.tag;
    removeTag(tag);
  }
});

// AI 推荐标签点击处理
elements.suggestedTagsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('suggested-tag')) {
    const tag = e.target.dataset.tag;
    addTag(tag);
  }
});

/**
 * 加载保存选项默认值
 */
async function loadSaveOptions() {
  try {
    const settings = await chrome.storage.local.get(['saveOriginalContent', 'saveImages']);
    
    // 设置复选框状态（默认都勾选）
    elements.saveOriginalCheckbox.checked = settings.saveOriginalContent !== undefined ? settings.saveOriginalContent : true;
    elements.saveImagesCheckbox.checked = settings.saveImages !== undefined ? settings.saveImages : true;
  } catch (error) {
    console.error('加载保存选项失败:', error);
    // 使用默认值
    elements.saveOriginalCheckbox.checked = true;
    elements.saveImagesCheckbox.checked = true;
  }
}

// 初始化
(async function init() {
  // 加载保存选项默认值
  await loadSaveOptions();
  
  const hasConfig = await checkConfiguration();
  if (!hasConfig) {
    setState(STATE.NO_CONFIG);
  } else {
    setState(STATE.IDLE);
  }
})();


/******/ })()
;
//# sourceMappingURL=popup.js.map