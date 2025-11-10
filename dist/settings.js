/******/ (() => { // webpackBootstrap
/*!*********************!*\
  !*** ./settings.js ***!
  \*********************/
/**
 * Settings 页面逻辑
 * 处理设置的保存和加载
 */

// DOM 元素
const elements = {
  // 导航
  navItems: document.querySelectorAll('.nav-item'),
  sections: document.querySelectorAll('.settings-section'),
  
  // 基本设置
  themeSelect: document.getElementById('themeSelect'),
  fontSizeSelect: document.getElementById('fontSizeSelect'),
  
  // 云同步（Supabase）
  sbUrlText: document.getElementById('sbUrlText'),
  sbEmail: document.getElementById('sbEmail'),
  sbPassword: document.getElementById('sbPassword'),
  sbSignupBtn: document.getElementById('sbSignupBtn'),
  sbLoginBtn: document.getElementById('sbLoginBtn'),
  sbLogoutBtn: document.getElementById('sbLogoutBtn'),
  sbUploadBtn: document.getElementById('sbUploadBtn'),
  sbDownloadMergeBtn: document.getElementById('sbDownloadMergeBtn'),
  sbDownloadOverwriteBtn: document.getElementById('sbDownloadOverwriteBtn'),
  sbAuthStatus: document.getElementById('sbAuthStatus'),
  sbSyncStatus: document.getElementById('sbSyncStatus'),
  
  // AI 配置
  aiModelSelect: document.getElementById('aiModelSelect'),
  
  // 各模型的 API Key 输入框
  geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
  openaiApiKeyInput: document.getElementById('openaiApiKeyInput'),
  claudeApiKeyInput: document.getElementById('claudeApiKeyInput'),
  deepseekApiKeyInput: document.getElementById('deepseekApiKeyInput'),
  qwenApiKeyInput: document.getElementById('qwenApiKeyInput'),
  
  // API Key 显示/隐藏按钮（多个）
  toggleApiKeyButtons: document.querySelectorAll('.toggle-api-key'),
  
  // 高级设置
  summaryLengthRange: document.getElementById('summaryLengthRange'),
  summaryLengthValue: document.getElementById('summaryLengthValue'),
  tagCountSelect: document.getElementById('tagCountSelect'),
  enableAutoTagsCheckbox: document.getElementById('enableAutoTagsCheckbox'),
  
  // 自定义提示词
  enableCustomPromptCheckbox: document.getElementById('enableCustomPromptCheckbox'),
  customPromptSection: document.getElementById('customPromptSection'),
  customPromptInput: document.getElementById('customPromptInput'),
  resetPromptBtn: document.getElementById('resetPromptBtn'),
  
  // 内容保存设置
  saveOriginalContentCheckbox: document.getElementById('saveOriginalContentCheckbox'),
  saveImagesCheckbox: document.getElementById('saveImagesCheckbox'),
  enableFloatButtonCheckbox: document.getElementById('enableFloatButtonCheckbox'),
  
  // 按钮
  saveBasicSettingsBtn: document.getElementById('saveBasicSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  backToDashboard: document.getElementById('backToDashboard'),
  // 底部链接
  viewDocs: document.getElementById('viewDocs'),
  reportIssue: document.getElementById('reportIssue'),
  visitGithub: document.getElementById('visitGithub'),
  
  // 状态消息
  statusMessage: document.getElementById('statusMessage')
};

/**
 * 导航切换
 */
function switchSection(sectionId) {
  // 更新导航状态
  elements.navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === sectionId) {
      item.classList.add('active');
    }
  });
  
  // 更新内容显示
  elements.sections.forEach(section => {
    section.classList.remove('active');
    if (section.id === `${sectionId}-section`) {
      section.classList.add('active');
    }
  });
}

// 初始化侧边栏导航，增加云同步菜单项（若不存在）
(function ensureCloudNav() {
  const sidebarNav = document.querySelector('.nav-menu');
  if (sidebarNav && !sidebarNav.querySelector('[data-section="cloud"]')) {
    const link = document.createElement('a');
    link.href = '#cloud';
    link.className = 'nav-item';
    link.dataset.section = 'cloud';
    link.innerHTML = '<span class="icon">☁️</span><span>云同步</span>';
    sidebarNav.insertBefore(link, sidebarNav.querySelector('[data-section="about"]'));
    // 绑定事件
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection('cloud');
    });
  }
})();

