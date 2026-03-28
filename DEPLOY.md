# 部署说明

本文档适用于将项目部署到你自己的服务器，并通过 `Nginx + PM2` 对外提供服务。

## 1. 服务器准备

建议环境：

- Ubuntu 22.04 / Debian 12 / CentOS 兼容环境
- Node.js 22+
- npm
- Nginx
- PM2

安装 PM2：

```bash
npm install -g pm2
```

## 2. 拉取代码

```bash
git clone https://github.com/yourname/atmb-us-address-directory.git
cd atmb-us-address-directory
```

## 3. 配置环境变量

在项目根目录创建 `.env`：

```env
SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_GITHUB_URL=https://github.com/yourname/atmb-us-address-directory
HOST=127.0.0.1
PORT=3000
DB_PATH=/var/www/atmb/data/atmb.sqlite
```

## 4. 一键部署脚本

项目已附带跨平台部署脚本：

- `scripts/deploy.mjs`

常用命令：

```bash
npm run deploy
```

作用：

- 安装根目录依赖
- 安装 `web/` 依赖
- 构建前端

如果你还希望脚本直接用 PM2 启动或重载服务：

```bash
npm run deploy:pm2
```

## 5. PM2

项目已附带：

- `ecosystem.config.cjs`

如果你不使用一键脚本，也可以手动执行：

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs atmb-server
pm2 logs atmb-web
```

## 6. Nginx

项目已附带示例配置：

- `deploy.nginx.conf.example`

你可以复制到：

```bash
/etc/nginx/sites-available/atmb
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/atmb /etc/nginx/sites-enabled/atmb
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 安全提醒

- 默认后台账号密码是 `admin / admin`
- 部署完成后请立即修改
