import { publicRoutes, SITE_URL } from '../_lib/site-routes';

export const dynamic = 'force-static';

function buildLlmsTxt() {
  const pages = publicRoutes
    .map((route) => `- [${route.title}](${SITE_URL}${route.path}): ${route.summary}`)
    .join('\n');

  return `# Anytime Mailbox 美国住宅地址筛选

> 本站批量筛查 Anytime Mailbox(ATMB) 的美国地址，用 RDI、CMRA、USPS CMRA、C1 预审（Capital One 地址预审核）、街景与价格辅助判断哪些接近真实私人住宅地址，适合申请美国信用卡、银行开户与公司注册。数据每日更新。

站点语言为简体中文，内容为公开信息，无需登录即可访问。地址的 RDI / CMRA 字段来源于 Smarty 地址验证结果，仅供初筛参考，最终仍需结合街景与实际用途判断。

## 主要页面

${pages}

## 地址检索（GET 查询参数）

地址列表可以直接通过 URL 查询参数检索，无需提交表单。无法识别的参数值会被忽略，等同于不筛选。

\`/addresses\` 支持以下参数，可自由组合：

- \`q\`：关键词，匹配城市、州、ZIP、街道或地址文本
- \`state\`：两位州代码（大写），例如 \`CA\`、\`TX\`
- \`rdi\`：\`Residential\` | \`Commercial\` | \`none\`（无数据）
- \`cmra\`：\`Yes\` | \`No\` | \`none\`（无数据）
- \`usps\`：USPS CMRA 标记，\`Y\` | \`N\`
- \`c1\`：C1 预审结果，\`pass\` | \`fail\`
- \`price\`：\`lt10\`（< US$10）| \`lt20\`（< US$20）| \`gte20\`（>= US$20）
- \`page\`：页码，从 1 开始

\`/residential-addresses\` 已固定 RDI = Residential，支持 \`q\`、\`state\`、\`cmra\`、\`usps\`、\`c1\`、\`page\`，不支持 \`rdi\` 与 \`price\`。

示例：${SITE_URL}/addresses?state=CA&rdi=Residential&cmra=No&price=lt20

## 不开放抓取

- \`/admin/\`：后台管理
- \`/api/\`：内部接口
- \`/go/\`：外链跳转
`;
}

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
