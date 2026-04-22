// Popup 交互脚本

let currentUrl = '';
let currentTitle = '';
let markdownContent = '';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 获取当前标签页信息
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      currentUrl = tabs[0].url;
      currentTitle = tabs[0].title;
      document.getElementById('urlInput').value = currentUrl;
    }
  } catch (e) {
    console.log('无法获取当前标签页:', e);
  }
});

// 转换函数
async function convert() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) {
    alert('请输入URL');
    return;
  }

  // 显示加载状态
  document.getElementById('convertBtn').disabled = true;
  document.getElementById('loading').classList.add('show');
  document.getElementById('resultArea').classList.remove('show');

  try {
    // 发送消息给 content script 或使用后台脚本提取
    const response = await chrome.runtime.sendMessage({
      action: 'extractContent',
      url: url
    });

    if (response && response.success) {
      markdownContent = response.markdown;
      currentTitle = response.title || '转换结果';

      document.getElementById('resultTitle').textContent = currentTitle;
      document.getElementById('output').value = markdownContent;
      document.getElementById('resultArea').classList.add('show');
    } else {
      alert('提取失败: ' + (response?.error || '未知错误'));
    }
  } catch (e) {
    alert('提取失败: ' + e.message);
  } finally {
    document.getElementById('convertBtn').disabled = false;
    document.getElementById('loading').classList.remove('show');
  }
}

// 复制结果
function copyResult() {
  const textarea = document.getElementById('output');
  textarea.select();
  document.execCommand('copy');

  const btn = document.getElementById('copyBtn');
  btn.textContent = '✅ 已复制';
  setTimeout(() => {
    btn.textContent = '📋 复制';
  }, 2000);
}

// 绑定到全局
window.convert = convert;
window.copyResult = copyResult;