/**
 * 根据选择的模型启用/禁用测试连接按钮
 */
function updateTestButtonState() {
  const selectedModel = elements.aiModelSelect.value;
  elements.testConnectionBtn.disabled = !selectedModel;
}

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
 * 加载设置
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'theme',
      'fontSize',
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
      'saveImages',
      'enableFloatButton'
    ]);
    
    // 基本设置
    if (settings.theme) {
      elements.themeSelect.value = settings.theme;
    }
    
    if (settings.fontSize) {
      elements.fontSizeSelect.value = settings.fontSize;
    }
    
    // AI 配置
    if (settings.aiModel) {
      elements.aiModelSelect.value = settings.aiModel;
      updateTestButtonState();
    }
    
    // 加载各模型的 API Key
    if (settings.geminiApiKey) {
      elements.geminiApiKeyInput.value = settings.geminiApiKey;
    }
    if (settings.openaiApiKey) {
      elements.openaiApiKeyInput.value = settings.openaiApiKey;
    }
    if (settings.claudeApiKey) {
      elements.claudeApiKeyInput.value = settings.claudeApiKey;
    }
    if (settings.deepseekApiKey) {
      elements.deepseekApiKeyInput.value = settings.deepseekApiKey;
    }
    if (settings.qwenApiKey) {
      elements.qwenApiKeyInput.value = settings.qwenApiKey;
    }
    
    // 向后兼容：如果有旧的 apiKey 且对应模型的新 key 不存在，迁移数据
    if (settings.apiKey && settings.aiModel) {
      const keyMap = {
        'gemini': 'geminiApiKey',
        'openai': 'openaiApiKey',
        'claude': 'claudeApiKey',
        'deepseek': 'deepseekApiKey',
        'qwen': 'qwenApiKey'
      };
      
      const newKeyName = keyMap[settings.aiModel];
      if (newKeyName && !settings[newKeyName]) {
        // 迁移旧 key 到对应的新 key
        const migrationData = {};
        migrationData[newKeyName] = settings.apiKey;
        await chrome.storage.local.set(migrationData);
        
        // 更新 UI
        const inputElement = elements[`${settings.aiModel}ApiKeyInput`];
        if (inputElement) {
          inputElement.value = settings.apiKey;
        }
        
        console.log(`已迁移 API Key: ${settings.aiModel} -> ${newKeyName}`);
      }
    }
    
    // 高级设置
    const summaryLength = settings.summaryLength || 200;
    elements.summaryLengthRange.value = summaryLength;
    elements.summaryLengthValue.textContent = summaryLength;
    
    const tagCount = settings.tagCount || 3;
    elements.tagCountSelect.value = tagCount;
    
    const enableAutoTags = settings.enableAutoTags !== undefined ? settings.enableAutoTags : true;
    elements.enableAutoTagsCheckbox.checked = enableAutoTags;
    
    // 自定义提示词
    const enableCustomPrompt = settings.enableCustomPrompt || false;
    elements.enableCustomPromptCheckbox.checked = enableCustomPrompt;
    
    const customPrompt = settings.customPrompt || DEFAULT_PROMPT_TEMPLATE;
    elements.customPromptInput.value = customPrompt;
    
    // 内容保存设置
    const saveOriginalContent = settings.saveOriginalContent !== undefined ? settings.saveOriginalContent : true;
    elements.saveOriginalContentCheckbox.checked = saveOriginalContent;
    
    const saveImages = settings.saveImages !== undefined ? settings.saveImages : true;
    elements.saveImagesCheckbox.checked = saveImages;
    
    const enableFloatButton = settings.enableFloatButton !== undefined ? settings.enableFloatButton : true;
    elements.enableFloatButtonCheckbox.checked = enableFloatButton;
    
    // 显示/隐藏自定义提示词区域
    if (enableCustomPrompt) {
      elements.customPromptSection.classList.remove('hidden');
    } else {
      elements.customPromptSection.classList.add('hidden');
    }
    
    // 注意：主题和字体会在 settings.html 的脚本中通过 loadSavedTheme() 和 loadSavedFontSize() 应用
    // 这里不需要重复应用，避免冲突
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

