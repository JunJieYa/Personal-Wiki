# 成人世界说明书

个人 Wiki：学校不教的社会生存常识。源文件是 Markdown，网页由 GitHub Pages 直接托管，没有构建步骤。

在线地址：https://junjieya.github.io/Personal-Wiki/

## 本地预览

不要直接双击 `index.html`（浏览器会拦本地 `fetch`）。在仓库根目录执行：

```bash
python3 -m http.server 4173
```

然后打开 http://127.0.0.1:4173

## 新增一条

1. 复制模板：

   ```bash
   cp _templates/条目模板.md pages/条目名.md
   ```

2. 填写正文。条目之间用 `[[另一条的标题]]` 互链；还没写的条目会显示成「尚未成文」。

3. 在 `目录.md` 对应分类下加一行：

   ```markdown
   ## 保险
   - [车险报案流程](pages/车险报案流程.md)
   - [交强险与商业险](pages/交强险与商业险.md)
   ```

   没有的分类，自己加一个 `## 住房` 即可。

4. 提交并推送：

   ```bash
   git add pages 目录.md
   git commit -m "新增：条目名"
   git push
   ```

一两分钟后，GitHub Pages 会更新。
