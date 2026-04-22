// 后台脚本 - 处理内容提取

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    extractContent(request.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }
});

// 内容提取主函数
async function extractContent(url) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    // 如果URL是当前页面，直接执行脚本
    if (tab && tab.url === url) {
      // 注入脚本到页面执行
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractFromPage
      });

      if (results && results[0] && results[0].result) {
        const content = results[0].result;
        return {
          success: true,
          title: content.title,
          markdown: convertToMarkdown(content, url)
        };
      }
    }

    // 否则尝试通过 API 提取
    return await extractFromAPI(url);
  } catch (e) {
    return await extractFromAPI(url);
  }
}

// 从当前页面提取内容（注入到页面执行的函数）
function extractFromPage() {
  // 获取标题
  const title = document.title ||
    document.querySelector('h1')?.textContent ||
    document.querySelector('meta[property="og:title"]')?.content || '';

  // 尝试获取主要内容区域
  let content = '';

  // 常见内容选择器
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.blog_content',
    '#article_content',
    '.rich_media_content',
    '.zr-gb'
  ];

  for (const selector of selectors) {
    const elem = document.querySelector(selector);
    if (elem) {
      // 克隆节点并清理
      const clone = elem.cloneNode(true);
      const scripts = clone.querySelectorAll('script, style, iframe, nav, footer, header');
      scripts.forEach(s => s.remove());
      content = clone.textContent?.trim() || '';
      if (content.length > 200) break;
    }
  }

  // 如果没找到，尝试获取 body 中的所有段落
  if (!content || content.length < 200) {
    const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    const texts = [];
    paragraphs.forEach(p => {
      const text = p.textContent?.trim();
      if (text && text.length > 20) {
        texts.push(text);
      }
    });
    content = texts.join('\n\n');
  }

  // 清理内容
  content = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\t ]+/g, ' ')
    .trim();

  return {
    title: title.substring(0, 100),
    content: content.substring(0, 50000), // 限制长度
    url: window.location.href
  };
}

// 转换为 Markdown 格式
function convertToMarkdown(content, url) {
  const { title, content: text } = content;
  const date = new Date().toISOString().split('T')[0];

  let markdown = `# ${title}\n\n`;
  markdown += `> **原文链接**: ${url}\n\n`;
  markdown += `---\n\n`;
  markdown += text;
  markdown += `\n\n---\n\n`;
  markdown += `*本文由 Web2MD Chrome插件自动转换，生成时间: ${new Date().toLocaleString('zh-CN')}*`;

  return markdown;
}

// 通过 API 提取（备用方案）
async function extractFromAPI(url) {
  try {
    // 使用简单的 fetch 方式
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const text = await response.text();

    // 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    const title = doc.title ||
      doc.querySelector('h1')?.textContent ||
      doc.querySelector('meta[property="og:title"]')?.content || '提取的文章';

    // 提取正文
    const article = doc.querySelector('article') || doc.querySelector('main') || doc.body;
    let content = '';

    if (article) {
      const clone = article.cloneNode(true);
      const scripts = clone.querySelectorAll('script, style, iframe, nav, footer, header');
      scripts.forEach(s => s.remove());
      content = clone.textContent?.trim() || '';
    }

    return {
      success: true,
      title: title.substring(0, 100),
      markdown: convertToMarkdown({ title, content }, url)
    };
  } catch (e) {
    return {
      success: false,
      error: '无法提取内容: ' + e.message
    };
  }
}