/**
 * 云同步 - UI 状态
 */
async function refreshSupabaseUI() {
  try {
    if (elements.sbUrlText && window.SupabaseSync?.constants?.url) {
      elements.sbUrlText.textContent = window.SupabaseSync.constants.url;
    }
    const user = await window.SupabaseSync.getCurrentUser().catch(() => null);
    if (user && user.email) {
      elements.sbAuthStatus.textContent = `已登录：${user.email}`;
    } else {
      elements.sbAuthStatus.textContent = '未登录';
    }
  } catch (e) {
    elements.sbAuthStatus.textContent = '状态获取失败';
  }
}

/**
 * 云同步 - 事件处理
 */
async function sbSignup() {
  try {
    const email = elements.sbEmail.value.trim();
    const password = elements.sbPassword.value;
    if (!email || !password) {
      showStatus('请输入邮箱和密码', 'error');
      return;
    }
    await window.SupabaseSync.signup(email, password);
    showStatus('注册成功，如需邮件验证请前往邮箱确认', 'success');
    await refreshSupabaseUI();
  } catch (e) {
    showStatus(`注册失败：${e.message}`, 'error');
  }
}

async function sbLogin() {
  try {
    const email = elements.sbEmail.value.trim();
    const password = elements.sbPassword.value;
    if (!email || !password) {
      showStatus('请输入邮箱和密码', 'error');
      return;
    }
    await window.SupabaseSync.login(email, password);
    showStatus('登录成功', 'success');
    await refreshSupabaseUI();
  } catch (e) {
    showStatus(`登录失败：${e.message}`, 'error');
  }
}

async function sbLogout() {
  try {
    await window.SupabaseSync.logout();
    showStatus('已退出登录', 'success');
    await refreshSupabaseUI();
  } catch (e) {
    showStatus(`退出失败：${e.message}`, 'error');
  }
}

async function sbUpload() {
  try {
    elements.sbSyncStatus.textContent = '正在上传...';
    const result = await window.SupabaseSync.uploadArticles();
    elements.sbSyncStatus.textContent = `上传完成：${result.inserted} 篇`;
    showStatus('上传完成', 'success');
  } catch (e) {
    elements.sbSyncStatus.textContent = `上传失败：${e.message}`;
    showStatus(`上传失败：${e.message}`, 'error');
  }
}

async function sbDownloadMerge() {
  try {
    elements.sbSyncStatus.textContent = '正在下载并合并...';
    const result = await window.SupabaseSync.downloadArticles({ overwrite: false });
    elements.sbSyncStatus.textContent = `下载完成：${result.downloaded} 篇（已合并）`;
    showStatus('下载完成（已合并）', 'success');
  } catch (e) {
    elements.sbSyncStatus.textContent = `下载失败：${e.message}`;
    showStatus(`下载失败：${e.message}`, 'error');
  }
}

async function sbDownloadOverwrite() {
  try {
    elements.sbSyncStatus.textContent = '正在下载并覆盖本地...';
    const result = await window.SupabaseSync.downloadArticles({ overwrite: true });
    elements.sbSyncStatus.textContent = `下载完成：${result.downloaded} 篇（已覆盖本地）`;
    showStatus('下载完成（已覆盖本地）', 'success');
  } catch (e) {
    elements.sbSyncStatus.textContent = `下载失败：${e.message}`;
    showStatus(`下载失败：${e.message}`, 'error');
  }
}

/**
 * 保存基本设置（主题和字体）
 */
async function saveBasicSettings() {
  try {
    const theme = elements.themeSelect.value;
    const fontSize = elements.fontSizeSelect.value;
    
    // 先应用并保存主题
    if (window.applyTheme) {
      await window.applyTheme(theme, true); // 明确保存到 storage
    }
    
    // 保存字体大小
    if (window.applyFontSize) {
      await window.applyFontSize(fontSize, true); // 明确保存到 storage
    }
    
    showStatus('基本设置已保存！', 'success');
  } catch (error) {
    console.error('保存基本设置失败:', error);
    showStatus('保存失败: ' + error.message, 'error');
  }
}

/**
 * 保存 AI 设置
 */
