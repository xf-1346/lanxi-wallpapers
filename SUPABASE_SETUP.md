# Supabase配置指南

## 1. 创建Supabase项目

1. 访问 https://supabase.com
2. 注册/登录账号
3. 创建新项目（免费套餐足够）
4. 记录项目URL和API Key

## 2. 创建数据表

在Supabase SQL编辑器中执行以下SQL：

```sql
-- 壁纸表
CREATE TABLE wallpapers (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    desc TEXT DEFAULT '高清精美壁纸',
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 统计表
CREATE TABLE stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    views INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0
);

-- 插入初始统计数据
INSERT INTO stats (id, views, downloads) VALUES (1, 0, 0);

-- 启用RLS（行级安全）但允许匿名访问
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read" ON wallpapers FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert" ON wallpapers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update" ON wallpapers FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete" ON wallpapers FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read stats" ON stats FOR SELECT USING (true);
CREATE POLICY "Allow anonymous update stats" ON stats FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous insert stats" ON stats FOR INSERT WITH CHECK (true);
```

## 3. Vercel环境变量配置

在Vercel项目设置中添加以下环境变量：

| 变量名 | 值 | 说明 |
|:---|:---|:---|
| `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase项目URL |
| `SUPABASE_KEY` | `eyJ...` | Supabase anon/public key |
| `ADMIN_PASSWORD` | `lanxi123` | 后台管理密码 |

## 4. 部署到Vercel

1. 将代码推送到GitHub
2. 在Vercel导入项目
3. 配置环境变量
4. 部署

## 链接结构

| 页面 | 链接 | 说明 |
|:---|:---|:---|
| 浏览页面 | `https://你的域名/` | 公开访问，给用户看的 |
| 后台管理 | `https://你的域名/admin` | 需要密码 |
