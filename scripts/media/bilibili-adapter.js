/**
 * Bilibili 视频内容适配器
 * 用于提取Bilibili视频的标题、字幕、弹幕等信息
 */

// 加载确认日志
console.log('🎬 Bilibili适配器脚本开始加载...');
console.log('📁 当前URL:', window.location.href);
console.log('⏰ 加载时间:', new Date().toISOString());

class BilibiliAdapter {
  constructor() {
    this.apiBase = 'https://api.bilibili.com';
  }

  /**
   * 从URL提取视频ID
   * 支持格式：
   * - https://www.bilibili.com/video/BV1xx411c7mD
   * - https://www.bilibili.com/video/av12345678
   */
  extractVideoId(url) {
    // BV号格式
    const bvMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    if (bvMatch) {
      return { type: 'bvid', id: bvMatch[1] };
    }
    
    // AV号格式
    const avMatch = url.match(/\/video\/av(\d+)/);
    if (avMatch) {
      return { type: 'aid', id: avMatch[1] };
    }
    
    return null;
  }

  /**
   * 从页面DOM提取视频信息
   * 这是最可靠的方法，因为Bilibili的初始数据在页面中
   */
  extractVideoInfoFromPage() {
    try {
      // Bilibili会在页面中注入window.__INITIAL_STATE__
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
        cid: videoData.cid || videoData.pages?.[0]?.cid || '', // 视频分P的CID
        pubdate: videoData.pubdate ? new Date(videoData.pubdate * 1000).toISOString() : '',
        tags: (videoData.tag || []).map(tag => tag.tag_name || tag),
        view: videoData.stat?.view || 0,
        like: videoData.stat?.like || 0
      };
    } catch (error) {
      console.error('提取Bilibili视频信息失败:', error);
      
      // 降级方案：从DOM提取基本信息
      return this.extractBasicInfoFromDOM();
    }
  }

  /**
   * 从DOM元素提取基本信息（降级方案）
   */
  extractBasicInfoFromDOM() {
    const titleEl = document.querySelector('h1.video-title') || 
                   document.querySelector('.video-title');
    const descEl = document.querySelector('.video-desc') ||
                  document.querySelector('.basic-desc-info');
    const authorEl = document.querySelector('.up-name') ||
                    document.querySelector('.username');
    
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
      like: 0
    };
  }

  /**
   * 获取视频字幕 - 改进版，支持多种方式
   * Bilibili的字幕需要通过API请求
   */
  async getSubtitles(bvid, cid) {
    console.log('🔍 开始获取字幕:', { bvid, cid });
    
    try {
      // 方法1: 尝试使用新版 API
      const subtitleListUrl = `${this.apiBase}/x/player/wbi/v2?bvid=${bvid}&cid=${cid}`;
      
      console.log('📡 请求字幕API:', subtitleListUrl);
      
      const response = await fetch(subtitleListUrl, {
        credentials: 'include',
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': navigator.userAgent
        }
      });
      
      if (!response.ok) {
        console.warn('⚠️ 字幕API请求失败，尝试备用方法');
        return await this.getSubtitlesFromDOM();
      }
      
      const data = await response.json();
      console.log('📦 字幕API响应:', data);
      
      if (data.code !== 0) {
        console.warn('⚠️ API返回错误码:', data.code, data.message);
        return await this.getSubtitlesFromDOM();
      }
      
      if (!data.data?.subtitle?.subtitles?.length) {
        console.log('ℹ️ 该视频没有字幕，尝试其他方法');
        return await this.getSubtitlesFromDOM();
      }
      
      // 优先选择中文字幕
      const subtitles = data.data.subtitle.subtitles;
      console.log('📝 可用字幕列表:', subtitles.map(s => ({ lan: s.lan, lan_doc: s.lan_doc })));
      
      const chineseSubtitle = subtitles.find(s => 
        s.lan === 'zh-CN' || 
        s.lan === 'zh-Hans' || 
        s.lan === 'zh-Hant' ||
        s.lan_doc?.includes('中文')
      ) || subtitles[0];
      
      if (!chineseSubtitle || !chineseSubtitle.subtitle_url) {
        console.log('❌ 没有可用的字幕URL');
        return await this.getSubtitlesFromDOM();
      }
      
      console.log('✅ 找到字幕:', chineseSubtitle.lan_doc, chineseSubtitle.subtitle_url);
      
      // 获取字幕内容
      const subtitleUrl = chineseSubtitle.subtitle_url.startsWith('http') 
        ? chineseSubtitle.subtitle_url 
        : `https:${chineseSubtitle.subtitle_url}`;
      
      const subtitleResponse = await fetch(subtitleUrl);
      const subtitleData = await subtitleResponse.json();
      
      if (!subtitleData.body || !Array.isArray(subtitleData.body)) {
        console.error('❌ 字幕格式错误:', subtitleData);
        return await this.getSubtitlesFromDOM();
      }
      
      console.log('🎉 成功获取字幕，共', subtitleData.body.length, '条');
      
      // 转换字幕格式
      return this.formatSubtitles(subtitleData.body);
    } catch (error) {
      console.error('❌ 获取Bilibili字幕失败:', error);
      // 尝试备用方法
      return await this.getSubtitlesFromDOM();
    }
  }
  
  /**
   * 从页面DOM提取字幕（备用方法）
   */
  async getSubtitlesFromDOM() {
    try {
      console.log('🔄 尝试从DOM提取字幕数据...');
      
      // 检查页面中是否有字幕数据
      const initialState = window.__INITIAL_STATE__;
      if (initialState?.videoData?.subtitle?.list) {
        console.log('✅ 从 __INITIAL_STATE__ 找到字幕');
        const subtitleList = initialState.videoData.subtitle.list;
        if (subtitleList.length > 0) {
          const subtitle = subtitleList[0];
          if (subtitle.subtitle_url) {
            const url = subtitle.subtitle_url.startsWith('http') 
              ? subtitle.subtitle_url 
              : `https:${subtitle.subtitle_url}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.body) {
              return this.formatSubtitles(data.body);
            }
          }
        }
      }
      
      console.log('ℹ️ DOM中没有找到字幕，将使用其他内容');
      return null;
    } catch (error) {
      console.error('从DOM提取字幕失败:', error);
      return null;
    }
  }
  
  /**
   * 获取热门评论（作为内容补充）
   */
  async getTopComments(aid, bvid) {
    try {
      console.log('💬 尝试获取热门评论...');
      
      // 使用aid或bvid都可以
      const oid = aid || bvid;
      const commentUrl = `${this.apiBase}/x/v2/reply?type=1&oid=${oid}&sort=2&ps=20`;
      
      const response = await fetch(commentUrl, {
        credentials: 'include',
        headers: {
          'Referer': 'https://www.bilibili.com'
        }
      });
      
      if (!response.ok) {
        console.warn('评论API请求失败');
        return null;
      }
      
      const data = await response.json();
      
      if (data.code !== 0 || !data.data?.replies?.length) {
        console.log('没有找到评论');
        return null;
      }
      
      const comments = [];
      const replies = data.data.replies.slice(0, 10); // 只取前10条热门评论
      
      replies.forEach(reply => {
        if (reply.content?.message && reply.content.message.length > 5) {
          // 过滤掉纯表情、无意义的评论
          const msg = reply.content.message.trim();
          if (msg.length >= 10 && !/^[😀-🙏]+$/.test(msg)) {
            comments.push({
              text: msg,
              likes: reply.like || 0
            });
          }
        }
      });
      
      if (comments.length > 0) {
        // 按点赞数排序
        comments.sort((a, b) => b.likes - a.likes);
        const commentText = comments.map(c => c.text).join('\n');
        
        console.log('✅ 成功获取', comments.length, '条有效评论');
        return {
          fullText: commentText,
          count: comments.length,
          topLikes: comments[0]?.likes || 0
        };
      }
      
      return null;
    } catch (error) {
      console.error('获取评论失败:', error);
      return null;
    }
  }
  
  /**
   * 从视频标签生成内容描述
   */
  generateTagDescription(tags) {
    if (!tags || tags.length === 0) return '';
    
    const tagText = tags.slice(0, 8).join('、');
    return `本视频的主题标签包括：${tagText}。`;
  }
  
  /**
   * 从视频统计数据生成描述
   */
  generateStatsDescription(stats) {
    if (!stats) return '';
    
    const parts = [];
    if (stats.view > 10000) {
      parts.push(`该视频播放量达到${(stats.view / 10000).toFixed(1)}万`);
    }
    if (stats.like > 1000) {
      parts.push(`获得${(stats.like / 10000).toFixed(1)}万点赞`);
    }
    if (stats.coin > 500) {
      parts.push(`${(stats.coin / 10000).toFixed(1)}万投币`);
    }
    
    if (parts.length > 0) {
      return parts.join('，') + '，说明内容受到观众欢迎。';
    }
    
    return '';
  }

  /**
   * 格式化字幕为可读文本
   */
  formatSubtitles(subtitleBody) {
    const formatted = {
      fullText: '',
      segments: []
    };
    
    subtitleBody.forEach(segment => {
      const text = segment.content || '';
      const timestamp = this.formatTime(segment.from || 0);
      
      formatted.fullText += text + ' ';
      formatted.segments.push({
        time: segment.from,
        timestamp: timestamp,
        text: text
      });
    });
    
    formatted.fullText = formatted.fullText.trim();
    
    return formatted;
  }

  /**
   * 格式化时间戳（秒转为 HH:MM:SS）
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
   * 获取视频的完整内容 - 增强版
   */
  async extractVideoContent() {
    try {
      console.log('🎬 开始提取 Bilibili 视频内容...');
      
      // 1. 提取视频基本信息
      const videoInfo = this.extractVideoInfoFromPage();
      
      console.log('📊 Bilibili视频信息:', videoInfo);
      
      if (!videoInfo.bvid && !videoInfo.aid) {
        throw new Error('无法获取视频ID');
      }
      
      // 2. 尝试多种方式获取内容
      let contentParts = [];
      let subtitles = null;
      let comments = null;
      
      // 尝试获取字幕
      if (videoInfo.bvid && videoInfo.cid) {
        console.log('📝 尝试获取字幕...');
        subtitles = await this.getSubtitles(videoInfo.bvid, videoInfo.cid);
        
        if (subtitles && subtitles.fullText) {
          contentParts.push({
            source: '字幕',
            content: subtitles.fullText,
            weight: 10 // 最高权重
          });
          console.log('✅ 成功获取字幕:', subtitles.fullText.length, '字');
        }
      }
      
      // 如果没有字幕，尝试获取热门评论（比弹幕更有价值）
      if (!subtitles && (videoInfo.aid || videoInfo.bvid)) {
        console.log('💬 字幕不可用，尝试获取热门评论...');
        comments = await this.getTopComments(videoInfo.aid, videoInfo.bvid);
        
        if (comments && comments.fullText) {
          contentParts.push({
            source: '热门评论',
            content: comments.fullText,
            weight: 7 // 评论权重较高，因为通常包含观众对视频的总结
          });
          console.log('✅ 成功获取评论:', comments.count, '条');
        }
      }
      
      // 添加视频简介（始终包含）
      if (videoInfo.description && videoInfo.description.length > 10) {
        contentParts.push({
          source: '简介',
          content: videoInfo.description,
          weight: subtitles ? 3 : (comments ? 6 : 9) // 动态权重
        });
        console.log('📄 添加视频简介:', videoInfo.description.length, '字');
      }
      
      // 添加标签描述
      if (videoInfo.tags && videoInfo.tags.length > 0) {
        const tagDesc = this.generateTagDescription(videoInfo.tags);
        if (tagDesc) {
          contentParts.push({
            source: '标签',
            content: tagDesc,
            weight: 2
          });
          console.log('🏷️ 添加标签描述');
        }
      }
      
      // 添加统计信息描述
      const statsDesc = this.generateStatsDescription({
        view: videoInfo.view,
        like: videoInfo.like,
        coin: videoInfo.coin
      });
      if (statsDesc) {
        contentParts.push({
          source: '统计',
          content: statsDesc,
          weight: 1
        });
        console.log('📊 添加统计描述');
      }
      
      // 3. 组合内容
      let finalContent = '';
      let contentSources = [];
      
      if (contentParts.length > 0) {
        // 按权重排序
        contentParts.sort((a, b) => b.weight - a.weight);
        
        // 组合内容
        contentParts.forEach(part => {
          if (part.content) {
            finalContent += part.content + '\n\n';
            contentSources.push(part.source);
          }
        });
        
        finalContent = finalContent.trim();
      }
      
      // 如果还是没有内容，使用标题作为最后手段
      if (!finalContent) {
        finalContent = videoInfo.title;
        contentSources.push('标题');
        console.warn('⚠️ 无法获取视频内容，使用标题');
      }
      
      console.log('🎉 内容提取完成！来源:', contentSources.join(' + '), '总长度:', finalContent.length, '字');
      
      // 4. 构建返回内容
      const content = {
        type: 'video-bilibili',
        title: videoInfo.title,
        url: window.location.href,
        videoInfo: videoInfo,
        
        // 综合的内容
        content: finalContent,
        contentSources: contentSources, // 标记内容来源
        
        // 额外的视频信息
        metadata: {
          duration: videoInfo.duration,
          author: videoInfo.author,
          cover: videoInfo.cover,
          pubdate: videoInfo.pubdate,
          tags: videoInfo.tags,
          stats: {
            view: videoInfo.view,
            like: videoInfo.like
          }
        },
        
        // 字幕信息
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
        
        // 评论信息
        comments: comments ? {
          available: true,
          count: comments.count,
          topLikes: comments.topLikes,
          sample: comments.fullText.substring(0, 300) + (comments.fullText.length > 300 ? '...' : '')
        } : null
      };
      
      return content;
    } catch (error) {
      console.error('❌ 提取Bilibili视频内容失败:', error);
      throw error;
    }
  }

  /**
   * 检查当前页面是否为Bilibili视频页
   */
  static isBilibiliVideoPage() {
    return window.location.hostname.includes('bilibili.com') && 
           window.location.pathname.includes('/video/');
  }
}

// 导出供content.js使用
if (typeof window !== 'undefined') {
  window.BilibiliAdapter = BilibiliAdapter;
  console.log('✅ BilibiliAdapter 已成功导出到 window 对象');
  console.log('🔍 验证: typeof window.BilibiliAdapter =', typeof window.BilibiliAdapter);
} else {
  console.error('❌ window 对象不可用，无法导出 BilibiliAdapter');
}