async function saveSettings() {
  try {
    const settings = {
      theme: elements.themeSelect.value,
      fontSize: elements.fontSizeSelect.value,
      aiModel: elements.aiModelSelect.value,
      // 保存各模型的 API Key
      geminiApiKey: elements.geminiApiKeyInput.value.trim(),
      openaiApiKey: elements.openaiApiKeyInput.value.trim(),
      claudeApiKey: elements.claudeApiKeyInput.value.trim(),
      deepseekApiKey: elements.deepseekApiKeyInput.value.trim(),
      qwenApiKey: elements.qwenApiKeyInput.value.trim(),
      summaryLength: parseInt(elements.summaryLengthRange.value),
      tagCount: parseInt(elements.tagCountSelect.value),
      enableAutoTags: elements.enableAutoTagsCheckbox.checked,
      enableCustomPrompt: elements.enableCustomPromptCheckbox.checked,
      customPrompt: elements.customPromptInput.value.trim() || DEFAULT_PROMPT_TEMPLATE,
      saveOriginalContent: elements.saveOriginalContentCheckbox.checked,
      saveImages: elements.saveImagesCheckbox.checked,
      enableFloatButton: elements.enableFloatButtonCheckbox.checked
    };
    
    // 验证必要字段：如果选择了模型，检查对应的 API Key 是否已配置
    if (settings.aiModel) {
      const keyMap = {
        'gemini': settings.geminiApiKey,
        'openai': settings.openaiApiKey,
        'claude': settings.claudeApiKey,
        'deepseek': settings.deepseekApiKey,
        'qwen': settings.qwenApiKey
      };
      
      if (!keyMap[settings.aiModel]) {
        const modelNames = {
          'gemini': 'Google Gemini',
          'openai': 'OpenAI',
          'claude': 'Anthropic Claude',
          'deepseek': 'DeepSeek',
          'qwen': '通义千问'
        };
        showStatus(`请先配置 ${modelNames[settings.aiModel]} 的 API Key`, 'error');
        return;
      }
    }
    
    // 验证自定义提示词
    if (settings.enableCustomPrompt && settings.customPrompt) {
      if (!settings.customPrompt.includes('{{TEXT}}')) {
        showStatus('自定义提示词必须包含 {{TEXT}} 变量', 'error');
        return;
      }
    }
    
    // 保存到存储
    await chrome.storage.local.set(settings);
    
    showStatus('设置已保存！', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showStatus('保存失败: ' + error.message, 'error');
  }
}

/**
 * 测试 API 连接
 */
async function testConnection() {
  const apiModel = elements.aiModelSelect.value;
  
  if (!apiModel) {
    showStatus('请先选择 AI 模型', 'error');
    return;
  }
  
  // 获取对应模型的 API Key
  const keyMap = {
    'gemini': elements.geminiApiKeyInput.value.trim(),
    'openai': elements.openaiApiKeyInput.value.trim(),
    'claude': elements.claudeApiKeyInput.value.trim(),
    'deepseek': elements.deepseekApiKeyInput.value.trim(),
    'qwen': elements.qwenApiKeyInput.value.trim()
  };
  
  const apiKey = keyMap[apiModel];
  
  if (!apiKey) {
    const modelNames = {
      'gemini': 'Google Gemini',
      'openai': 'OpenAI',
      'claude': 'Anthropic Claude',
      'deepseek': 'DeepSeek',
      'qwen': '通义千问'
    };
    showStatus(`请先输入 ${modelNames[apiModel]} 的 API Key`, 'error');
    return;
  }
  
  showStatus('正在测试连接...', 'info');
  elements.testConnectionBtn.disabled = true;
  
  try {
    // 这里应该调用实际的 API 测试
    // 暂时使用简单的验证
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showStatus('✅ 连接成功！API Key 有效', 'success');
  } catch (error) {
    showStatus('❌ 连接失败: ' + error.message, 'error');
  } finally {
    elements.testConnectionBtn.disabled = false;
  }
}

/**
 * 显示状态消息
 */
function showStatus(message, type = 'success') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.classList.remove('hidden');
  
  // 3秒后自动隐藏（除了错误消息）
  if (type !== 'error') {
    setTimeout(() => {
      elements.statusMessage.classList.add('hidden');
    }, 3000);
  }
}

