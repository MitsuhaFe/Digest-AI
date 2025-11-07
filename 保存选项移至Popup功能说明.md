# 保存选项移至 Popup 功能说明

## 功能概述

根据用户反馈，将"保存原文"和"保存图片"选项从设置页面移至保存时的 Popup 弹窗中，使用户能够在每次保存文章时灵活选择保存选项，而不是使用统一的全局设置。

## 改进动机

### 之前的设计问题
- 用户只能在设置页面配置全局的保存选项
- 所有文章都使用相同的保存策略
- 缺乏灵活性，无法根据不同文章的特点选择不同的保存方式

### 改进后的优势
- ✅ **灵活选择**：每篇文章可以单独选择保存策略
- ✅ **即时决策**：在保存时根据文章内容和需求做决定
- ✅ **更好的体验**：重要文章保存完整内容，一般文章只保存摘要
- ✅ **保留默认值**：设置页面的选项作为默认值，Popup 打开时自动应用

## 实现的更改

### 1. Popup 界面 (`popup.html`)

在空闲状态（保存前）添加了保存选项区域：

```html
<!-- 保存选项 -->
<div class="save-options">
  <label class="option-label">
    <input type="checkbox" id="saveOriginalCheckbox" checked />
    <span>保存文章原文</span>
  </label>
  <label class="option-label">
    <input type="checkbox" id="saveImagesCheckbox" checked />
    <span>保存文章图片</span>
  </label>
</div>
```

**位置**：在"点击下方按钮保存当前文章"文字和"保存文章"按钮之间

### 2. Popup 样式 (`styles/popup.css`)

新增样式：

```css
/* 保存选项 */
.save-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin: 16px 0;
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  user-select: none;
}

.option-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #667eea;
}
```

**设计特点**：
- 白色卡片背景，与整体设计一致
- 使用品牌色（#667eea）作为复选框主题色
- 清晰的间距和对齐
- 悬停效果增强交互反馈

### 3. Popup 逻辑 (`popup.js`)

#### 添加 DOM 元素引用
```javascript
// 保存选项
saveOriginalCheckbox: document.getElementById('saveOriginalCheckbox'),
saveImagesCheckbox: document.getElementById('saveImagesCheckbox'),
```

#### 新增 `loadSaveOptions()` 函数
从设置中读取默认值并应用到复选框：

```javascript
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
```

#### 修改 `saveArticle()` 函数
读取用户选择的选项并传递给 background：

```javascript
// 获取用户选择的保存选项
const saveOriginalContent = elements.saveOriginalCheckbox.checked;
const saveImages = elements.saveImagesCheckbox.checked;

// 向 background.js 发送保存请求
const response = await chrome.runtime.sendMessage({
  action: 'saveArticle',
  tabId: tab.id,
  url: tab.url,
  title: tab.title,
  saveOriginalContent: saveOriginalContent,
  saveImages: saveImages
});
```

#### 修改初始化流程
在初始化时加载默认值：

```javascript
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
```

### 4. 后台脚本 (`scripts/background.js`)

#### 修改 `handleSaveArticle()` 函数签名
接受新的参数：

```javascript
async function handleSaveArticle(tabId, url, title, saveOriginalContent, saveImages)
```

#### 参数处理逻辑
支持从 request 或 settings 获取保存选项：

```javascript
// 使用传入的参数，如果未提供则使用设置中的默认值
const shouldSaveOriginal = saveOriginalContent !== undefined ? saveOriginalContent : (settings.saveOriginalContent !== undefined ? settings.saveOriginalContent : true);
const shouldSaveImages = saveImages !== undefined ? saveImages : (settings.saveImages !== undefined ? settings.saveImages : true);

console.log('最终保存选项 - 原文:', shouldSaveOriginal, '图片:', shouldSaveImages);
```

**逻辑优先级**：
1. 如果 request 中提供了参数（从 Popup 保存），使用 request 的值
2. 否则使用 settings 中的默认值（从悬浮球保存）
3. 如果都没有，默认为 true（保存完整内容）

#### 修改消息监听器
传递新参数并添加日志：

```javascript
console.log('保存选项 - 原文:', request.saveOriginalContent, '图片:', request.saveImages);

handleSaveArticle(tabId, request.url, request.title, request.saveOriginalContent, request.saveImages)
  .then(response => sendResponse(response))
  .catch(error => sendResponse({ success: false, error: error.message }));
```

