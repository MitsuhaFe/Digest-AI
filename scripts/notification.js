/**
 * 通知管理模块
 * 提供友好的用户反馈
 */

// 通知类型
const NotificationType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// 通知容器
let notificationContainer = null;

/**
 * 初始化通知容器
 */
function initNotificationContainer() {
  if (notificationContainer) {
    return;
  }
  
  notificationContainer = document.createElement('div');
  notificationContainer.id = 'notification-container';
  notificationContainer.className = 'notification-container';
  document.body.appendChild(notificationContainer);
}

/**
 * 显示通知
 */
function showNotification(message, type = NotificationType.INFO, duration = 3000) {
  initNotificationContainer();
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // 图标
  const icon = getIconForType(type);
  
  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">
      <div class="notification-message">${escapeHtml(message)}</div>
    </div>
    <button class="notification-close">×</button>
  `;
  
  // 添加到容器
  notificationContainer.appendChild(notification);
  
  // 动画进入
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // 关闭按钮
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    closeNotification(notification);
  });
  
  // 自动关闭
  if (duration > 0) {
    setTimeout(() => {
      closeNotification(notification);
    }, duration);
  }
  
  return notification;
}

/**
 * 关闭通知
 */
function closeNotification(notification) {
  notification.classList.remove('show');
  notification.classList.add('hide');
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.parentElement.removeChild(notification);
    }
  }, 300);
}

/**
 * 获取类型对应的图标
 */
function getIconForType(type) {
  const icons = {
    [NotificationType.SUCCESS]: '✅',
    [NotificationType.ERROR]: '❌',
    [NotificationType.WARNING]: '⚠️',
    [NotificationType.INFO]: 'ℹ️'
  };
  return icons[type] || icons[NotificationType.INFO];
}

/**
 * 转义 HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 便捷方法
 */
function showSuccess(message, duration) {
  return showNotification(message, NotificationType.SUCCESS, duration);
}

function showError(message, duration) {
  return showNotification(message, NotificationType.ERROR, duration || 5000);
}

function showWarning(message, duration) {
  return showNotification(message, NotificationType.WARNING, duration);
}

function showInfo(message, duration) {
  return showNotification(message, NotificationType.INFO, duration);
}

/**
 * 显示加载提示
 */
function showLoading(message) {
  initNotificationContainer();
  
  const loading = document.createElement('div');
  loading.className = 'notification notification-loading';
  loading.innerHTML = `
    <div class="notification-icon">
      <div class="loading-spinner"></div>
    </div>
    <div class="notification-content">
      <div class="notification-message">${escapeHtml(message)}</div>
    </div>
  `;
  
  notificationContainer.appendChild(loading);
  
  setTimeout(() => {
    loading.classList.add('show');
  }, 10);
  
  // 返回关闭函数
  return () => closeNotification(loading);
}

// 导出函数
if (typeof window !== 'undefined') {
  window.showNotification = showNotification;
  window.showSuccess = showSuccess;
  window.showError = showError;
  window.showWarning = showWarning;
  window.showInfo = showInfo;
  window.showLoading = showLoading;
  window.NotificationType = NotificationType;
}

// CSS 样式（动态注入）
const notificationStyles = `
<style>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  pointer-events: none;
}

.notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-bottom: 10px;
  min-width: 300px;
  max-width: 400px;
  opacity: 0;
  transform: translateX(400px);
  transition: all 0.3s ease;
  pointer-events: auto;
}

.notification.show {
  opacity: 1;
  transform: translateX(0);
}

.notification.hide {
  opacity: 0;
  transform: translateX(400px);
}

.notification-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-message {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.notification-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.notification-close:hover {
  background: #f0f0f0;
}

.notification-success {
  border-left: 4px solid #10b981;
}

.notification-error {
  border-left: 4px solid #ef4444;
}

.notification-warning {
  border-left: 4px solid #f59e0b;
}

.notification-info {
  border-left: 4px solid #3b82f6;
}

.notification-loading {
  border-left: 4px solid #667eea;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
`;

// 注入样式
if (typeof document !== 'undefined' && !document.getElementById('notification-styles')) {
  const styleElement = document.createElement('div');
  styleElement.id = 'notification-styles';
  styleElement.innerHTML = notificationStyles;
  document.head.appendChild(styleElement);
}

