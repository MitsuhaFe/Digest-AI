/******/ (() => { // webpackBootstrap
/*!**************************!*\
  !*** ./scripts/theme.js ***!
  \**************************/
/**
 * 主题管理模块
 * 处理亮色/暗色主题切换
 */

// 主题配置
const THEMES = {
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f5f7fa',
    '--bg-tertiary': '#fafafa',
    '--text-primary': '#1f2937',
    '--text-secondary': '#4b5563',
    '--text-tertiary': '#6b7280',
    '--border-color': '#e5e7eb',
    '--border-light': '#f3f4f6',
    '--gradient-start': '#667eea',
    '--gradient-end': '#764ba2',
    '--shadow': 'rgba(0, 0, 0, 0.1)',
    '--ai-bg': 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)'
  },
  dark: {
    '--bg-primary': '#1f2937',
    '--bg-secondary': '#111827',
    '--bg-tertiary': '#0f172a',
    '--text-primary': '#f9fafb',
    '--text-secondary': '#e5e7eb',
    '--text-tertiary': '#d1d5db',
    '--border-color': '#374151',
    '--border-light': '#4b5563',
    '--gradient-start': '#667eea',
    '--gradient-end': '#764ba2',
    '--shadow': 'rgba(0, 0, 0, 0.3)',
    '--ai-bg': 'linear-gradient(135deg, #1e293b 0%, #312e81 100%)'
  }
};

/**
 * 应用主题样式（不保存到 storage）
 */
function applyThemeStyles(themeName) {
  let theme = themeName;
  
  // 如果是 auto，根据系统偏好选择
  if (themeName === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  
  const themeColors = THEMES[theme] || THEMES.light;
  
  // 应用 CSS 变量
  const root = document.documentElement;
  Object.entries(themeColors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  // 添加主题类到 body
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${theme}`);
}

/**
 * 应用主题并保存
 */
async function applyTheme(themeName, saveToStorage = true) {
  applyThemeStyles(themeName);
  
  // 保存主题设置（可选）
  if (saveToStorage) {
    let theme = themeName;
    if (themeName === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }
    
    try {
      await chrome.storage.local.set({ theme: themeName, appliedTheme: theme });
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  }
}

/**
 * 加载并应用保存的主题
 */
async function loadSavedTheme() {
  try {
    const { theme } = await chrome.storage.local.get(['theme']);
    const savedTheme = theme || 'light';
    await applyTheme(savedTheme);
  } catch (error) {
    console.error('加载主题失败:', error);
    await applyTheme('light'); // 使用默认主题
  }
}

/**
 * 监听系统主题变化（仅当设置为 auto 时）
 */
function watchSystemTheme() {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  darkModeQuery.addEventListener('change', async (e) => {
    const { theme } = await chrome.storage.local.get(['theme']);
    if (theme === 'auto') {
      await applyTheme('auto');
    }
  });
}

// 导出函数
if (typeof window !== 'undefined') {
  window.applyTheme = applyTheme;
  window.applyThemeStyles = applyThemeStyles;
  window.loadSavedTheme = loadSavedTheme;
  window.watchSystemTheme = watchSystemTheme;
}


/******/ })()
;
//# sourceMappingURL=theme.js.map