# ATMB 美国住宅地址目录

一个用于快速筛选 `Anytime Mailbox` 美国住宅地址、美国私人地址与真实美国地址的目录站，包含公开前端和后台管理界面。

## 特性

公开站点：
- 按州浏览地址
- 查看地址详情
- 查看月费、RDI、CMRA、首次发现时间与编号范围
- 跳转官网、查看地图与街景

后台管理：
- 地址抓取
- 编号范围扫描
- Smarty 补全 `RDI / CMRA`
- Smarty 密钥管理

## 技术栈

- 后端：Fastify
- 前端：Next.js
- 数据库：SQLite

## 本地启动

安装依赖：

```bash
npm install
cd web
npm install
```

回到项目根目录后，分别启动后端和前端：

```bash
npm run dev:server
npm run dev:web
```

默认访问地址：

- 公开站点：[http://localhost:3001](http://localhost:3001)
- 后台登录：[http://localhost:3001/admin/login](http://localhost:3001/admin/login)

## 默认后台账号

首次启动会自动初始化默认管理员：

- 用户名：`admin`
- 密码：`admin`

生产环境请在首次部署后立即修改。

## 环境变量

参考根目录下的 `.env.example`：

- `SITE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GITHUB_URL`

## 部署

项目已附带：

- `ecosystem.config.cjs`
- `deploy.nginx.conf.example`
- `DEPLOY.md`
- `scripts/deploy.mjs`

如果你要部署到自己的服务器，直接先看 [DEPLOY.md](./DEPLOY.md)。

## 数据文件

SQLite 数据库默认保存在：

- `data/atmb.sqlite`


## License

[MIT](./LICENSE)
