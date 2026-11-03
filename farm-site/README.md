# 欢乐农场官网（farm-site）

网站内容全部来自 Notion 数据库「欢乐农场官网后台」，用 Notion 官方接口读取。在 Notion 里改完，大约 1 分钟后网站自动更新。

## 部署到 Vercel

1. Vercel → Add New → Project → 导入 GitHub 仓库 `notionnext`。
2. **Root Directory 选 `farm-site`**（Framework 会自动识别为 Next.js）。
3. Environment Variables 填两项：
   - `NOTION_TOKEN`：Notion integration 的 Secret
   - `NOTION_DATABASE_ID`：`dc81e1ccfa9340b68d794e67ebe2e75e`
4. Deploy。之后可以在 Settings → Domains 绑定自己的域名。

本地运行：复制 `.env.example` 为 `.env.local` 填好，然后 `npm install && npm run dev`。

## 在 Notion 里怎么改

每一行 = 网站上的一个板块。

| 字段 | 作用 |
| --- | --- |
| title | 板块标题 |
| summary | 标题右边的英文小字 / 副标题 |
| order | 顺序，数字小的在前（建议按 10、20、30 排，方便中间插入） |
| status | Published 显示；Invisible 或 Draft 隐藏 |
| tags | 板块样式，只选一个（见下表） |
| icon | 填了就出现在顶部导航，并作为带编号的大板块；不填就是上一个大板块里的小节 |
| slug | 锚点，英文，例如 about |

板块样式（tags）：

| 样式 | 页面里怎么写 |
| --- | --- |
| 大标题 | 首屏。段落 = 标语下的小字；放一张图片 = 背景图 |
| 数字卡 / 大数字 / 亮点 / 步骤 / 信息列表 | 每个**提示框（callout）**是一张卡：第一行是标题或数字，后面的行是说明；提示框的图标就是卡片图标，颜色决定卡片色调 |
| 饼图 | 放一个表格：第一列名称，第二列百分比 |
| 文件下载 | 每个提示框一张卡：里面放一张图片做缩略图，放一个文件/PDF 做下载 |
| 链接 | 每个提示框一行：第一行名称，文字加上链接就能点；没有链接显示「即将公布」 |
| 自由图文 | 按 Notion 原样显示段落、标题、列表、图片、表格 |

提示框外面的普通段落会显示为板块导语。

**站点设置**（type = Config 的那一行）：页面里的图片就是 Logo；配置表里可以改

`TITLE`、`DESCRIPTION`、`FARM_COLOR_PRIMARY`（主色）、`FARM_COLOR_ACCENT`（强调色）、`FARM_COLOR_NUMBER`（数字色）、`FARM_COLOR_BG`（背景色）、`FARM_COLOR_INK`（标题色）、`FARM_FOOTER_TEXT`（页脚）、`FARM_SHOW_NAV`（true/false 顶部导航）、`FARM_HERO_BG`（首屏背景图地址）。取消「启用」就恢复默认值。