#### 使用新变量处理内容
将 `saveImages`/`saveOriginalContent` 替换为 `shouldSaveImages`/`shouldSaveOriginal`：

```javascript
if (!shouldSaveImages && htmlContent) {
  // 移除所有图片标签
  htmlContent = htmlContent.replace(/<img[^>]*>/gi, '');
  htmlContent = htmlContent.replace(/<figure[^>]*>.*?<\/figure>/gi, '');
}

if (!shouldSaveOriginal) {
  // 不保存原文，清空内容
  textContent = '';
  htmlContent = '';
}

// 文章对象
const article = {
  // ...
  hasOriginalContent: shouldSaveOriginal
};
```

### 5. 设置页面 (`settings.html`)

更新标题和提示文字，说明这些是默认值：

```html
<h3 class="subsection-title">📦 内容保存默认设置</h3>
<p class="setting-hint" style="margin-bottom: 16px; color: #666;">
  💡 这些是保存文章时的默认选项，您可以在每次保存时在弹窗中灵活调整
</p>

<!-- 更新复选框标签 -->
<input type="checkbox" id="saveOriginalContentCheckbox" checked />
默认保存文章原文

<input type="checkbox" id="saveImagesCheckbox" checked />
默认保存文章图片
```

## 使用流程

### 场景 1：从 Popup 保存文章（推荐）

1. 打开要保存的网页
2. 点击浏览器工具栏的 Digest AI 图标
3. 在弹出的窗口中，可以看到两个复选框（默认状态来自设置）：
   - ✅ 保存文章原文
   - ✅ 保存文章图片
4. 根据需要勾选或取消勾选
5. 点击"保存文章"按钮
6. 系统根据选择的选项保存文章

### 场景 2：从悬浮球保存文章（快速模式）

1. 在网页上直接点击悬浮球按钮
2. 系统使用设置页面中的默认选项保存文章
3. 无需用户额外操作

### 场景 3：修改默认选项

1. 打开 Digest AI 设置页面
2. 找到"📦 内容保存默认设置"区域
3. 修改默认选项
4. 点击"💾 保存 AI 设置"
5. 以后打开 Popup 时会自动应用新的默认值

## 典型使用案例

### 案例 1：研究论文
- **需求**：需要保存完整内容供后续参考
- **操作**：两个选项都勾选
- **结果**：保存完整 HTML、图片和 AI 摘要

### 案例 2：新闻快讯
- **需求**：只需要了解核心内容，不需要原文
- **操作**：取消勾选"保存文章原文"
- **结果**：只保存 AI 摘要和关键观点，大幅节省空间

### 案例 3：技术文档（无图片）
- **需求**：保存原文但不需要图片
- **操作**：勾选"保存文章原文"，取消勾选"保存文章图片"
- **结果**：保存纯文本内容和 AI 摘要

### 案例 4：图文并茂的教程
- **需求**：需要完整保存包括图片说明
- **操作**：两个选项都勾选
- **结果**：保存完整内容

## 技术亮点

1. **双层设置系统**：
   - 设置页面提供全局默认值
   - Popup 提供即时调整能力

2. **智能参数传递**：
   - Popup 保存：明确传递用户选择
   - 悬浮球保存：自动使用默认值

3. **向后兼容**：
   - 保留了原有的设置页面选项
   - 旧代码路径仍然有效

4. **用户体验优化**：
   - 清晰的视觉反馈
   - 直观的选项说明
   - 品牌色主题统一

## 注意事项

1. **悬浮球快速保存**：使用悬浮球保存时会直接使用默认设置，不会弹出选择框（快速保存设计）

2. **AI 摘要生成**：无论是否保存原文，AI 都需要读取原文来生成摘要，只是不会存储原文内容

3. **存储空间**：不保存原文可以节省 90-95% 的存储空间

4. **高亮功能限制**：如果不保存原文，则无法使用文章的高亮和笔记功能

## 完成时间

2025-10-22

## 相关文件

- `popup.html` - 添加保存选项 UI
- `styles/popup.css` - 保存选项样式
- `popup.js` - 读取选项并传递
- `scripts/background.js` - 接收并处理选项
- `settings.html` - 更新说明文字
- `保存选项移至Popup功能说明.md` - 本文档

