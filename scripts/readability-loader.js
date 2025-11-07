/**
 * Readability 库加载器
 * 由于 Manifest V3 的限制，我们需要在运行时加载 Readability
 */

// 注意：在实际使用中，需要从 npm 安装 @mozilla/readability
// 然后在构建过程中将其打包进来

// 这是一个简化的占位符
// 在生产环境中，应该使用真正的 Readability.js

/**
 * 简化版的 Readability 类
 * 实际项目中应使用 @mozilla/readability
 */
class SimpleReadability {
  constructor(document) {
    this.document = document;
  }
  
  parse() {
    // 这里应该实现完整的 Readability 算法
    // 目前使用简化版本
    
    const article = this.document.querySelector('article') || 
                    this.document.querySelector('[role="main"]') ||
                    this.document.querySelector('main') ||
                    this.document.body;
    
    if (!article) {
      return null;
    }
    
    return {
      title: this.document.title,
      content: article.innerHTML,
      textContent: article.textContent,
      excerpt: this.getExcerpt(article.textContent),
      byline: this.getByline(),
      length: article.textContent.length
    };
  }
  
  getExcerpt(text) {
    return text.substring(0, 300).trim() + '...';
  }
  
  getByline() {
    const authorMeta = this.document.querySelector('[name="author"]');
    return authorMeta ? authorMeta.getAttribute('content') : '';
  }
}

// 导出为全局变量（在 content script 中使用）
if (typeof window !== 'undefined') {
  window.Readability = SimpleReadability;
}

// 如果使用模块系统
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleReadability;
}

