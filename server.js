const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lanxi123';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// ========== Supabase数据操作 ==========

async function getWallpapers() {
    if (!supabase) { console.error('Supabase not connected'); return []; }
    try {
        const { data, error } = await supabase
            .from('wallpapers')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('getWallpapers error:', e.message);
        return [];
    }
}

async function addWallpaper(wallpaper) {
    if (!supabase) { console.error('Supabase not connected'); return null; }
    try {
        // 使用description避免desc SQL关键字冲突
        const insertData = {
            url: wallpaper.url,
            text: wallpaper.text,
            description: wallpaper.desc || '高清精美壁纸',
            downloads: 0
        };
        const { data, error } = await supabase
            .from('wallpapers')
            .insert([insertData])
            .select()
            .single();
        if (error) throw error;
        // 兼容返回格式
        return data ? { ...data, desc: data.description } : null;
    } catch (e) {
        console.error('addWallpaper error:', e.message);
        return null;
    }
}

async function updateWallpaper(id, updates) {
    if (!supabase) return null;
    try {
        const updateData = {};
        if (updates.url !== undefined) updateData.url = updates.url;
        if (updates.text !== undefined) updateData.text = updates.text;
        if (updates.desc !== undefined) updateData.description = updates.desc;
        if (updates.downloads !== undefined) updateData.downloads = updates.downloads;

        const { data, error } = await supabase
            .from('wallpapers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data ? { ...data, desc: data.description } : null;
    } catch (e) {
        console.error('updateWallpaper error:', e.message);
        return null;
    }
}

async function deleteWallpaper(id) {
    if (!supabase) return false;
    try {
        const { error } = await supabase.from('wallpapers').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('deleteWallpaper error:', e.message);
        return false;
    }
}

async function getStats() {
    if (!supabase) return { views: 0, downloads: 0 };
    try {
        const { data, error } = await supabase.from('stats').select('*').eq('id', 1).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) {
            await supabase.from('stats').insert([{ id: 1, views: 0, downloads: 0 }]);
            return { views: 0, downloads: 0 };
        }
        return data;
    } catch (e) {
        console.error('getStats error:', e.message);
        return { views: 0, downloads: 0 };
    }
}

async function updateStats(stats) {
    if (!supabase) return;
    try {
        await supabase.from('stats').upsert([{ id: 1, views: stats.views || 0, downloads: stats.downloads || 0 }]);
    } catch (e) {
        console.error('updateStats error:', e.message);
    }
}

// ========== API路由 ==========

app.get('/api/wallpapers', async (req, res) => {
    const wallpapers = await getWallpapers();
    // 兼容desc字段
    const normalized = wallpapers.map(w => ({ ...w, desc: w.description || w.desc }));
    res.json(normalized);
});

app.post('/api/wallpapers', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not connected' });
    const wallpaper = await addWallpaper(req.body);
    if (wallpaper) {
        res.json(wallpaper);
    } else {
        res.status(500).json({ error: 'Failed to add wallpaper. Check database connection and RLS policies.' });
    }
});

app.put('/api/wallpapers/:id', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not connected' });
    const wallpaper = await updateWallpaper(req.params.id, req.body);
    if (wallpaper) {
        res.json(wallpaper);
    } else {
        res.status(500).json({ error: 'Failed to update wallpaper' });
    }
});

app.delete('/api/wallpapers/:id', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not connected' });
    const success = await deleteWallpaper(req.params.id);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to delete wallpaper' });
    }
});

app.get('/api/stats', async (req, res) => {
    const stats = await getStats();
    res.json(stats);
});

app.post('/api/stats', async (req, res) => {
    await updateStats(req.body);
    res.json({ success: true });
});

// ========== 页面路由 ==========

app.get('/admin', (req, res) => {
    const { password } = req.query;
    if (password === ADMIN_PASSWORD) {
        return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    }
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理后台登录</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(135deg,#0c1220 0%,#1a2744 50%,#0f1a2e 100%);color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.login-box{background:rgba(15,26,46,.8);padding:50px;border-radius:20px;border:1px solid rgba(58,123,213,.3);text-align:center;min-width:300px}
h2{font-size:24px;margin-bottom:30px;background:linear-gradient(135deg,#5c9cf5,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
input{width:100%;padding:15px;border-radius:10px;border:1px solid rgba(58,123,213,.3);background:rgba(12,18,32,.8);color:#fff;font-size:16px;margin-bottom:20px}
button{width:100%;padding:15px;background:linear-gradient(135deg,#3a7bd5,#5c9cf5);color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:16px;transition:all .3s ease}
button:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(58,123,213,.4)}
</style></head>
<body><div class="login-box"><h2>🔒 管理后台登录</h2><input type="password" id="pwd" placeholder="输入密码"><button onclick="login()">进入后台</button></div>
<script>function login(){var pwd=document.getElementById('pwd').value;window.location.href='/admin?password='+encodeURIComponent(pwd)}document.getElementById('pwd').addEventListener('keypress',function(e){if(e.key==='Enter')login()})</script>
</body></html>`);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

module.exports = app;