/**
 * Content Script - 内容脚本
 * 用于在网页中提取文章内容
 */

// ==================== Bilibili 适配器（集成版）====================
// 为避免文件加载问题，将 BilibiliAdapter 直接集成到 content.js 中

if (window.location.hostname.includes('bilibili.com') && window.location.pathname.includes('/video/')) {
  console.log('🎬 检测到 Bilibili 视频页面，初始化适配器...');
  
  class BilibiliAdapter {
    constructor() {
      this.apiBase = 'https://api.bilibili.com';
    }

    extractVideoId(url) {
      const bvMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      if (bvMatch) return { type: 'bvid', id: bvMatch[1] };
      const avMatch = url.match(/\/video\/av(\d+)/);
      if (avMatch) return { type: 'aid', id: avMatch[1] };
      return null;
    }

    extractVideoInfoFromPage() {
      try {
        const initialState = window.__INITIAL_STATE__;
        if (!initialState || !initialState.videoData) {
          throw new Error('无法从页面获取视频信息');
        }
        const videoData = initialState.videoData;
        return {
          title: videoData.title || document.title.replace(' - 哔哩哔哩', ''),
          description: videoData.desc || '',
          duration: videoData.duration || 0,
          author: videoData.owner?.name || '',
          cover: videoData.pic || '',
          bvid: videoData.bvid || '',
          aid: videoData.aid || '',
          cid: videoData.cid || videoData.pages?.[0]?.cid || '',
          pubdate: videoData.pubdate ? new Date(videoData.pubdate * 1000).toISOString() : '',
          tags: (videoData.tag || []).map(tag => tag.tag_name || tag),
          view: videoData.stat?.view || 0,
          like: videoData.stat?.like || 0,
          coin: videoData.stat?.coin || 0
        };
      } catch (error) {
        console.error('提取Bilibili视频信息失败:', error);
        return this.extractBasicInfoFromDOM();
      }
    }

    extractBasicInfoFromDOM() {
      const titleEl = document.querySelector('h1.video-title') || document.querySelector('.video-title');
      const descEl = document.querySelector('.video-desc') || document.querySelector('.basic-desc-info');
      const authorEl = document.querySelector('.up-name') || document.querySelector('.username');
      return {
        title: titleEl?.textContent?.trim() || document.title.replace(' - 哔哩哔哩', ''),
        description: descEl?.textContent?.trim() || '',
        author: authorEl?.textContent?.trim() || '',
        duration: 0,
        cover: '',
        bvid: this.extractVideoId(window.location.href)?.id || '',
        aid: '',
        cid: '',
        pubdate: '',
        tags: [],
        view: 0,
        like: 0,
        coin: 0
      };
    }

    async getSubtitles(bvid, cid) {
      try {
        const subtitleListUrl = `${this.apiBase}/x/player/wbi/v2?bvid=${bvid}&cid=${cid}`;
        const response = await fetch(subtitleListUrl, {
          credentials: 'include',
          headers: { 'Referer': 'https://www.bilibili.com', 'User-Agent': navigator.userAgent }
        });
        if (!response.ok) return await this.getSubtitlesFromDOM();
        const data = await response.json();
        if (data.code !== 0 || !data.data?.subtitle?.subtitles?.length) {
          return await this.getSubtitlesFromDOM();
        }
        const subtitles = data.data.subtitle.subtitles;
        const chineseSubtitle = subtitles.find(s => 
          s.lan === 'zh-CN' || s.lan === 'zh-Hans' || s.lan === 'zh-Hant' || s.lan_doc?.includes('中文')
        ) || subtitles[0];
        if (!chineseSubtitle || !chineseSubtitle.subtitle_url) {
          return await this.getSubtitlesFromDOM();
        }
        const subtitleUrl = chineseSubtitle.subtitle_url.startsWith('http') 
          ? chineseSubtitle.subtitle_url 
          : `https:${chineseSubtitle.subtitle_url}`;
        const subtitleResponse = await fetch(subtitleUrl);
        const subtitleData = await subtitleResponse.json();
        if (!subtitleData.body || !Array.isArray(subtitleData.body)) {
          return await this.getSubtitlesFromDOM();
        }
        return this.formatSubtitles(subtitleData.body);
      } catch (error) {
        return await this.getSubtitlesFromDOM();
      }
    }

    async getSubtitlesFromDOM() {
      try {
        const initialState = window.__INITIAL_STATE__;
        if (initialState?.videoData?.subtitle?.list) {
          const subtitleList = initialState.videoData.subtitle.list;
          if (subtitleList.length > 0) {
            const subtitle = subtitleList[0];
            if (subtitle.subtitle_url) {
              const url = subtitle.subtitle_url.startsWith('http') 
                ? subtitle.subtitle_url 
                : `https:${subtitle.subtitle_url}`;
              const response = await fetch(url);
              const data = await response.json();
              if (data.body) return this.formatSubtitles(data.body);
            }
          }
        }
        return null;
      } catch (error) {
        return null;
      }
    }

    async getTopComments(aid, bvid) {
      try {
        const oid = aid || bvid;
        const commentUrl = `${this.apiBase}/x/v2/reply?type=1&oid=${oid}&sort=2&ps=20`;
        const response = await fetch(commentUrl, {
          credentials: 'include',
          headers: { 'Referer': 'https://www.bilibili.com' }
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (data.code !== 0 || !data.data?.replies?.length) return null;
        const comments = [];
        const replies = data.data.replies.slice(0, 10);
        replies.forEach(reply => {
          if (reply.content?.message && reply.content.message.length > 5) {
            const msg = reply.content.message.trim();
            // 过滤掉太短或只包含符号的评论
            if (msg.length >= 10 && /[\u4e00-\u9fa5a-zA-Z]/.test(msg)) {
              comments.push({ text: msg, likes: reply.like || 0 });
            }
          }
        });
        if (comments.length > 0) {
          comments.sort((a, b) => b.likes - a.likes);
          return {
            fullText: comments.map(c => c.text).join('\n'),
            count: comments.length,
            topLikes: comments[0]?.likes || 0
          };
        }
        return null;
      } catch (error) {
        return null;
      }
    }

    generateTagDescription(tags) {
      if (!tags || tags.length === 0) return '';
      return `本视频的主题标签包括：${tags.slice(0, 8).join('、')}。`;
    }

    generateStatsDescription(stats) {
      if (!stats) return '';
      const parts = [];
      if (stats.view > 10000) parts.push(`该视频播放量达到${(stats.view / 10000).toFixed(1)}万`);
      if (stats.like > 1000) parts.push(`获得${(stats.like / 10000).toFixed(1)}万点赞`);
      if (stats.coin > 500) parts.push(`${(stats.coin / 10000).toFixed(1)}万投币`);
      if (parts.length > 0) return parts.join('，') + '，说明内容受到观众欢迎。';
      return '';
    }

    formatSubtitles(subtitleBody) {
      const formatted = { fullText: '', segments: [] };
      subtitleBody.forEach(segment => {
        const text = segment.content || '';
        const timestamp = this.formatTime(segment.from || 0);
        formatted.fullText += text + ' ';
        formatted.segments.push({ time: segment.from, timestamp, text });
      });
      formatted.fullText = formatted.fullText.trim();
      return formatted;
    }

    formatTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    async extractVideoContent() {
      try {
        console.log('🎬 开始提取 Bilibili 视频内容...');
        const videoInfo = this.extractVideoInfoFromPage();
        console.log('📊 Bilibili视频信息:', videoInfo);
        if (!videoInfo.bvid && !videoInfo.aid) {
          throw new Error('无法获取视频ID');
        }
        let contentParts = [];
        let subtitles = null;
        let comments = null;

        if (videoInfo.bvid && videoInfo.cid) {
          console.log('📝 尝试获取字幕...');
          subtitles = await this.getSubtitles(videoInfo.bvid, videoInfo.cid);
          if (subtitles && subtitles.fullText) {
            contentParts.push({ source: '字幕', content: subtitles.fullText, weight: 10 });
            console.log('✅ 成功获取字幕:', subtitles.fullText.length, '字');
          }
        }

        if (!subtitles && (videoInfo.aid || videoInfo.bvid)) {
          console.log('💬 字幕不可用，尝试获取热门评论...');
          comments = await this.getTopComments(videoInfo.aid, videoInfo.bvid);
          if (comments && comments.fullText) {
            contentParts.push({ source: '热门评论', content: comments.fullText, weight: 7 });
            console.log('✅ 成功获取评论:', comments.count, '条');
          }
        }

        if (videoInfo.description && videoInfo.description.length > 10) {
          contentParts.push({
            source: '简介',
            content: videoInfo.description,
            weight: subtitles ? 3 : (comments ? 6 : 9)
          });
          console.log('📄 添加视频简介:', videoInfo.description.length, '字');
        }

        if (videoInfo.tags && videoInfo.tags.length > 0) {
          const tagDesc = this.generateTagDescription(videoInfo.tags);
          if (tagDesc) {
            contentParts.push({ source: '标签', content: tagDesc, weight: 2 });
            console.log('🏷️ 添加标签描述');
          }
        }

        const statsDesc = this.generateStatsDescription({ view: videoInfo.view, like: videoInfo.like, coin: videoInfo.coin });
        if (statsDesc) {
          contentParts.push({ source: '统计', content: statsDesc, weight: 1 });
          console.log('📊 添加统计描述');
        }

        let finalContent = '';
        let contentSources = [];
        if (contentParts.length > 0) {
          contentParts.sort((a, b) => b.weight - a.weight);
          contentParts.forEach(part => {
            if (part.content) {
              finalContent += part.content + '\n\n';
              contentSources.push(part.source);
            }
          });
          finalContent = finalContent.trim();
        }

        if (!finalContent) {
          finalContent = videoInfo.title;
          contentSources.push('标题');
          console.warn('⚠️ 无法获取视频内容，使用标题');
        }

        console.log('🎉 内容提取完成！来源:', contentSources.join(' + '), '总长度:', finalContent.length, '字');

        return {
          type: 'video-bilibili',
          title: videoInfo.title,
          url: window.location.href,
          videoInfo: videoInfo,
          content: finalContent,
          contentSources: contentSources,
          metadata: {
            duration: videoInfo.duration,
            author: videoInfo.author,
            cover: videoInfo.cover,
            pubdate: videoInfo.pubdate,
            tags: videoInfo.tags,
            stats: { view: videoInfo.view, like: videoInfo.like }
          },
          subtitles: subtitles ? {
            available: true,
            fullText: subtitles.fullText,
            segments: subtitles.segments,
            method: 'api'
          } : {
            available: false,
            message: comments ? 
              `该视频没有字幕，已获取 ${comments.count} 条热门评论作为补充` :
              '该视频没有字幕，已综合简介、标签等信息生成摘要'
          },
          comments: comments ? {
            available: true,
            count: comments.count,
            topLikes: comments.topLikes,
            sample: comments.fullText.substring(0, 300) + (comments.fullText.length > 300 ? '...' : '')
          } : null
        };
      } catch (error) {
        console.error('❌ 提取Bilibili视频内容失败:', error);
        throw error;
      }
    }

    static isBilibiliVideoPage() {
      return window.location.hostname.includes('bilibili.com') && 
             window.location.pathname.includes('/video/');
    }
  }

  // 直接导出到 window
  window.BilibiliAdapter = BilibiliAdapter;
  console.log('✅ BilibiliAdapter 已集成到 content.js 并导出');
}

// ==================== YouTube 适配器（集成版）====================
// 检测并初始化 YouTube 适配器

if ((window.location.hostname.includes('youtube.com') && window.location.pathname === '/watch') ||
    window.location.hostname.includes('youtu.be')) {
  console.log('🎬 检测到 YouTube 视频页面，初始化适配器...');
  
  class YouTubeAdapter {
    constructor() {
      this.apiBase = 'https://www.youtube.com';
    }

    /**
     * 从 URL 提取视频 ID
     */
    extractVideoId(url) {
      // youtube.com/watch?v=VIDEO_ID
      const match1 = url.match(/[?&]v=([^&]+)/);
      if (match1) return match1[1];
      
      // youtu.be/VIDEO_ID
      const match2 = url.match(/youtu\.be\/([^?]+)/);
      if (match2) return match2[1];
      
      return null;
    }

    /**
     * 从页面提取视频信息
     */
    extractVideoInfoFromPage() {
      try {
        // YouTube 将数据存储在 ytInitialPlayerResponse 或 ytInitialData 中
        let videoData = null;
        
        // 方法1: 从 ytInitialPlayerResponse 获取
        if (window.ytInitialPlayerResponse) {
          videoData = window.ytInitialPlayerResponse.videoDetails;
        }
        
        // 方法2: 从 DOM 脚本标签中提取
        if (!videoData) {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.textContent;
            if (content.includes('ytInitialPlayerResponse')) {
              const match = content.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
              if (match) {
                try {
                  const data = JSON.parse(match[1]);
                  videoData = data.videoDetails;
                  break;
                } catch (e) {
                  console.warn('解析 ytInitialPlayerResponse 失败:', e);
                }
              }
            }
          }
        }
        
        if (!videoData) {
          throw new Error('无法从页面获取视频信息');
        }
        
        // 提取描述（从 ytInitialData）
        let description = '';
        try {
          if (window.ytInitialData) {
            const results = window.ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents;
            if (results) {
              const videoSecondary = results.find(r => r.videoSecondaryInfoRenderer);
              if (videoSecondary) {
                const desc = videoSecondary.videoSecondaryInfoRenderer?.attributedDescription?.content;
                description = desc || '';
              }
            }
          }
        } catch (e) {
          console.warn('提取描述失败:', e);
        }
        
        return {
          videoId: videoData.videoId,
          title: videoData.title || document.title.replace(' - YouTube', ''),
          description: description || '',
          duration: parseInt(videoData.lengthSeconds) || 0,
          author: videoData.author || '',
          channelId: videoData.channelId || '',
          viewCount: parseInt(videoData.viewCount) || 0,
          thumbnail: videoData.thumbnail?.thumbnails?.[0]?.url || ''
        };
      } catch (error) {
        console.error('提取 YouTube 视频信息失败:', error);
        return this.extractBasicInfoFromDOM();
      }
    }

    /**
     * 从 DOM 提取基本信息（降级方案）
     */
    extractBasicInfoFromDOM() {
      const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer') ||
                     document.querySelector('h1.title');
      const channelEl = document.querySelector('ytd-channel-name a') ||
                       document.querySelector('#owner-name a');
      
      return {
        videoId: this.extractVideoId(window.location.href) || '',
        title: titleEl?.textContent?.trim() || document.title.replace(' - YouTube', ''),
        description: '',
        duration: 0,
        author: channelEl?.textContent?.trim() || '',
        channelId: '',
        viewCount: 0,
        thumbnail: ''
      };
    }

    /**
     * 获取视频字幕
     */
    async getSubtitles(videoId) {
      try {
        console.log('📝 尝试获取 YouTube 字幕...');
        
        // YouTube 字幕需要通过 timedtext API
        // 格式: https://www.youtube.com/api/timedtext?v=VIDEO_ID&lang=zh-Hans
        
        // 先尝试获取字幕列表
        const captionsUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
        
        const listResponse = await fetch(captionsUrl);
        if (!listResponse.ok) {
          console.warn('无法获取字幕列表');
          return null;
        }
        
        const listText = await listResponse.text();
        const parser = new DOMParser();
        const listDoc = parser.parseFromString(listText, 'text/xml');
        const tracks = listDoc.querySelectorAll('track');
        
        if (tracks.length === 0) {
          console.log('该视频没有字幕');
          return null;
        }
        
        // 优先选择中文字幕
        let selectedTrack = null;
        for (const track of tracks) {
          const lang = track.getAttribute('lang_code');
          if (lang?.includes('zh') || lang?.includes('ch')) {
            selectedTrack = track;
            break;
          }
        }
        
        // 如果没有中文，选择英文
        if (!selectedTrack) {
          for (const track of tracks) {
            const lang = track.getAttribute('lang_code');
            if (lang === 'en') {
              selectedTrack = track;
              break;
            }
          }
        }
        
        // 如果还是没有，选第一个
        if (!selectedTrack && tracks.length > 0) {
          selectedTrack = tracks[0];
        }
        
        if (!selectedTrack) return null;
        
        const lang = selectedTrack.getAttribute('lang_code');
        console.log('✅ 找到字幕:', selectedTrack.getAttribute('name'), `(${lang})`);
        
        // 获取字幕内容
        const subtitleUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
        const subtitleResponse = await fetch(subtitleUrl);
        const subtitleText = await subtitleResponse.text();
        const subtitleDoc = parser.parseFromString(subtitleText, 'text/xml');
        const textNodes = subtitleDoc.querySelectorAll('text');
        
        if (textNodes.length === 0) {
          console.warn('字幕内容为空');
          return null;
        }
        
        let fullText = '';
        const segments = [];
        
        textNodes.forEach(node => {
          const text = node.textContent.trim();
          const start = parseFloat(node.getAttribute('start')) || 0;
          
          if (text) {
            fullText += text + ' ';
            segments.push({
              time: start,
              timestamp: this.formatTime(start),
              text: text
            });
          }
        });
        
        fullText = fullText.trim();
        
        console.log('🎉 成功获取字幕，共', segments.length, '条');
        
        return {
          fullText: fullText,
          segments: segments,
          language: lang
        };
      } catch (error) {
        console.error('获取 YouTube 字幕失败:', error);
        return null;
      }
    }

    /**
     * 获取视频评论（从页面）
     */
    async getTopComments() {
      try {
        console.log('💬 尝试从页面提取评论...');
        
        // 等待评论加载
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
        
        if (commentElements.length === 0) {
          console.log('页面上没有找到评论');
          return null;
        }
        
        const comments = [];
        
        for (let i = 0; i < Math.min(10, commentElements.length); i++) {
          const elem = commentElements[i];
          const textEl = elem.querySelector('#content-text');
          const likeEl = elem.querySelector('#vote-count-middle');
          
          if (textEl) {
            const text = textEl.textContent.trim();
            const likes = likeEl?.textContent.trim() || '0';
            
            if (text.length >= 10 && /[\u4e00-\u9fa5a-zA-Z]/.test(text)) {
              comments.push({
                text: text,
                likes: this.parseLikeCount(likes)
              });
            }
          }
        }
        
        if (comments.length > 0) {
          comments.sort((a, b) => b.likes - a.likes);
          
          console.log('✅ 成功提取', comments.length, '条评论');
          
          return {
            fullText: comments.map(c => c.text).join('\n'),
            count: comments.length,
            topLikes: comments[0]?.likes || 0
          };
        }
        
        return null;
      } catch (error) {
        console.error('提取评论失败:', error);
        return null;
      }
    }

    /**
     * 解析点赞数（如 "1.2K" -> 1200）
     */
    parseLikeCount(str) {
      if (!str) return 0;
      str = str.toLowerCase().trim();
      if (str.includes('k')) {
        return parseFloat(str) * 1000;
      } else if (str.includes('m')) {
        return parseFloat(str) * 1000000;
      }
      return parseInt(str) || 0;
    }

    /**
     * 格式化时间戳
     */
    formatTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 提取视频完整内容
     */
    async extractVideoContent() {
      try {
        console.log('🎬 开始提取 YouTube 视频内容...');
        
        const videoInfo = this.extractVideoInfoFromPage();
        console.log('📊 YouTube 视频信息:', videoInfo);
        
        if (!videoInfo.videoId) {
          throw new Error('无法获取视频ID');
        }
        
        let contentParts = [];
        let subtitles = null;
        let comments = null;
        
        // 尝试获取字幕
        subtitles = await this.getSubtitles(videoInfo.videoId);
        if (subtitles && subtitles.fullText) {
          contentParts.push({
            source: '字幕',
            content: subtitles.fullText,
            weight: 10
          });
          console.log('✅ 成功获取字幕:', subtitles.fullText.length, '字');
        }
        
        // 如果没有字幕，尝试获取评论
        if (!subtitles) {
          console.log('💬 字幕不可用，尝试提取评论...');
          comments = await this.getTopComments();
          if (comments && comments.fullText) {
            contentParts.push({
              source: '热门评论',
              content: comments.fullText,
              weight: 7
            });
            console.log('✅ 成功获取评论:', comments.count, '条');
          }
        }
        
        // 添加视频描述
        if (videoInfo.description && videoInfo.description.length > 10) {
          contentParts.push({
            source: '简介',
            content: videoInfo.description,
            weight: subtitles ? 3 : (comments ? 6 : 9)
          });
          console.log('📄 添加视频简介:', videoInfo.description.length, '字');
        }
        
        // 组合内容
        let finalContent = '';
        let contentSources = [];
        
        if (contentParts.length > 0) {
          contentParts.sort((a, b) => b.weight - a.weight);
          contentParts.forEach(part => {
            if (part.content) {
              finalContent += part.content + '\n\n';
              contentSources.push(part.source);
            }
          });
          finalContent = finalContent.trim();
        }
        
        if (!finalContent) {
          finalContent = videoInfo.title;
          contentSources.push('标题');
          console.warn('⚠️ 无法获取视频内容，使用标题');
        }
        
        console.log('🎉 内容提取完成！来源:', contentSources.join(' + '), '总长度:', finalContent.length, '字');
        
        return {
          type: 'video-youtube',
          title: videoInfo.title,
          url: window.location.href,
          videoInfo: videoInfo,
          content: finalContent,
          contentSources: contentSources,
          metadata: {
            duration: videoInfo.duration,
            author: videoInfo.author,
            thumbnail: videoInfo.thumbnail,
            viewCount: videoInfo.viewCount
          },
          subtitles: subtitles ? {
            available: true,
            fullText: subtitles.fullText,
            segments: subtitles.segments,
            language: subtitles.language
          } : {
            available: false,
            message: comments ? 
              `该视频没有字幕，已提取 ${comments.count} 条热门评论作为补充` :
              '该视频没有字幕，已使用简介生成摘要'
          },
          comments: comments ? {
            available: true,
            count: comments.count,
            topLikes: comments.topLikes,
            sample: comments.fullText.substring(0, 300) + (comments.fullText.length > 300 ? '...' : '')
          } : null
        };
      } catch (error) {
        console.error('❌ 提取 YouTube 视频内容失败:', error);
        throw error;
      }
    }

    static isYouTubeVideoPage() {
      return (window.location.hostname.includes('youtube.com') && window.location.pathname === '/watch') ||
             window.location.hostname.includes('youtu.be');
    }
  }

  // 导出到 window
  window.YouTubeAdapter = YouTubeAdapter;
  console.log('✅ YouTubeAdapter 已集成到 content.js 并导出');
}

// ==================== PDF 适配器（集成版）====================
// 检测并初始化 PDF 适配器

if (window.location.href.endsWith('.pdf') || 
    document.contentType === 'application/pdf' ||
    window.location.href.includes('chrome-extension://') && window.location.href.includes('.pdf')) {
  console.log('📄 检测到 PDF 文件，初始化适配器...');
  
  class PDFAdapter {
    constructor() {
      this.pdfDocument = null;
    }

    /**
     * 检测 PDF.js 是否可用
     */
    async ensurePDFJS() {
      // 检查是否已经有 PDF.js
      if (typeof pdfjsLib !== 'undefined') {
        return true;
      }

      // 尝试从 Chrome 的 PDF viewer 中访问
      if (typeof window.PDFViewerApplication !== 'undefined') {
        return true;
      }

      // 动态加载 PDF.js
      try {
        await this.loadPDFJS();
        return true;
      } catch (error) {
        console.error('无法加载 PDF.js:', error);
        return false;
      }
    }

    /**
     * 动态加载 PDF.js 库
     */
    async loadPDFJS() {
      return new Promise((resolve, reject) => {
        if (typeof pdfjsLib !== 'undefined') {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          // 设置 worker
          if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          } else {
            reject(new Error('PDF.js 加载失败'));
          }
        };
        script.onerror = () => reject(new Error('无法加载 PDF.js 脚本'));
        document.head.appendChild(script);
      });
    }

    /**
     * 从 Chrome PDF Viewer 获取文本
     */
    async extractFromChromeViewer() {
      try {
        console.log('🔍 尝试从 Chrome PDF Viewer 提取文本...');
        
        // 方法1: 使用 PDFViewerApplication (Chrome 内置 PDF viewer)
        if (typeof window.PDFViewerApplication !== 'undefined' && 
            window.PDFViewerApplication.pdfDocument) {
          const pdfDoc = window.PDFViewerApplication.pdfDocument;
          const numPages = pdfDoc.numPages;
          
          console.log(`📄 PDF 共 ${numPages} 页`);
          
          let fullText = '';
          const maxPages = Math.min(numPages, 50); // 限制最多提取50页
          
          for (let i = 1; i <= maxPages; i++) {
            try {
              const page = await pdfDoc.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(' ');
              fullText += pageText + '\n\n';
              
              if (i % 5 === 0) {
                console.log(`📄 已提取 ${i}/${maxPages} 页...`);
              }
            } catch (pageError) {
              console.warn(`⚠️ 第 ${i} 页提取失败:`, pageError);
            }
          }
          
          if (numPages > maxPages) {
            console.log(`ℹ️ PDF 共 ${numPages} 页，已提取前 ${maxPages} 页`);
          }
          
          return {
            text: fullText.trim(),
            pages: numPages,
            extractedPages: maxPages,
            method: 'chrome-viewer'
          };
        }
        
        return null;
      } catch (error) {
        console.error('从 Chrome Viewer 提取失败:', error);
        return null;
      }
    }

    /**
     * 使用 PDF.js 直接解析 PDF
     */
    async extractUsingPDFJS(url) {
      try {
        console.log('🔍 使用 PDF.js 解析 PDF...');
        
        if (typeof pdfjsLib === 'undefined') {
          throw new Error('PDF.js 未加载');
        }
        
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        
        console.log(`📄 PDF 共 ${numPages} 页`);
        
        let fullText = '';
        const maxPages = Math.min(numPages, 50);
        
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
          
          if (i % 5 === 0) {
            console.log(`📄 已提取 ${i}/${maxPages} 页...`);
          }
        }
        
        if (numPages > maxPages) {
          console.log(`ℹ️ PDF 共 ${numPages} 页，已提取前 ${maxPages} 页`);
        }
        
        return {
          text: fullText.trim(),
          pages: numPages,
          extractedPages: maxPages,
          method: 'pdfjs'
        };
      } catch (error) {
        console.error('使用 PDF.js 解析失败:', error);
        return null;
      }
    }

    /**
     * 从 DOM 提取可见文本（降级方案）
     */
    extractFromDOM() {
      try {
        console.log('🔍 尝试从 DOM 提取文本...');
        
        // 查找所有文本层
        const textLayers = document.querySelectorAll('.textLayer');
        
        if (textLayers.length > 0) {
          let text = '';
          textLayers.forEach((layer, index) => {
            const layerText = layer.textContent || '';
            text += layerText + '\n\n';
          });
          
          console.log(`✅ 从 DOM 提取了 ${textLayers.length} 个文本层`);
          
          return {
            text: text.trim(),
            pages: textLayers.length,
            extractedPages: textLayers.length,
            method: 'dom'
          };
        }
        
        // 如果没有文本层，尝试提取所有可见文本
        const bodyText = document.body.textContent || '';
        if (bodyText.length > 100) {
          console.log('✅ 从 body 提取了文本');
          return {
            text: bodyText.trim(),
            pages: 1,
            extractedPages: 1,
            method: 'body'
          };
        }
        
        return null;
      } catch (error) {
        console.error('从 DOM 提取失败:', error);
        return null;
      }
    }

    /**
     * 提取 PDF 元数据
     */
    async extractMetadata() {
      try {
        // 从 Chrome Viewer 获取
        if (typeof window.PDFViewerApplication !== 'undefined' && 
            window.PDFViewerApplication.pdfDocument) {
          const metadata = await window.PDFViewerApplication.pdfDocument.getMetadata();
          return {
            title: metadata.info?.Title || '',
            author: metadata.info?.Author || '',
            subject: metadata.info?.Subject || '',
            keywords: metadata.info?.Keywords || '',
            creator: metadata.info?.Creator || '',
            producer: metadata.info?.Producer || '',
            creationDate: metadata.info?.CreationDate || '',
            modificationDate: metadata.info?.ModDate || ''
          };
        }
        
        return null;
      } catch (error) {
        console.warn('提取元数据失败:', error);
        return null;
      }
    }

    /**
     * 从文件名提取标题
     */
    getTitleFromURL() {
      const url = window.location.href;
      
      // 从 URL 中提取文件名
      const matches = url.match(/([^\/]+)\.pdf/i);
      if (matches && matches[1]) {
        let title = matches[1];
        // 解码 URL 编码
        title = decodeURIComponent(title);
        // 替换连字符和下划线为空格
        title = title.replace(/[-_]/g, ' ');
        return title;
      }
      
      return document.title || 'PDF文档';
    }

    /**
     * 提取完整的 PDF 内容
     */
    async extractPDFContent() {
      try {
        console.log('📄 开始提取 PDF 内容...');
        
        let extractResult = null;
        
        // 方法1: 从 Chrome PDF Viewer 提取
        extractResult = await this.extractFromChromeViewer();
        
        // 方法2: 如果方法1失败，尝试加载 PDF.js
        if (!extractResult || !extractResult.text) {
          const pdfJSReady = await this.ensurePDFJS();
          if (pdfJSReady) {
            extractResult = await this.extractUsingPDFJS(window.location.href);
          }
        }
        
        // 方法3: 从 DOM 提取（降级方案）
        if (!extractResult || !extractResult.text) {
          extractResult = this.extractFromDOM();
        }
        
        if (!extractResult || !extractResult.text) {
          throw new Error('无法提取 PDF 文本内容');
        }
        
        console.log(`✅ 成功提取 PDF 文本，共 ${extractResult.text.length} 字`);
        console.log(`📊 方法: ${extractResult.method}, 页数: ${extractResult.extractedPages}/${extractResult.pages}`);
        
        // 提取元数据
        const metadata = await this.extractMetadata();
        
        // 获取标题
        let title = this.getTitleFromURL();
        if (metadata && metadata.title) {
          title = metadata.title;
        }
        
        // 生成摘要文本（取前几段作为摘要）
        const paragraphs = extractResult.text.split('\n\n').filter(p => p.trim().length > 20);
        const excerpt = paragraphs.slice(0, 3).join('\n\n').substring(0, 500);
        
        return {
          type: 'document-pdf',
          title: title,
          url: window.location.href,
          content: extractResult.text,
          excerpt: excerpt,
          metadata: {
            pages: extractResult.pages,
            extractedPages: extractResult.extractedPages,
            extractMethod: extractResult.method,
            ...metadata,
            fileSize: this.formatFileSize(extractResult.text.length),
            wordCount: this.countWords(extractResult.text)
          },
          contentSources: ['PDF文本']
        };
      } catch (error) {
        console.error('❌ 提取 PDF 内容失败:', error);
        throw error;
      }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    /**
     * 统计字数
     */
    countWords(text) {
      // 中文字符 + 英文单词
      const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
      return chineseChars + englishWords;
    }

    static isPDFPage() {
      return window.location.href.endsWith('.pdf') || 
             document.contentType === 'application/pdf' ||
             (window.location.href.includes('chrome-extension://') && window.location.href.includes('.pdf'));
    }
  }

  // 导出到 window
  window.PDFAdapter = PDFAdapter;
  console.log('✅ PDFAdapter 已集成到 content.js 并导出');
}

