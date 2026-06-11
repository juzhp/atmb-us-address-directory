# Anytime Mailbox 美国住宅地址筛选指南

一个美国地址筛选项目，用于整理 Anytime Mailbox 地址数据，并结合 RDI、CMRA、价格、ZIP、邮箱编号范围和 Google Maps 街景跳转，辅助判断地址是否值得继续查看和租用。

> 本项目不是 Anytime Mailbox 官方项目，也不保证任何地址一定可用。RDI、CMRA、街景、价格和邮箱编号都只是辅助判断信息，最终仍需用户自行确认。

## 主要功能

- 公开首页、所有地址页、住宅地址页，优先考虑 SEO 和性能。
- 支持关键词、州、RDI、CMRA、价格筛选地址。
- 地址卡展示价格、ZIP、RDI、CMRA、邮箱编号范围。
- 查看详情跳转 Anytime Mailbox 地址页。
- 查看照片跳转 Google Maps，由用户自行判断街景。
- 后台支持地址管理、任务管理、系统设置和登录认证。
- 抓取 Anytime Mailbox 地址、邮箱编号范围，并增量同步 Smarty RDI / CMRA。
- 已成功获取过 RDI / CMRA 的地址不会重复请求 Smarty。
- 支持 PM2 部署，SQLite 存储。

## 技术栈

- Web：Next.js App Router、React、TypeScript
- Server：Fastify、TypeScript
- Database：SQLite、Drizzle
- Crawler：Axios、Cheerio、PQueue
- Admin/Auth：Fastify Cookie、Session
- Deploy：PM2、Nginx

## 配置文件

复制示例配置：

```bash
cp .env.example .env
```

然后修改 `.env`：

```env
WEB_ORIGIN=https://你的域名
NEXT_PUBLIC_API_BASE_URL=https://你的域名
DATABASE_URL=/var/www/atmbNew/data/atmb.sqlite
ADMIN_PASSWORD=你的后台密码
SESSION_SECRET=至少32位随机字符串
```

常用配置说明：

| 配置 | 说明 |
| --- | --- |
| `DATABASE_URL` | SQLite 数据库路径，web 和 server 必须指向同一个文件 |
| `SESSION_SECRET` | 后台 Session 和敏感配置加密使用，生产环境必须设置 |
| `ADMIN_USERNAME` | 默认管理员账号 |
| `ADMIN_PASSWORD` | 默认管理员密码，生产环境必须设置 |
| `WEB_ORIGIN` | 浏览器访问的站点域名 |
| `NEXT_PUBLIC_API_BASE_URL` | 前端公开 API 域名，构建前必须设置 |
| `API_BASE_URL` | Next.js 服务端访问 Fastify 的内部地址 |
| `ADDRESS_IMAGE_UPLOAD_DIR` | 街景图上传保存目录 |
| `ADDRESS_IMAGE_PUBLIC_BASE` | 街景图公开访问路径 |

Smarty 的 `Auth ID` 和 `Auth Token` 不写在 `.env`，请在后台「系统设置」页面保存。

## 本地开发

安装依赖：

```bash
npm install
```

准备数据库：

```bash
npm run db:migrate
```

启动后端：

```bash
npm run dev:server
```

启动前端：

```bash
npm run dev:web
```

默认地址：

- 前台：http://localhost:3000
- 后台：http://localhost:3000/admin
- API：http://localhost:3001

开发环境默认管理员账号可使用：

```text
admin / admin123456
```

生产环境必须在 `.env` 设置 `ADMIN_PASSWORD`。

## 生产部署

示例路径：

```bash
cd /var/www
git clone https://github.com/juzhp/atmb-us-address-directory.git atmbNew
cd /var/www/atmbNew
```

安装、配置、构建：

```bash
npm ci
cp .env.example .env
nano .env

mkdir -p data
mkdir -p apps/web/public/uploads/address-images

npm run build
npm run db:migrate
```

启动 PM2：

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

更新代码：

```bash
git pull
npm ci
npm run build
npm run db:migrate
pm2 restart ecosystem.config.cjs --update-env
```

## Nginx

参考 `nginx.example.conf`：

```bash
sudo cp nginx.example.conf /etc/nginx/sites-available/atmb
sudo ln -s /etc/nginx/sites-available/atmb /etc/nginx/sites-enabled/atmb
sudo nginx -t
sudo systemctl reload nginx
```

启用 HTTPS 后，请把 `.env` 中的 `WEB_ORIGIN` 和 `NEXT_PUBLIC_API_BASE_URL` 改为 `https://你的域名`，然后重新执行：

```bash
npm run build
pm2 restart ecosystem.config.cjs --update-env
```

## 常用命令

```bash
npm run typecheck
npm run test
npm run build
npm run db:migrate
pm2 logs atmb-server
pm2 logs atmb-web
```

## 开源地址

https://github.com/juzhp/atmb-us-address-directory
