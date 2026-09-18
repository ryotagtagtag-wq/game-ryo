require("dotenv").config();
const Image = require("@11ty/eleventy-img");
const fs = require("fs");
const htmlmin = require("html-minifier-terser");
const sanitizeHtml = require("sanitize-html");

const CONCURRENCY_LIMIT = 5;

module.exports = function (eleventyConfig) {
  
  if (!fs.existsSync("./_site/img/")) {
    fs.mkdirSync("./_site/img/", { recursive: true });
  }

  // ==========================================
  // 🔧 Nunjucks フィルタ追加（reverse, slice, first 等）
  // ==========================================
  eleventyConfig.addFilter("reverse", function(arr) {
    return [...arr].reverse();
  });
  eleventyConfig.addFilter("slice", function(arr, start, end) {
    return arr.slice(start, end);
  });
  eleventyConfig.addFilter("first", function(arr, n) {
    return arr.slice(0, n);
  });

  // ==========================================
  // 🛡️ [XSS対策] HTMLサニタイズフィルター
  // ==========================================
  eleventyConfig.addFilter("sanitizeHtml", function(htmlContent) {
    if (!htmlContent) return "";
    return sanitizeHtml(htmlContent, {
      allowedTags: [
        "p", "br", "strong", "em", "u", "s", "code", "pre",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "dl", "dt", "dd",
        "blockquote", "hr",
        "a", "img", "figure", "figcaption",
        "table", "thead", "tbody", "tr", "th", "td",
        "div", "span",
        "figure", "figcaption",
        "section", "article", "header", "footer",
        "nav", "aside", "main"
      ],
      allowedAttributes: {
        "a": ["href", "title", "target", "rel"],
        "img": ["src", "alt", "title", "width", "height", "loading", "decoding"],
        "code": ["class"],
        "pre": ["class"],
        "div": ["class"],
        "span": ["class"],
        "blockquote": ["cite"],
        "th": ["scope"],
        "td": ["colspan", "rowspan"],
        "*": ["class", "id", "style"]
      },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowedSchemesByTag: {},
      allowedSchemesAppliedToAttributes: ["href", "src"],
      selfClosing: ["img", "br", "hr"],
      enforceHtmlBoundary: true,
      parserOptions: { lowerCaseTags: true }
    });
  });

  // ==========================================
  // 🗜️ [完全圧縮処理] HTML/CSS/JS圧縮
  // ==========================================
  eleventyConfig.addTransform("htmlmin", function(content) {
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
  // 💡 画像処理関数（キャッシュ活用）
  // ==========================================
  async function processImage(srcUrl) {
    if (!srcUrl) return null;
    return await Image(srcUrl, {
      widths: ["auto"], 
      formats: ["webp"], 
      outputDir: "./_site/img/", 
      urlPath: "/img/", 
      cacheOptions: {
        duration: "1d", 
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
  // 💡 本文画像の一括置換（並列化）
  // ==========================================
  async function downloadAndReplaceImages(htmlContent) {
    if (!htmlContent) return "";

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const matches = [...htmlContent.matchAll(imgRegex)];
    const uniqueSrcs = [...new Set(matches.map(m => m[1]))];

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
          decoding: "async"
        });
        replacements[remoteSrc] = imageHtml;
      }
    }

    let updatedHtml = htmlContent;
    for (const [remoteSrc, imageHtml] of Object.entries(replacements)) {
      updatedHtml = updatedHtml.split(`src="${remoteSrc}"`).join(`src="${imageHtml.match(/src="([^"]+)"/)?.[1] || remoteSrc}"`);
      updatedHtml = updatedHtml.split(`src='${remoteSrc}'`).join(`src='${imageHtml.match(/src="([^"]+)"/)?.[1] || remoteSrc}'`);
      const imgTagRegex = new RegExp(`<img[^>]+src=["']${remoteSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g');
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
        { headers: { "X-MICROCMS-API-KEY": apiKey } }
      );
      const data = await response.json();

      const processed = await pMap(data.contents, async (blog) => {
        if (blog.content) {
          blog.content = await downloadAndReplaceImages(blog.content);
        }
        if (blog.eyecatch && blog.eyecatch.url) {
          try {
            const metadata = await processImage(blog.eyecatch.url);
            blog.eyecatch.url = metadata.webp[0].url;
          } catch (e) {
            console.error(`❌ アイキャッチ失敗: ${e.message}`);
          }
        }
        return blog;
      });

      console.log(`✅ ${processed.length}件取得・並列処理完了`);
      return processed;
    } catch (error) {
      console.error("❌ microCMS取得失敗:", error);
      return [];
    }
  });

  // パススルー
  ["CNAME", "_redirects", "_headers", "css", "images", "js", "fonts", ".well-known"]
    .forEach(p => eleventyConfig.addPassthroughCopy(p));

  return {
    pathPrefix: "/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: { input: ".", includes: "_includes", layouts: "_layouts", output: "_site" },
  };
};