/**
 * 切换 API Key 显示/隐藏（通用函数）
 */
function toggleApiKeyVisibility(button) {
  const targetId = button.dataset.target;
  const input = document.getElementById(targetId);
  
  if (input) {
    const type = input.type;
    input.type = type === 'password' ? 'text' : 'password';
    button.textContent = type === 'password' ? '🙈' : '👁️';
  }
}

// 事件监听器

// 导航切换
elements.navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const sectionId = item.dataset.section;
    switchSection(sectionId);
  });
});

// AI 模型选择
elements.aiModelSelect.addEventListener('change', (e) => {
  updateTestButtonState();
});

// 按钮事件
elements.saveBasicSettingsBtn.addEventListener('click', saveBasicSettings);
elements.saveSettingsBtn.addEventListener('click', saveSettings);
elements.testConnectionBtn.addEventListener('click', testConnection);
elements.backToDashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: 'dashboard.html' });
});
// 外部链接
if (elements.viewDocs) {
  elements.viewDocs.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/MitsuhaFe/Digest-AI#readme' });
  });
}
if (elements.reportIssue) {
  elements.reportIssue.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/MitsuhaFe/Digest-AI/issues/new/choose' });
  });
}
if (elements.visitGithub) {
  elements.visitGithub.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/MitsuhaFe/Digest-AI' });
  });
}
// 云同步按钮
if (elements.sbSignupBtn) elements.sbSignupBtn.addEventListener('click', sbSignup);
if (elements.sbLoginBtn) elements.sbLoginBtn.addEventListener('click', sbLogin);
if (elements.sbLogoutBtn) elements.sbLogoutBtn.addEventListener('click', sbLogout);
if (elements.sbUploadBtn) elements.sbUploadBtn.addEventListener('click', sbUpload);
if (elements.sbDownloadMergeBtn) elements.sbDownloadMergeBtn.addEventListener('click', sbDownloadMerge);
if (elements.sbDownloadOverwriteBtn) elements.sbDownloadOverwriteBtn.addEventListener('click', sbDownloadOverwrite);

// API Key 显示/隐藏按钮（多个）
elements.toggleApiKeyButtons.forEach(button => {
  button.addEventListener('click', () => {
    toggleApiKeyVisibility(button);
  });
});

// 主题切换 - 立即预览（不保存）
elements.themeSelect.addEventListener('change', (e) => {
  const theme = e.target.value;
  if (window.applyThemeStyles) {
    window.applyThemeStyles(theme);
    showStatus('主题已预览，请点击"保存基本设置"保存更改', 'info');
  } else {
    console.error('applyThemeStyles 函数未找到');
  }
});

// 字体大小切换 - 立即预览（不保存）
elements.fontSizeSelect.addEventListener('change', (e) => {
  const fontSize = e.target.value;
  if (window.applyFontSizeStyles) {
    window.applyFontSizeStyles(fontSize);
    showStatus('字体已预览，请点击"保存基本设置"保存更改', 'info');
  } else {
    console.error('applyFontSizeStyles 函数未找到');
  }
});

// 摘要字数范围滑块
elements.summaryLengthRange.addEventListener('input', (e) => {
  elements.summaryLengthValue.textContent = e.target.value;
});

// 自定义提示词开关
elements.enableCustomPromptCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    elements.customPromptSection.classList.remove('hidden');
  } else {
    elements.customPromptSection.classList.add('hidden');
  }
});

// 恢复默认提示词
elements.resetPromptBtn.addEventListener('click', () => {
  elements.customPromptInput.value = DEFAULT_PROMPT_TEMPLATE;
  showStatus('已恢复默认提示词', 'success');
});

// 初始化
(function init() {
  // 应用已保存的主题/字体，并监听系统主题（避免 settings.html 内联脚本触发 CSP）
  if (typeof loadSavedTheme === 'function') {
    loadSavedTheme().catch(() => {});
  }
  if (typeof loadSavedFontSize === 'function') {
    loadSavedFontSize().catch(() => {});
  }
  if (typeof watchSystemTheme === 'function') {
    try { watchSystemTheme(); } catch (e) {}
  }
  loadSettings();
  refreshSupabaseUI();
})();


/******/ })()
;
//# sourceMappingURL=settings.js.map