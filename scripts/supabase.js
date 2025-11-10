// Minimal Supabase REST client for Auth and Database (PostgREST)
// Works in MV3 without external deps.
(function() {
  const SUPABASE_URL = 'https://rikwhcpglvmxzdyovzse.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa3doY3BnbHZteHpkeW92enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NDEyMzYsImV4cCI6MjA3ODMxNzIzNn0.iPwTGxBcsdv87f7jh8__YbErRIcLT0w9Y_OxBH8VWfo';

  const authHeaders = (accessToken) => ({
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  });

  async function getSession() {
    const { supabaseAccessToken, supabaseRefreshToken, supabaseUser } = await chrome.storage.local.get([
      'supabaseAccessToken',
      'supabaseRefreshToken',
      'supabaseUser'
    ]);
    return { accessToken: supabaseAccessToken, refreshToken: supabaseRefreshToken, user: supabaseUser };
  }

  async function setSession({ access_token, refresh_token, user }) {
    await chrome.storage.local.set({
      supabaseAccessToken: access_token || null,
      supabaseRefreshToken: refresh_token || null,
      supabaseUser: user || null
    });
  }

  async function signup(email, password) {
    // 简单限流重试（429）
    let attempts = 0;
    let data;
    while (attempts < 3) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 429) {
        attempts += 1;
        await new Promise(r => setTimeout(r, 500 * attempts));
        continue;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error_description || err.message || `Sign up failed (${res.status})`;
        throw new Error(msg);
      }
      data = await res.json();
      break;
    }
    if (!data) {
      throw new Error('请求过于频繁，请稍后重试（429）');
    }
    // Some projects require email confirmation. Tokens may be absent until confirmed.
    await setSession({
      access_token: data.access_token || null,
      refresh_token: data.refresh_token || null,
      user: data.user || null
    });
    return data;
  }

  async function login(email, password) {
    // 简单限流重试（429）；并对 400 提示更清楚
    let attempts = 0;
    let data;
    while (attempts < 3) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 429) {
        attempts += 1;
        await new Promise(r => setTimeout(r, 500 * attempts));
        continue;
      }
      if (!res.ok) {
        let detail = '';
        try {
          const err = await res.json();
          detail = err.error_description || err.message || '';
        } catch {}
        if (res.status === 400) {
          const msg = detail || '登录失败：邮箱或密码错误，或邮箱未验证';
          throw new Error(msg);
        }
        throw new Error(detail || `Login failed (${res.status})`);
      }
      data = await res.json();
      break;
    }
    if (!data) {
      throw new Error('请求过于频繁，请稍后重试（429）');
    }
    await setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user || null
    });
    return data;
  }

  async function logout() {
    const { accessToken } = await getSession();
    if (accessToken) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: authHeaders(accessToken)
      }).catch(() => {});
    }
    await setSession({ access_token: null, refresh_token: null, user: null });
  }

  async function ensureTables() {
    // No-op here. Provide SQL in README for manual migration.
    return true;
  }

  function normalizeArticleForCloud(a) {
    return {
      id: a.id,
      title: a.title || '',
      url: a.url || '',
      source: a.source || '',
      date_added: a.dateAdded || null,
      content: a.content || '',
      html_content: a.htmlContent || '',
      summary: a.summary || '',
      key_points: Array.isArray(a.keyPoints) ? a.keyPoints : [],
      tags: Array.isArray(a.tags) ? a.tags : [],
      highlights: a.highlights || null,
      has_original_content: a.hasOriginalContent === true,
      video_metadata: a.videoMetadata || null
    };
  }

  function normalizeArticleFromCloud(r) {
    return {
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source,
      dateAdded: r.date_added,
      content: r.content,
      htmlContent: r.html_content,
      summary: r.summary,
      keyPoints: r.key_points || [],
      tags: r.tags || [],
      highlights: r.highlights || null,
      hasOriginalContent: r.has_original_content,
      videoMetadata: r.video_metadata || null
    };
  }

  async function uploadArticles() {
    const { accessToken } = await getSession();
    if (!accessToken) throw new Error('未登录，无法上传');

    await ensureTables();

    const local = await chrome.storage.local.get(['articles']);
    const articles = Array.isArray(local.articles) ? local.articles : [];
    if (articles.length === 0) return { inserted: 0 };

    const payload = articles.map(normalizeArticleForCloud);
    // 使用 POST + Prefer: resolution=merge-duplicates 实现 upsert（按主键 id 合并）
    const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
      method: 'POST',
      headers: {
        ...authHeaders(accessToken),
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // 友好提示：常见的表不存在 / schema 未暴露
      if (res.status === 404 && errText.includes('PGRST205')) {
        throw new Error(
          '上传失败：未找到表 public.articles（PGRST205）。请先在 Supabase 执行初始化 SQL 创建表，并确保 API 设置中已暴露 public schema。'
        );
      }
      if (res.status === 400 && /UPDATE requires a WHERE clause/i.test(errText)) {
        throw new Error('上传失败：服务端返回 400（UPDATE 需要 WHERE），已切换为 upsert 方式。请刷新后重试。');
      }
      if (res.status === 403) {
        throw new Error(
          '上传失败（403 RLS）：请确认已登录（非游客）、邮箱已验证，且数据库已开启允许 INSERT/UPDATE/SELECT 的 RLS 策略（示例见使用指南）。'
        );
      }
      throw new Error(`上传失败: ${res.status} ${errText || ''}`);
    }
    return { inserted: payload.length };
  }

  async function downloadArticles({ overwrite = false } = {}) {
    const { accessToken } = await getSession();
    if (!accessToken) throw new Error('未登录，无法下载');

    const url = new URL(`${SUPABASE_URL}/rest/v1/articles`);
    url.searchParams.set('select', '*');
    url.searchParams.set('order', 'date_added.desc');

    const res = await fetch(url.toString(), {
      headers: authHeaders(accessToken)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 404 && errText.includes('PGRST205')) {
        throw new Error(
          '下载失败：未找到表 public.articles（PGRST205）。请先在 Supabase 执行初始化 SQL 创建表，并确保 API 设置中已暴露 public schema。'
        );
      }
      throw new Error(`下载失败: ${res.status} ${errText || ''}`);
    }
    const rows = await res.json();
    const cloudArticles = rows.map(normalizeArticleFromCloud);

    if (overwrite) {
      await chrome.storage.local.set({ articles: cloudArticles });
      return { downloaded: cloudArticles.length, merged: false };
    } else {
      const local = await chrome.storage.local.get(['articles']);
      const existing = new Map((local.articles || []).map(a => [a.id, a]));
      for (const a of cloudArticles) existing.set(a.id, a);
      const merged = Array.from(existing.values());
      await chrome.storage.local.set({ articles: merged });
      return { downloaded: cloudArticles.length, merged: true };
    }
  }

  async function getCurrentUser() {
    const { accessToken } = await getSession();
    if (!accessToken) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: authHeaders(accessToken)
    });
    if (!res.ok) return null;
    return res.json();
  }

  window.SupabaseSync = {
    signup,
    login,
    logout,
    getSession,
    getCurrentUser,
    uploadArticles,
    downloadArticles,
    constants: {
      url: SUPABASE_URL
    }
  };
})();


