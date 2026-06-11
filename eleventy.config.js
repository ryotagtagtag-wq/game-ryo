module.exports = function(eleventyConfig) {
  
  // ==========================================
  // 1. 静的ファイルのコピー設定（パススルー）
  // ==========================================
  // ルート直下にあるCNAMEファイルをそのまま出力フォルダにコピー
  eleventyConfig.addPassthroughCopy("CNAME");
  
  // アセット類（ルート直下にある各フォルダをそのままコピー）
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("fonts");

  // ==========================================
  // 2. ディレクトリ・ルートパス設定
  // ==========================================
  return {
    // カスタムドメインのためルートに設定
    pathPrefix: "/", 

    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",

    dir: {
      input: ".",           // 💡 ルート直下をソースフォルダに指定
      includes: "_includes", // 共通パーツ（ヘッダー等）
      layouts: "_layouts",   // レイアウトテンプレート
      output: "_site"       // GitHub Pagesが読み込む公開用フォルダ
    }
  };
};
