/**
 * Bilibili 适配器诊断脚本
 * 
 * 使用方法：
 * 1. 打开任意 Bilibili 视频页面
 * 2. 按 F12 打开开发者工具
 * 3. 切换到 Console（控制台）标签
 * 4. 复制此文件的全部内容
 * 5. 粘贴到控制台并按回车
 * 6. 查看诊断结果
 */

console.log('========================================');
console.log('🔍 Bilibili 适配器诊断开始');
console.log('========================================\n');

// 1. 检查当前页面
console.log('1️⃣ 页面信息:');
console.log('   URL:', window.location.href);
console.log('   主机:', window.location.hostname);
console.log('   路径:', window.location.pathname);
console.log('   是否为 Bilibili 视频页:', 
  window.location.hostname.includes('bilibili.com') && 
  window.location.pathname.includes('/video/')
);
console.log('');

// 2. 检查 BilibiliAdapter
console.log('2️⃣ BilibiliAdapter 检查:');
console.log('   typeof BilibiliAdapter:', typeof BilibiliAdapter);
console.log('   typeof window.BilibiliAdapter:', typeof window.BilibiliAdapter);

if (typeof BilibiliAdapter !== 'undefined') {
  console.log('   ✅ BilibiliAdapter 已定义');
  try {
    const adapter = new BilibiliAdapter();
    console.log('   ✅ 可以实例化 BilibiliAdapter');
    console.log('   实例:', adapter);
  } catch (e) {
    console.log('   ❌ 实例化失败:', e.message);
  }
} else {
  console.log('   ❌ BilibiliAdapter 未定义');
}
console.log('');

// 3. 检查加载的脚本
console.log('3️⃣ 已加载的扩展脚本:');
const scripts = performance.getEntriesByType('resource')
  .filter(e => e.name.includes('chrome-extension'))
  .filter(e => e.name.endsWith('.js'));

if (scripts.length > 0) {
  scripts.forEach(script => {
    const fileName = script.name.split('/').pop();
    console.log(`   - ${fileName} (${Math.round(script.duration)}ms, ${script.transferSize} bytes)`);
  });
} else {
  console.log('   ❌ 没有找到扩展脚本');
}
console.log('');

// 4. 检查 DOM 中的脚本标签
console.log('4️⃣ DOM 中的扩展脚本标签:');
const extensionScripts = document.querySelectorAll('script[src*="chrome-extension"]');
if (extensionScripts.length > 0) {
  extensionScripts.forEach(script => {
    const src = script.getAttribute('src');
    const fileName = src.split('/').pop();
    console.log(`   - ${fileName}`);
    console.log(`     完整路径: ${src}`);
  });
} else {
  console.log('   ❌ 没有找到扩展脚本标签');
}
console.log('');

// 5. 检查 window 对象上的扩展相关属性
console.log('5️⃣ window 对象上的大写属性（可能是类）:');
const windowProps = Object.keys(window)
  .filter(k => /^[A-Z]/.test(k))
  .filter(k => k.includes('Bili') || k.includes('Adapter') || k.includes('Digest'));

if (windowProps.length > 0) {
  windowProps.forEach(prop => {
    console.log(`   - ${prop}: ${typeof window[prop]}`);
  });
} else {
  console.log('   ℹ️ 没有找到相关属性');
}
console.log('');

// 6. 尝试检查扩展 ID
console.log('6️⃣ 扩展信息:');
try {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    console.log('   扩展 ID:', chrome.runtime.id);
    console.log('   扩展 URL:', chrome.runtime.getURL(''));
  } else {
    console.log('   ❌ 无法获取扩展信息');
  }
} catch (e) {
  console.log('   ❌ 获取扩展信息失败:', e.message);
}
console.log('');

// 7. 检查控制台历史日志
console.log('7️⃣ 查找历史日志:');
console.log('   请向上滚动控制台，查找以下日志:');
console.log('   - 🎬 Bilibili适配器脚本开始加载...');
console.log('   - ✅ BilibiliAdapter 已成功导出到 window 对象');
console.log('   - 🔍 检查 BilibiliAdapter 是否已加载...');
console.log('');

// 8. 总结
console.log('========================================');
console.log('📊 诊断总结:');
console.log('========================================');

let issues = [];
let success = [];

if (typeof BilibiliAdapter !== 'undefined') {
  success.push('✅ BilibiliAdapter 已正确加载');
} else {
  issues.push('❌ BilibiliAdapter 未定义 - 适配器脚本未加载或未导出');
}

if (scripts.length > 0) {
  success.push(`✅ 找到 ${scripts.length} 个扩展脚本`);
} else {
  issues.push('❌ 没有找到任何扩展脚本 - 扩展可能未正确注入');
}

const hasBilibiliAdapter = scripts.some(s => s.name.includes('bilibili-adapter'));
if (hasBilibiliAdapter) {
  success.push('✅ bilibili-adapter.js 已加载');
} else {
  issues.push('❌ bilibili-adapter.js 未加载 - manifest.json 配置可能有误');
}

console.log('');
if (success.length > 0) {
  console.log('成功项:');
  success.forEach(s => console.log('  ' + s));
}

console.log('');
if (issues.length > 0) {
  console.log('问题项:');
  issues.forEach(i => console.log('  ' + i));
  
  console.log('');
  console.log('🔧 建议操作:');
  
  if (!hasBilibiliAdapter) {
    console.log('  1. 检查文件是否存在:');
    console.log('     D:\\CodeProject\\PBL2\\Digest AI\\dist\\scripts\\media\\bilibili-adapter.js');
    console.log('  2. 检查 manifest.json 的 content_scripts 配置');
    console.log('  3. 完全卸载并重新加载扩展');
  }
  
  if (typeof BilibiliAdapter === 'undefined' && hasBilibiliAdapter) {
    console.log('  1. 脚本加载了但未导出，检查脚本末尾的导出代码');
    console.log('  2. 检查控制台是否有JavaScript错误');
    console.log('  3. 查看 Network 标签中 bilibili-adapter.js 的响应内容');
  }
} else {
  console.log('🎉 所有检查通过！适配器应该可以正常工作！');
  console.log('');
  console.log('🧪 可以尝试保存视频测试功能');
}

console.log('');
console.log('========================================');
console.log('诊断完成 - 请将以上信息提供给开发者');
console.log('========================================');

