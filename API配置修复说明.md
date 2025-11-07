# API 配置修复说明

## 问题描述
配置了 API Key 后，扩展仍然提示"未配置 API"，无法正常使用。

## 问题原因
`popup.js` 中的配置检查函数 `checkConfiguration()` 仍在使用旧版的单一 API Key 检查方式，而设置页面已经升级为支持多个 AI 模型独立配置 API Key。

具体来说：
- **旧版本**：只有一个 `apiKey` 字段
- **新版本**：每个模型有独立的 API Key（`geminiApiKey`、`openaiApiKey`、`claudeApiKey`、`deepseekApiKey`、`qwenApiKey`）

## 修复内容

### 1. 修复 `popup.js`（源文件）
将 `checkConfiguration()` 函数更新为检查对应模型的 API Key：

```javascript
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
```

### 2. 修复 `dist/popup.js`（构建文件）
同步更新压缩版本的配置检查函数。

## 使用说明

修复后，请按照以下步骤操作：

1. **重新加载扩展**：
   - 打开 Chrome 浏览器
   - 进入 `chrome://extensions/`
   - 找到 "Digest AI" 扩展
   - 点击刷新按钮 🔄

2. **验证配置**：
   - 进入扩展的设置页面
   - 选择您要使用的 AI 模型
   - 输入对应模型的 API Key
   - 点击"保存设置"

3. **测试功能**：
   - 打开任意网页
   - 点击扩展图标
   - 现在应该可以正常显示保存界面，而不是"未配置"提示了

## 技术细节

### 配置检查逻辑
1. 检查是否选择了 AI 模型（`aiModel`）
2. 根据选择的模型，检查对应的 API Key 是否存在
3. 如果新版 API Key 不存在，会检查旧版的 `apiKey`（向后兼容）

### 向后兼容性
修复保持了向后兼容：
- 如果用户之前使用旧版单一 `apiKey`，仍然可以正常工作
- 新配置使用独立的模型 API Key
- 在 `settings.js` 中有自动迁移逻辑，会将旧 key 迁移到对应的新 key

## 相关文件
- `popup.js` - 扩展弹窗逻辑（源文件）
- `dist/popup.js` - 扩展弹窗逻辑（构建文件）
- `settings.js` - 设置页面逻辑
- `scripts/background.js` - 后台服务（已支持多模型 API Key）

## 修复日期
2025-10-24

