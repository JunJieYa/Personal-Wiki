(() => {
  const CATALOG_FILE = "目录.md";
  const sheet = document.querySelector("#sheet");
  const catalogEl = document.querySelector("#catalog");
  const searchEl = document.querySelector("#search");
  const toggleEl = document.querySelector(".catalog-toggle");
  const backdrop = document.querySelector("#catalog-backdrop");

  const wiki = {
    groups: [],
    pages: [],
    byTitle: new Map(),
    byFile: new Map(),
  };

  marked.use({ gfm: true, breaks: false });

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function parseCatalog(markdown) {
    const groups = [];
    let current = null;
    let intro = [];

    for (const raw of markdown.split(/\r?\n/)) {
      const line = raw.trim();
      const group = line.match(/^##\s+(.+)$/);
      const item = line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)/);

      if (group) {
        current = { name: group[1].trim(), pages: [] };
        groups.push(current);
        continue;
      }
      if (item && current) {
        const title = item[1].trim();
        const file = item[2].trim();
        const page = { title, file, group: current.name };
        current.pages.push(page);
        continue;
      }
      if (!current && line && !line.startsWith("# ")) {
        intro.push(line);
      }
    }

    const pages = groups.flatMap((g, gi) =>
      g.pages.map((p, pi) => ({
        ...p,
        index: `${pad(gi + 1)}.${pad(pi + 1)}`,
        slug: p.title,
      }))
    );

    return { groups, pages, intro: intro.join("\n") };
  }

  function hashFor(page) {
    return `#/${encodeURIComponent(page.slug)}`;
  }

  function currentSlug() {
    return decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  }

  function closeCatalog() {
    document.body.classList.remove("catalog-open");
    toggleEl.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
  }

  function openCatalog() {
    document.body.classList.add("catalog-open");
    toggleEl.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
  }

  function renderCatalog(filter = "") {
    const q = filter.trim().toLowerCase();
    const html = wiki.groups
      .map((group) => {
        const pages = group.pages.filter((p) => {
          if (!q) return true;
          return `${group.name} ${p.title}`.toLowerCase().includes(q);
        });
        if (!pages.length) return "";
        const items = pages
          .map((p) => {
            const current = currentSlug() === p.slug;
            return `<li>
              <a href="${hashFor(p)}" ${current ? 'aria-current="page"' : ""}>
                <span class="n">${p.index}</span>
                <span>${escapeHtml(p.title)}</span>
              </a>
            </li>`;
          })
          .join("");
        return `<section class="catalog-group">
          <h2 class="catalog-group-title">${escapeHtml(group.name)}</h2>
          <ul class="catalog-list">${items}</ul>
        </section>`;
      })
      .join("");

    catalogEl.innerHTML =
      html || `<p class="catalog-empty">目录里没有匹配的条目。</p>`;
  }

  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function rewriteWiki(markdown) {
    return markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const title = target.trim();
      const text = (label || title).trim();
      const page = wiki.byTitle.get(title);
      if (!page) {
        return `<a class="wiki-missing" title="尚未成文，写好后加进目录即可" href="#/">${escapeHtml(text)}</a>`;
      }
      return `[${text}](${hashFor(page)})`;
    });
  }

  function rewriteMdLinks(markdown) {
    return markdown.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (_, text, file) => {
      const page = wiki.byFile.get(file) || wiki.byFile.get(file.replace(/^\.\//, ""));
      if (!page) return `[${text}](${file})`;
      return `[${text}](${hashFor(page)})`;
    });
  }

  async function loadText(path) {
    const url = new URL(path, document.baseURI);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.text();
  }

  function renderHtml(markdown) {
    const prepared = rewriteMdLinks(rewriteWiki(markdown));
    return DOMPurify.sanitize(marked.parse(prepared), {
      ADD_ATTR: ["target", "rel", "aria-current", "title"],
      ADD_TAGS: ["span"],
    });
  }

  function renderHome() {
    document.title = "成人世界说明书";
    const start = wiki.pages[0];
    const items = wiki.pages
      .map(
        (p) => `<li>
          <a href="${hashFor(p)}"><span class="n">${p.index}</span>${escapeHtml(p.title)}</a>
        </li>`
      )
      .join("");

    const introHtml = renderHtml(wiki.intro || "学校不教的社会生存常识。");
    sheet.innerHTML = `
      <p class="kicker">封面</p>
      <h1>成人世界说明书</h1>
      <div class="home-lead">${introHtml}</div>
      <h2>在编条目</h2>
      <ul class="home-list">${items}</ul>
      ${
        start
          ? `<p>从这里开始写：<a href="${hashFor(start)}">${escapeHtml(start.title)}</a>。</p>`
          : `<p>目录还是空的。复制 <code>_templates/条目模板.md</code> 到 <code>pages/</code>，再把链接写进 <code>目录.md</code>。</p>`
      }
    `;
    renderCatalog(searchEl.value);
    sheet.focus({ preventScroll: true });
  }

  async function renderPage(page) {
    document.title = `${page.title} - 成人世界说明书`;
    const markdown = await loadText(page.file);
    sheet.innerHTML = `
      <p class="kicker">${escapeHtml(page.group)} ${page.index}</p>
      ${renderHtml(markdown)}
    `;
    renderCatalog(searchEl.value);
    sheet.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  async function route() {
    const slug = currentSlug();
    if (!slug) {
      renderHome();
      return;
    }
    const page = wiki.pages.find((p) => p.slug === slug || p.title === slug);
    if (!page) {
      document.title = "未找到 - 成人世界说明书";
      sheet.innerHTML = `<p class="kicker">未找到</p><h1>这一页还没装订进去</h1><p class="error">目录里没有「${escapeHtml(slug)}」。先写 Markdown，再把它加进 <code>目录.md</code>。</p>`;
      renderCatalog(searchEl.value);
      return;
    }
    try {
      await renderPage(page);
    } catch (err) {
      sheet.innerHTML = `<p class="kicker">读取失败</p><h1>${escapeHtml(page.title)}</h1><p class="error">${escapeHtml(String(err.message))}</p>`;
    }
  }

  toggleEl.addEventListener("click", () => {
    if (document.body.classList.contains("catalog-open")) closeCatalog();
    else openCatalog();
  });
  backdrop.addEventListener("click", closeCatalog);
  catalogEl.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeCatalog();
  });
  searchEl.addEventListener("input", () => renderCatalog(searchEl.value));
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCatalog();
  });

  (async function boot() {
    try {
      const nav = parseCatalog(await loadText(CATALOG_FILE));
      wiki.groups = nav.groups;
      wiki.pages = nav.pages;
      wiki.intro = nav.intro;
      wiki.groups.forEach((g) => {
        g.pages = wiki.pages.filter((p) => p.group === g.name);
      });
      wiki.pages.forEach((p) => {
        wiki.byTitle.set(p.title, p);
        wiki.byFile.set(p.file, p);
      });
      await route();
    } catch (err) {
      sheet.innerHTML = `<p class="kicker">装订中断</p><h1>读不到目录</h1><p class="error">请用本地服务器打开本页，不要直接双击 index.html。<br>${escapeHtml(String(err.message))}</p>`;
    }
  })();
})();
