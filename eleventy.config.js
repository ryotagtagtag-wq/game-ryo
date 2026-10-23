require("dotenv").config();
const Image = require("@11ty/eleventy-img");
const fs = require("fs");
const htmlmin = require("html-minifier-terser");
const sanitizeHtml = require("sanitize-html");

const CONCURRENCY_LIMIT = 5;

module.exports = function (eleventyConfig) {
  // Expose Image and generateHTML to templates
  eleventyConfig.addNunjucksGlobal("Image", Image);
  eleventyConfig.addNunjucksGlobal("generateHTML", Image.generateHTML);
  if (!fs.existsSync("./_site/img/")) {
    fs.mkdirSync("./_site/img/", { recursive: true });
  }

  // ==========================================
  // 🔧 Nunjucks フィルタ追加（reverse, slice, first 等）
  // ==========================================
  eleventyConfig.addFilter("reverse", function (arr) {
    return [...arr].reverse();
  });
  eleventyConfig.addFilter("slice", function (arr, start, end) {
    return arr.slice(start, end);
  });
  eleventyConfig.addFilter("first", function (arr, n) {
    return arr.slice(0, n);
  });
  // ISO 8601 日付フィルタ（sitemap 用）
  eleventyConfig.addFilter("dateIso", function (date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  });
  // RFC 822 日付フィルタ（RSS 用）
  eleventyConfig.addFilter("dateRfc822", function (date) {
    if (!date) return "";
    return new Date(date).toUTCString();
  });

  // ビルド日時をグローバルデータとして追加
  eleventyConfig.addGlobalData("buildDate", new Date().toUTCString());

  // Turnstile site key (from env)
  eleventyConfig.addGlobalData(
    "turnstileSiteKey",
    process.env.TURNSTILE_SITE_KEY || "",
  );

  // ==========================================
  // 🐙 GitHubリポジトリ取得（最大150件、ビルド時実行）
  // ==========================================
  eleventyConfig.addGlobalData("githubProjects", async () => {
    const token = process.env.GITHUB_TOKEN;
    const username = "ryotagtagtag-wq";
    const maxRepos = 150;
    const perPage = 100;

    if (!token) {
      console.log("⚠️ GITHUB_TOKEN未設定、GitHubプロジェクト取得スキップ");
      return [];
    }

    try {
      let allRepos = [];
      let page = 1;

      while (allRepos.length < maxRepos) {
        const response = await fetch(
          `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`,
          );
        }

        const repos = await response.json();
        if (!repos.length) break;

        // フィルタ: フォーク除外、プライベート除外、空リポ除外
        const filtered = repos
          .filter((r) => !r.fork && !r.private && r.size > 0)
          .map((r) => ({
            name: r.name,
            fullName: r.full_name,
            description: r.description || "説明なし",
            url: r.html_url,
            homepage: r.homepage,
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            updatedAt: r.updated_at,
            createdAt: r.created_at,
            topics: r.topics || [],
            license: r.license?.spdx_id,
            defaultBranch: r.default_branch,
            isTemplate: r.is_template,
            archived: r.archived,
            disabled: r.disabled,
          }));

        allRepos.push(...filtered);

        if (repos.length < perPage) break;
        page++;
      }

      // 最大150件に制限、更新日時降順でソート
      const limited = allRepos
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, maxRepos);

      console.log(`✅ GitHubリポジトリ ${limited.length}件取得完了`);
      return limited;
    } catch (error) {
      console.error("❌ GitHubリポジトリ取得失敗:", error.message);
      return [];
    }
  });

  // ==========================================
  // 🛡️ [XSS対策] HTMLサニタイズフィルター
  // ==========================================
  eleventyConfig.addFilter("sanitizeHtml", function (htmlContent) {
    if (!htmlContent) return "";
    return sanitizeHtml(htmlContent, {
      allowedTags: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "code",
        "pre",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "dl",
        "dt",
        "dd",
        "blockquote",
        "hr",
        "a",
        "img",
        "figure",
        "figcaption",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "div",
        "span",
        "figure",
        "figcaption",
        "section",
        "article",
        "header",
        "footer",
        "nav",
        "aside",
        "main",
      ],
      allowedAttributes: {
        a: ["href", "title", "target", "rel"],
        img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
        code: ["class"],
        pre: ["class"],
        div: ["class"],
        span: ["class"],
        blockquote: ["cite"],
        th: ["scope"],
        td: ["colspan", "rowspan"],
        "*": ["class", "id", "style"],
      },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowedSchemesByTag: {},
      allowedSchemesAppliedToAttributes: ["href", "src"],
      selfClosing: ["img", "br", "hr"],
      enforceHtmlBoundary: true,
      parserOptions: { lowerCaseTags: true },
    });
  });
  eleventyConfig.addFilter("stripHtml", function (htmlContent) {
    if (!htmlContent) return "";
    return sanitizeHtml(htmlContent, {
      allowedTags: [],
      allowedAttributes: {},
    });
  });

  // ==========================================
  // 🗜️ [完全圧縮処理] HTML/CSS/JS圧縮
  // ==========================================
  eleventyConfig.addTransform("htmlmin", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      try {
        return htmlmin.minify(content, {
          useShortDoctype: true,
          removeComments: true,
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
        });
      } catch (error) {
        console.error("❌ HTML圧縮エラー:", error);
        return content;
      }
    }
    return content;
  });

  // ==========================================
  // 💡 画像処理関数（キャッシュ活用・レスポンシブ対応）
  // ==========================================
  async function processImage(srcUrl) {
    if (!srcUrl) return null;
    return await Image(srcUrl, {
      widths: [400, 800, 1200, "auto"],
      formats: ["webp", "avif"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
      cacheOptions: {
        duration: "30d",
        directory: ".cache",
        removeUrlQueryParams: false,
      },
    });
  }

  // 並列実行ヘルパー
  async function pMap(arr, fn, concurrency = CONCURRENCY_LIMIT) {
    const results = [];
    for (let i = 0; i < arr.length; i += concurrency) {
      const chunk = arr.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(fn));
      results.push(...chunkResults);
    }
    return results;
  }

  // ==========================================
  // 💡 本文画像の一括置換（並列化・レスポンシブ対応）
  // ==========================================
  async function downloadAndReplaceImages(htmlContent) {
    if (!htmlContent) return "";

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const matches = [...htmlContent.matchAll(imgRegex)];
    const uniqueSrcs = [...new Set(matches.map((m) => m[1]))];

    const replacementMap = await pMap(uniqueSrcs, async (remoteSrc) => {
      try {
        console.log(`📸 画像処理: ${remoteSrc}`);
        const metadata = await processImage(remoteSrc);
        return { remoteSrc, metadata, error: null };
      } catch (error) {
        console.error(`❌ 画像処理失敗 (${remoteSrc}):`, error.message);
        return { remoteSrc, metadata: null, error };
      }
    });

    const replacements = {};
    for (const { remoteSrc, metadata } of replacementMap) {
      if (metadata) {
        const imageHtml = Image.generateHTML(metadata, {
          alt: "ブログ本文の画像",
          loading: "lazy",
          decoding: "async",
          sizes: "(max-width: 720px) 100vw, (max-width: 1200px) 90vw, 720px",
        });
        replacements[remoteSrc] = imageHtml;
      }
    }

    let updatedHtml = htmlContent;
    for (const [remoteSrc, imageHtml] of Object.entries(replacements)) {
      updatedHtml = updatedHtml
        .split(`src="${remoteSrc}"`)
        .join(`src="${imageHtml.match(/src="([^"]+)"/)?.[1] || remoteSrc}"`);
      updatedHtml = updatedHtml
        .split(`src='${remoteSrc}'`)
        .join(`src='${imageHtml.match(/src="([^"]+)"/)?.[1] || remoteSrc}'`);
      const imgTagRegex = new RegExp(
        `<img[^>]+src=["']${remoteSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
        "g",
      );
      updatedHtml = updatedHtml.replace(imgTagRegex, imageHtml);
    }

    return updatedHtml;
  }

  // ==========================================
  // 🚀 microCMSデータ取得（並列化で高速化）
  // ==========================================
  eleventyConfig.addGlobalData("blogs", async () => {
    const apiDomain = process.env.MICROCMS_DOMAIN;
    const apiKey = process.env.MICROCMS_API_KEY;

    if (!apiDomain || !apiKey) {
      console.log("⚠️ microCMS環境変数なし、スキップ");
      return [];
    }

    try {
      const response = await fetch(
        `https://${apiDomain}.microcms.io/api/v1/blogs`,
        { headers: { "X-MICROCMS-API-KEY": apiKey } },
      );
      const data = await response.json();

      const processed = await pMap(data.contents, async (blog) => {
        if (blog.content) {
          blog.content = await downloadAndReplaceImages(blog.content);
        }
        if (blog.eyecatch && blog.eyecatch.url) {
          try {
            const metadata = await processImage(blog.eyecatch.url);
            // Store full metadata for responsive image generation in template
            blog.eyecatch.metadata = metadata;
            blog.eyecatch.url = metadata.webp[0].url; // fallback
          } catch (e) {
            console.error(`❌ アイキャッチ失敗: ${e.message}`);
          }
        }
        return blog;
      });

      // 新しい順（publishedAt降順）でソート
      processed.sort(
        (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
      );

      console.log(`✅ ${processed.length}件取得・並列処理完了`);
      return processed;
    } catch (error) {
      console.error("❌ microCMS取得失敗:", error);
      return [];
    }
  });

  // Turnstile設定をグローバルデータとして追加
  eleventyConfig.addGlobalData(
    "turnstileSiteKey",
    () => process.env.TURNSTILE_SITE_KEY || "0x4AAAAAAFewXlHoIOvxlwLY",
  );

  // パススルー
  [
    "CNAME",
    "_redirects",
    "_headers",
    "css",
    "images",
    "js",
    "fonts",
    ".well-known",
    { "static/comments": "comments" },
  ].forEach((p) => eleventyConfig.addPassthroughCopy(p));

  return {
    pathPrefix: "/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: ".",
      includes: "_includes",
      layouts: "_layouts",
      output: "_site",
    },
  };
};
