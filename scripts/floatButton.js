/**
 * 悬浮按钮功能
 * 在页面上显示一个可拖动的悬浮球，点击快速保存文章
 */

class FloatButton {
  constructor() {
    this.button = null;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.enabled = true;
  }

  /**
   * 初始化悬浮球
   */
  async init() {
    // 检查是否启用悬浮球
    const settings = await chrome.storage.local.get(['enableFloatButton']);
    this.enabled = settings.enableFloatButton !== undefined ? settings.enableFloatButton : true;
    
    if (!this.enabled) {
      this.remove();
      return;
    }
    
    // 如果已存在，先移除
    this.remove();
    
    // 创建悬浮球
    this.button = document.createElement('div');
    this.button.id = 'digest-ai-float-button';
    this.button.innerHTML = `
      <div class="float-btn-icon">📚</div>
      <div class="float-btn-tooltip">保存文章</div>
    `;
    
    // 添加样式
    this.injectStyles();
    
    // 添加到页面
    document.body.appendChild(this.button);
    
    // 绑定事件
    this.bindEvents();
    
    // 从存储加载位置
    await this.loadPosition();
  }

  /**
   * 注入样式
   */
  injectStyles() {
    if (document.getElementById('digest-ai-float-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'digest-ai-float-styles';
    style.textContent = `
      #digest-ai-float-button {
        position: fixed;
        right: 20px;
        bottom: 100px;
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        cursor: pointer;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }
      
      #digest-ai-float-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      }
      
      #digest-ai-float-button:active {
        transform: scale(0.95);
      }
      
      #digest-ai-float-button.dragging {
        cursor: grabbing;
        opacity: 0.8;
      }
      
      .float-btn-icon {
        font-size: 24px;
        line-height: 1;
      }
      
      .float-btn-tooltip {
        position: absolute;
        right: 70px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 13px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      
      #digest-ai-float-button:hover .float-btn-tooltip {
        opacity: 1;
      }
      
      .float-btn-tooltip::after {
        content: '';
        position: absolute;
        right: -6px;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: rgba(0, 0, 0, 0.8);
      }
      
      #digest-ai-float-button.saving {
        animation: pulse 1s ease-in-out infinite;
      }
      
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    if (!this.button) return;
    
    // 鼠标事件
    this.button.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // 触摸事件（移动端）
    this.button.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  /**
   * 鼠标按下
   */
  handleMouseDown(e) {
    if (e.button !== 0) return; // 只处理左键
    
    this.isDragging = true;
    this.button.classList.add('dragging');
    
    const rect = this.button.getBoundingClientRect();
    this.offsetX = e.clientX - rect.left;
    this.offsetY = e.clientY - rect.top;
    this.startX = e.clientX;
    this.startY = e.clientY;
    
    e.preventDefault();
  }

  /**
   * 鼠标移动
   */
  handleMouseMove(e) {
    if (!this.isDragging) return;
    
    const x = e.clientX - this.offsetX;
    const y = e.clientY - this.offsetY;
    
    this.updatePosition(x, y);
    e.preventDefault();
  }

  /**
   * 鼠标释放
   */
  handleMouseUp(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.button.classList.remove('dragging');
    
    // 判断是否为点击（移动距离小于5px）
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - this.startX, 2) + 
      Math.pow(e.clientY - this.startY, 2)
    );
    
    if (moveDistance < 5) {
      // 触发点击事件
      this.handleClick();
    } else {
      // 保存位置
      this.savePosition();
    }
  }

  /**
   * 触摸开始
   */
  handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    
    this.isDragging = true;
    this.button.classList.add('dragging');
    
    const touch = e.touches[0];
    const rect = this.button.getBoundingClientRect();
    this.offsetX = touch.clientX - rect.left;
    this.offsetY = touch.clientY - rect.top;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    
    e.preventDefault();
  }

  /**
   * 触摸移动
   */
  handleTouchMove(e) {
    if (!this.isDragging || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const x = touch.clientX - this.offsetX;
    const y = touch.clientY - this.offsetY;
    
    this.updatePosition(x, y);
    e.preventDefault();
  }

  /**
   * 触摸结束
   */
  handleTouchEnd(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.button.classList.remove('dragging');
    
    const touch = e.changedTouches[0];
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - this.startX, 2) + 
      Math.pow(touch.clientY - this.startY, 2)
    );
    
    if (moveDistance < 5) {
      this.handleClick();
    } else {
      this.savePosition();
    }
  }

  /**
   * 更新位置
   */
  updatePosition(x, y) {
    if (!this.button) return;
    
    // 限制在窗口内
    const maxX = window.innerWidth - this.button.offsetWidth;
    const maxY = window.innerHeight - this.button.offsetHeight;
    
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    
    this.button.style.left = `${x}px`;
    this.button.style.top = `${y}px`;
    this.button.style.right = 'auto';
    this.button.style.bottom = 'auto';
  }

  /**
   * 处理点击
   */
  async handleClick() {
    if (!this.button) return;
    
    // 添加保存动画
    this.button.classList.add('saving');
    
    try {
      // 发送保存消息到 background
      const response = await chrome.runtime.sendMessage({
        action: 'saveArticle',
        url: window.location.href,
        title: document.title
      });
      
      if (response.success) {
        // 成功提示
        this.showToast('✅ 文章已保存', 'success');
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('保存文章失败:', error);
      this.showToast('❌ ' + error.message, 'error');
    } finally {
      this.button.classList.remove('saving');
    }
  }

  /**
   * 显示提示消息
   */
  showToast(message, type = 'info') {
    // 移除现有的 toast
    const existingToast = document.getElementById('digest-ai-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 创建新的 toast
    const toast = document.createElement('div');
    toast.id = 'digest-ai-toast';
    toast.textContent = message;
    toast.className = `digest-ai-toast ${type}`;
    
    // 注入 toast 样式
    if (!document.getElementById('digest-ai-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'digest-ai-toast-styles';
      style.textContent = `
        .digest-ai-toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 1000000;
          animation: slideDown 0.3s ease-out;
        }
        
        .digest-ai-toast.success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        
        .digest-ai-toast.error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * 保存位置到存储
   */
  async savePosition() {
    if (!this.button) return;
    
    const position = {
      left: this.button.style.left,
      top: this.button.style.top
    };
    
    await chrome.storage.local.set({ floatButtonPosition: position });
  }

  /**
   * 从存储加载位置
   */
  async loadPosition() {
    if (!this.button) return;
    
    const { floatButtonPosition } = await chrome.storage.local.get(['floatButtonPosition']);
    
    if (floatButtonPosition && floatButtonPosition.left && floatButtonPosition.top) {
      // 读取并限制在当前可视区域内，避免被保存到屏幕外导致“看不见”
      const leftPx = parseInt(floatButtonPosition.left, 10);
      const topPx = parseInt(floatButtonPosition.top, 10);
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      const clampedLeft = Math.max(0, Math.min(isNaN(leftPx) ? 0 : leftPx, maxX));
      const clampedTop = Math.max(0, Math.min(isNaN(topPx) ? 0 : topPx, maxY));

      this.button.style.left = `${clampedLeft}px`;
      this.button.style.top = `${clampedTop}px`;
      this.button.style.right = 'auto';
      this.button.style.bottom = 'auto';
    }
  }

  /**
   * 移除悬浮球
   */
  remove() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }

  /**
   * 更新悬浮球状态
   */
  async updateState() {
    const settings = await chrome.storage.local.get(['enableFloatButton']);
    const newEnabled = settings.enableFloatButton !== undefined ? settings.enableFloatButton : true;
    
    if (newEnabled !== this.enabled) {
      this.enabled = newEnabled;
      if (newEnabled) {
        await this.init();
      } else {
        this.remove();
      }
    }
  }
}

// 创建全局实例
const floatButton = new FloatButton();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => floatButton.init());
} else {
  floatButton.init();
}

// 监听设置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.enableFloatButton) {
    floatButton.updateState();
  }
});

// 导出供其他脚本使用
if (typeof window !== 'undefined') {
  window.digestAIFloatButton = floatButton;
}

