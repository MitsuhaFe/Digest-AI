/**
 * 字体大小管理模块
 * 处理阅读库的字体大小调整
 */

// 字体大小配置
const FONT_SIZES = {
  small: {
    '--font-base': '14px',
    '--font-title': '28px',
    '--font-content': '15px',
    '--line-height-base': '1.6',
    '--line-height-content': '1.7'
  },
  medium: {
    '--font-base': '16px',
    '--font-title': '32px',
    '--font-content': '16px',
    '--line-height-base': '1.6',
    '--line-height-content': '1.8'
  },
  large: {
    '--font-base': '18px',
    '--font-title': '36px',
    '--font-content': '18px',
    '--line-height-base': '1.7',
    '--line-height-content': '1.9'
  }
};

/**
 * 应用字体大小样式（不保存到 storage）
 */
function applyFontSizeStyles(size) {
  const sizeConfig = FONT_SIZES[size] || FONT_SIZES.medium;
  
  // 应用 CSS 变量
  const root = document.documentElement;
  Object.entries(sizeConfig).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  // 添加字体大小类到 body
  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.body.classList.add(`font-${size}`);
}

/**
 * 应用字体大小并保存
 */
async function applyFontSize(size, saveToStorage = true) {
  applyFontSizeStyles(size);
  
  // 保存字体大小设置（可选）
  if (saveToStorage) {
    try {
      await chrome.storage.local.set({ fontSize: size });
    } catch (error) {
      console.error('保存字体大小设置失败:', error);
    }
  }
}

/**
 * 加载并应用保存的字体大小
 */
async function loadSavedFontSize() {
  try {
    const { fontSize } = await chrome.storage.local.get(['fontSize']);
    const savedSize = fontSize || 'medium';
    await applyFontSize(savedSize);
  } catch (error) {
    console.error('加载字体大小失败:', error);
    await applyFontSize('medium'); // 使用默认大小
  }
}

// 导出函数
if (typeof window !== 'undefined') {
  window.applyFontSize = applyFontSize;
  window.applyFontSizeStyles = applyFontSizeStyles;
  window.loadSavedFontSize = loadSavedFontSize;
}

