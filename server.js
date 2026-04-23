const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Supabase配置（从环境变量读取）
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lanxi123';

// 初始化Supabase客户端
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Express
const express = require('express');
const app = express();
app.use(express.json());

// 内存缓存（Vercel无状态，用内存临时缓存）
let cache = {
    wallpapers: null,
    stats: null,
    lastUpdate: 0
};

// ========== Supabase数据操作 ==========

async function getWallpapers() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('wallpapers')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Supabase error:', e);
        return cache.wallpapers || [];
    }
}

async function addWallpaper(wallpaper) {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('wallpapers')
            .insert([{
                url: wallpaper.url,
                text: wallpaper.text,
                desc: wallpaper.desc || '高清精美壁纸',
                downloads: 0
            }])
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Supabase error:', e);
        return null;
    }
}

async function updateWallpaper(id, updates) {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('wallpapers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Supabase error:', e);
        return null;
    }
}

async function deleteWallpaper(id) {
    if (!supabase) return false;
    try {
        const { error } = await supabase
            .from('wallpapers')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Supabase error:', e);
        return false;
    }
}

async function getStats() {
    if (!supabase) return { views: 0, downloads: 0 };
    try {
        const { data, error } = await supabase
            .from('stats')
            .select('*')
            .eq('id', 1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) {
            // 初始化统计数据
            await supabase.from('stats').insert([{ id: 1, views: 0, downloads: 0 }]);
            return { views: 0, downloads: 0 };
        }
        return data;
    } catch (e) {
        console.error('Supabase error:', e);
        return cache.stats || { views: 0, downloads: 0 };
    }
}

async function updateStats(stats) {
    if (!supabase) return;
    try {
        await supabase
            .from('stats')
            .upsert([{ id: 1, ...stats }]);
    } catch (e) {
        console.error('Supabase error:', e);
    }
}

// ========== API路由 ==========

// 获取壁纸列表
app.get('/api/wallpapers', async (req, res) => {
    const wallpapers = await getWallpapers();
    res.json(wallpapers);
});

// 添加壁纸
app.post('/api/wallpapers', async (req, res) => {
    const wallpaper = await addWallpaper(req.body);
    if (wallpaper) {
        res.json(wallpaper);
    } else {
        res.status(500).json({ error: 'Failed to add wallpaper' });
    }
});

// 更新壁纸
app.put('/api/wallpapers/:id', async (req, res) => {
    const wallpaper = await updateWallpaper(req.params.id, req.body);
    if (wallpaper) {
        res.json(wallpaper);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// 删除壁纸
app.delete('/api/wallpapers/:id', async (req, res) => {
    const success = await deleteWallpaper(req.params.id);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// 获取统计
app.get('/api/stats', async (req, res) => {
    const stats = await getStats();
    res.json(stats);
});

// 更新统计
app.post('/api/stats', async (req, res) => {
    await updateStats(req.body);
    res.json({ success: true });
});

// ========== 页面路由 ==========

// 1. 后台管理 /admin - 需要密码
app.get('/admin', (req, res) => {
    const { password } = req.query;
    
    if (password === ADMIN_PASSWORD) {
        return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    }
    
    // 密码页
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台登录</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: linear-gradient(135deg, #0c1220 0%, #1a2744 50%, #0f1a2e 100%);
            color: #fff; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .login-box {
            background: rgba(15, 26, 46, 0.8);
            padding: 50px;
            border-radius: 20px;
            border: 1px solid rgba(58, 123, 213, 0.3);
            text-align: center;
            min-width: 300px;
        }
        h2 {
            font-size: 24px;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #5c9cf5, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        input {
            width: 100%;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(58, 123, 213, 0.3);
            background: rgba(12, 18, 32, 0.8);
            color: #fff;
            font-size: 16px;
            margin-bottom: 20px;
        }
        button {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #3a7bd5, #5c9cf5);
            color: #fff;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(58, 123, 213, 0.4);
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h2>🔒 管理后台登录</h2>
        <input type="password" id="pwd" placeholder="输入密码">
        <button onclick="login()">进入后台</button>
    </div>
    <script>
        function login() {
            const pwd = document.getElementById('pwd').value;
            window.location.href = '/admin?password=' + encodeURIComponent(pwd);
        }
        document.getElementById('pwd').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    </script>
</body>
</html>
    `);
});

// 2. 浏览页面 / - 公开
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 兜底
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// Vercel导出
module.exports = app;
