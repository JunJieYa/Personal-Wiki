(() => {
  const CATALOG_FILE = "目录.md";
  const article = document.querySelector("#article");
  const catalogEl = document.querySelector("#catalog");
  const searchEl = document.querySelector("#search");
  const toggleEl = document.querySelector(".nav-toggle");
  const navEl = document.querySelector("#nav");

  const wiki = {
    groups: [],
    pages: [],
    byTitle: new Map(),
    byFile: new Map(),
  };

  marked.use({ gfm: true, breaks: false });

  function parseCatalog(markdown) {
    const groups = [];
    let current = null;
    const intro = [];

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
        current.pages.push({
          title: item[1].trim(),
          file: item[2].trim(),
          group: current.name,
        });
        continue;
      }
      if (!current && line && !line.startsWith("# ")) intro.push(line);
    }

    const pages = groups.flatMap((g) =>
      g.pages.map((p) => ({ ...p, slug: p.title }))
    );
    return { groups, pages, intro: intro.join("\n") };
  }

  function hashFor(page) {
    return `#/${encodeURIComponent(page.slug)}`;
  }

  function currentSlug() {
    return decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  }

  function closeNav() {
    document.body.classList.remove("nav-open");
    toggleEl.setAttribute("aria-expanded", "false");
  }

  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderCatalog(filter = "") {
    const q = filter.trim().toLowerCase();
    const html = wiki.groups
      .map((group) => {
        const pages = group.pages.filter((p) =>
          q ? `${group.name} ${p.title}`.toLowerCase().includes(q) : true
        );
        if (!pages.length) return "";
        const items = pages
          .map((p) => {
            const current = currentSlug() === p.slug;
            return `<li>
              <a href="${hashFor(p)}" ${current ? 'aria-current="page"' : ""}>${escapeHtml(p.title)}</a>
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
    const res = await fetch(new URL(path, document.baseURI));
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.text();
  }

  function renderHtml(markdown) {
    const prepared = rewriteMdLinks(rewriteWiki(markdown));
    return DOMPurify.sanitize(marked.parse(prepared), {
      ADD_ATTR: ["target", "rel", "aria-current", "title"],
    });
  }

  function attachToc() {
    const heads = [...article.querySelectorAll("h2")];
    if (heads.length < 2) return;
    heads.forEach((h, i) => {
      h.id = `s-${i + 1}`;
    });
    const toc = document.createElement("nav");
    toc.className = "page-toc";
    toc.innerHTML = `<p>本页目录</p><ul>${heads
      .map(
        (h) =>
          `<li><a href="#${h.id}" data-scroll="${h.id}">${escapeHtml(h.textContent)}</a></li>`
      )
      .join("")}</ul>`;
    const firstH2 = heads[0];
    article.insertBefore(toc, firstH2);
    toc.addEventListener("click", (e) => {
      const a = e.target.closest("[data-scroll]");
      if (!a) return;
      e.preventDefault();
      document.getElementById(a.dataset.scroll)?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  }

  function pagerHtml(page) {
    const i = wiki.pages.findIndex((p) => p.slug === page.slug);
    if (i < 0 || wiki.pages.length < 2) return "";
    const prev = wiki.pages[i - 1];
    const next = wiki.pages[i + 1];
    return `<nav class="pager">
      ${
        prev
          ? `<a class="pager-prev" href="${hashFor(prev)}"><span>上一篇</span><strong>${escapeHtml(prev.title)}</strong></a>`
          : "<span></span>"
      }
      ${
        next
          ? `<a class="pager-next" href="${hashFor(next)}"><span>下一篇</span><strong>${escapeHtml(next.title)}</strong></a>`
          : ""
      }
    </nav>`;
  }

  function renderHome() {
    document.title = "成人世界说明书";
    article.classList.add("home");
    const items = wiki.pages
      .map(
        (p) => `<li>
          <a href="${hashFor(p)}"><span class="g">${escapeHtml(p.group)}</span>${escapeHtml(p.title)}</a>
        </li>`
      )
      .join("");
    article.innerHTML = `
      <p class="kicker">说明书</p>
      <h1>成人世界说明书</h1>
      <div class="lede">${renderHtml(wiki.intro || "学校不教的社会生存常识。")}</div>
      <h2>在编条目</h2>
      <ul class="entry-list">${items}</ul>
    `;
    renderCatalog(searchEl.value);
    article.focus({ preventScroll: true });
  }

  async function renderPage(page) {
    document.title = `${page.title} - 成人世界说明书`;
    article.classList.remove("home");
    const markdown = await loadText(page.file);
    article.innerHTML = `
      <p class="kicker">${escapeHtml(page.group)}</p>
      ${renderHtml(markdown)}
      ${pagerHtml(page)}
    `;
    attachToc();
    renderCatalog(searchEl.value);
    article.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  async function route() {
    closeNav();
    const slug = currentSlug();
    if (!slug) {
      renderHome();
      return;
    }
    const page = wiki.pages.find((p) => p.slug === slug || p.title === slug);
    if (!page) {
      document.title = "未找到 - 成人世界说明书";
      article.classList.remove("home");
      article.innerHTML = `<p class="kicker">未找到</p><h1>没有这一页</h1><p class="error">目录里没有「${escapeHtml(slug)}」。写好 Markdown 后，把链接加进 <code>目录.md</code>。</p>`;
      renderCatalog(searchEl.value);
      return;
    }
    try {
      await renderPage(page);
    } catch (err) {
      article.innerHTML = `<p class="kicker">读取失败</p><h1>${escapeHtml(page.title)}</h1><p class="error">${escapeHtml(String(err.message))}</p>`;
    }
  }

  toggleEl.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggleEl.setAttribute("aria-expanded", String(open));
  });
  catalogEl.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeNav();
  });
  searchEl.addEventListener("input", () => renderCatalog(searchEl.value));
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
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
      article.innerHTML = `<p class="kicker">读不到目录</p><h1>无法打开说明书</h1><p class="error">请用本地服务器打开，不要直接双击 index.html。<br>${escapeHtml(String(err.message))}</p>`;
    }
  })();
})();