// ==================== 悬浮球初始化 ====================

// 初始化悬浮球
(async function initFloatButton() {
  try {
    // 检查是否启用悬浮球
    const { enableFloatButton } = await chrome.storage.local.get(['enableFloatButton']);
    const enabled = enableFloatButton !== undefined ? enableFloatButton : true;
    
    console.log('悬浮球设置:', enabled);
    
    if (!enabled) {
      console.log('悬浮球已禁用');
      return;
    }
    
    // 创建悬浮球
    createFloatButton();
  } catch (error) {
    console.error('初始化悬浮球失败:', error);
  }
})();

// 监听设置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.enableFloatButton) {
    const enabled = changes.enableFloatButton.newValue;
    console.log('悬浮球设置已更改:', enabled);
    
    const existingButton = document.getElementById('digest-ai-float-button');
    if (enabled && !existingButton) {
      createFloatButton();
    } else if (!enabled && existingButton) {
      existingButton.remove();
      const styles = document.getElementById('digest-ai-float-styles');
      if (styles) styles.remove();
      const toastStyles = document.getElementById('digest-ai-toast-styles');
      if (toastStyles) toastStyles.remove();
    }
  }
});

/**
 * 创建悬浮球
 */
function createFloatButton() {
  // 避免重复创建
  if (document.getElementById('digest-ai-float-button')) {
    return;
  }
  
  // 创建按钮
  const button = document.createElement('div');
  button.id = 'digest-ai-float-button';
  button.innerHTML = `
    <div class="float-btn-icon">📚</div>
    <div class="float-btn-tooltip">保存文章</div>
  `;
  
  // 注入样式
  injectFloatButtonStyles();
  
  // 添加到页面
  document.body.appendChild(button);
  
  // 加载保存的位置
  loadButtonPosition(button);
  
  // 绑定事件
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  
  button.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    button.classList.add('dragging');
    
    const rect = button.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    startX = e.clientX;
    startY = e.clientY;
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    
    const maxX = window.innerWidth - button.offsetWidth;
    const maxY = window.innerHeight - button.offsetHeight;
    
    button.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    button.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
    
    e.preventDefault();
  });
  
  document.addEventListener('mouseup', async (e) => {
    if (!isDragging) return;
    
    isDragging = false;
    button.classList.remove('dragging');
    
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - startX, 2) + 
      Math.pow(e.clientY - startY, 2)
    );
    
    if (moveDistance < 5) {
      // 点击 - 保存文章
      await handleSaveArticle(button);
    } else {
      // 拖动 - 保存位置
      await saveButtonPosition(button);
    }
  });
}

/**
 * 注入样式
 */
function injectFloatButtonStyles() {
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
      animation: digest-ai-pulse 1s ease-in-out infinite;
    }
    
    @keyframes digest-ai-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
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
      animation: digest-ai-slideDown 0.3s ease-out;
    }
    
    .digest-ai-toast.success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    
    .digest-ai-toast.error {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    
    @keyframes digest-ai-slideDown {
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

/**
 * 保存文章
 */
async function handleSaveArticle(button) {
  button.classList.add('saving');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveArticle',
      url: window.location.href,
      title: document.title
    });
    
    if (response && response.success) {
      showToast('✅ 文章已保存', 'success');
    } else {
      throw new Error(response?.error || '保存失败');
    }
  } catch (error) {
    console.error('保存文章失败:', error);
    showToast('❌ ' + error.message, 'error');
  } finally {
    button.classList.remove('saving');
  }
}

/**
 * 显示提示
 */
function showToast(message, type = 'info') {
  const existingToast = document.getElementById('digest-ai-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'digest-ai-toast';
  toast.textContent = message;
  toast.className = `digest-ai-toast ${type}`;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'digest-ai-slideDown 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 保存位置
 */
async function saveButtonPosition(button) {
  const position = {
    left: button.style.left,
    top: button.style.top
  };
  
  await chrome.storage.local.set({ floatButtonPosition: position });
}

/**
 * 加载位置
 */
async function loadButtonPosition(button) {
  const { floatButtonPosition } = await chrome.storage.local.get(['floatButtonPosition']);
  
  if (floatButtonPosition?.left && floatButtonPosition?.top) {
    const leftPx = parseInt(floatButtonPosition.left, 10);
    const topPx = parseInt(floatButtonPosition.top, 10);
    const maxX = window.innerWidth - 56;
    const maxY = window.innerHeight - 56;
    const clampedLeft = Math.max(0, Math.min(isNaN(leftPx) ? 0 : leftPx, maxX));
    const clampedTop = Math.max(0, Math.min(isNaN(topPx) ? 0 : topPx, maxY));
    button.style.left = `${clampedLeft}px`;
    button.style.top = `${clampedTop}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
  }
}

// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    // 异步处理提取逻辑
    (async () => {
      try {
        const extractedContent = await extractContent();
        sendResponse({ success: true, content: extractedContent });
      } catch (error) {
        console.error('提取内容失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 保持消息通道开启以支持异步响应
  }
  return false;
});

/**
 * 检测内容类型并提取相应内容
 */
async function extractContent() {
  const contentType = detectContentType();
  
  console.log('检测到内容类型:', contentType);
  
  switch (contentType) {
    case 'document-pdf':
      return await extractPDFDocument();
    case 'video-bilibili':
      return await extractBilibiliVideo();
    case 'video-youtube':
      return await extractYouTubeVideo();
    default:
      return extractArticleContent();
  }
}

/**
 * 检测当前页面的内容类型
 */
function detectContentType() {
  const url = window.location.href;
  const hostname = window.location.hostname;
  
  // PDF 文档
  if (url.endsWith('.pdf') || 
      document.contentType === 'application/pdf' ||
      (url.includes('chrome-extension://') && url.includes('.pdf'))) {
    return 'document-pdf';
  }
  
  // Bilibili 视频页面
  if (hostname.includes('bilibili.com') && url.includes('/video/')) {
    return 'video-bilibili';
  }
  
  // YouTube 视频页面
  if (hostname.includes('youtube.com') && url.includes('/watch')) {
    return 'video-youtube';
  }
  
  // 默认为网页文章
  return 'webpage';
}

/**
 * 提取 Bilibili 视频内容（使用集成的适配器）
 */
async function extractBilibiliVideo() {
  try {
    console.log('🎬 使用集成的 BilibiliAdapter 提取视频内容...');
    
    // BilibiliAdapter 已在文件开头定义，直接使用
    if (typeof BilibiliAdapter === 'undefined') {
      throw new Error('BilibiliAdapter 未定义，这不应该发生！');
    }
    
    const adapter = new BilibiliAdapter();
    const videoContent = await adapter.extractVideoContent();
    
    return videoContent;
  } catch (error) {
    console.error('❌ 提取Bilibili视频失败:', error);
    throw new Error('提取视频内容失败: ' + error.message);
  }
}

/**
 * 提取 YouTube 视频内容（使用集成的适配器）
 */
async function extractYouTubeVideo() {
  try {
    console.log('🎬 使用集成的 YouTubeAdapter 提取视频内容...');
    
    // YouTubeAdapter 已在文件开头定义，直接使用
    if (typeof YouTubeAdapter === 'undefined') {
      throw new Error('YouTubeAdapter 未定义，这不应该发生！');
    }
    
    const adapter = new YouTubeAdapter();
    const videoContent = await adapter.extractVideoContent();
    
    return videoContent;
  } catch (error) {
    console.error('❌ 提取 YouTube 视频失败:', error);
    throw new Error('提取视频内容失败: ' + error.message);
  }
}

/**
 * 提取 PDF 文档内容（使用集成的适配器）
 */
async function extractPDFDocument() {
  try {
    console.log('📄 使用集成的 PDFAdapter 提取文档内容...');
    
    // PDFAdapter 已在文件开头定义，直接使用
    if (typeof PDFAdapter === 'undefined') {
      throw new Error('PDFAdapter 未定义，这不应该发生！');
    }
    
    const adapter = new PDFAdapter();
    const pdfContent = await adapter.extractPDFContent();
    
    return pdfContent;
  } catch (error) {
    console.error('❌ 提取 PDF 文档失败:', error);
    throw new Error('提取文档内容失败: ' + error.message);
  }
}

/**
 * 提取文章内容
 * 使用 Readability 库或自定义提取逻辑
 */
function extractArticleContent() {
  // 克隆当前文档以避免修改原始 DOM
  const documentClone = document.cloneNode(true);
  
  // 使用 Readability 提取内容（如果可用）
  if (typeof Readability !== 'undefined') {
    try {
      const reader = new Readability(documentClone);
      const article = reader.parse();
      
      if (article) {
        return {
          type: 'webpage',
          title: article.title || document.title,
          content: article.textContent || '',
          htmlContent: article.content || '',
          excerpt: article.excerpt || '',
          byline: article.byline || '',
          siteName: getSiteName(),
          length: article.length || 0
        };
      }
    } catch (error) {
      console.warn('Readability 提取失败，使用备用方法:', error);
    }
  }
  
  // 备用提取方法
  return fallbackExtraction();
}

/**
 * 备用提取方法
 * 当 Readability 不可用或失败时使用
 */
function fallbackExtraction() {
  // 尝试查找主要内容区域
  const mainSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '#content',
    '.content'
  ];
  
  let mainContent = null;
  
  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 200) {
      mainContent = element;
      break;
    }
  }
  
  // 如果没有找到主要内容，使用 body
  if (!mainContent) {
    mainContent = document.body;
  }
  
  // 提取文本内容
  const content = extractTextFromElement(mainContent);
  
  return {
    type: 'webpage',
    title: extractTitle(),
    content: content,
    htmlContent: mainContent.innerHTML,
    excerpt: content.substring(0, 300),
    byline: extractAuthor(),
    siteName: getSiteName(),
    length: content.length
  };
}

/**
 * 从元素中提取文本
 */
function extractTextFromElement(element) {
  // 移除不需要的元素
  const clone = element.cloneNode(true);
  const unwantedSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'iframe',
    '.ad',
    '.advertisement',
    '.social-share',
    '.comments'
  ];
  
  unwantedSelectors.forEach(selector => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  // 获取文本内容并清理
  let text = clone.textContent || '';
  
  // 清理多余的空白
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * 提取标题
 */
function extractTitle() {
  // 尝试多种方式获取标题
  const titleSelectors = [
    'h1',
    '.article-title',
    '.post-title',
    '[property="og:title"]',
    '[name="twitter:title"]'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.getAttribute('content') || element.textContent.trim();
    }
  }
  
  return document.title;
}

/**
 * 提取作者信息
 */
function extractAuthor() {
  const authorSelectors = [
    '[rel="author"]',
    '.author',
    '.byline',
    '[property="article:author"]',
    '[name="author"]'
  ];
  
  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.getAttribute('content') || element.textContent.trim();
    }
  }
  
  return '';
}

/**
 * 获取网站名称
 */
function getSiteName() {
  // 尝试从 meta 标签获取
  const siteNameMeta = document.querySelector('[property="og:site_name"]');
  if (siteNameMeta) {
    return siteNameMeta.getAttribute('content');
  }
  
  // 从域名提取
  try {
    const hostname = window.location.hostname;
    return hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

/**
 * 高亮显示提取的内容（用于调试）
 */
function highlightExtractedContent() {
  const article = document.querySelector('article');
  if (article) {
    article.style.outline = '2px solid #667eea';
    article.style.backgroundColor = 'rgba(102, 126, 234, 0.05)';
  }
}

// 可选：在开发模式下显示提取结果
if (typeof DEBUG !== 'undefined' && DEBUG) {
  console.log('Content script loaded');
}

