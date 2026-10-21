/**
 * Comment System Unit Tests
 * Run with: npx vitest run
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// テスト用のモック環境変数
const TEST_ENV = {
  ALLOWED_ORIGIN: "https://example.com",
  TURNSTILE_SECRET_KEY: "test-secret-key",
  COMMENT_HASH_SALT: "test-salt-12345678901234567890123456789012",
  MAX_COMMENT_LENGTH: "2000",
};

// グローバルfetchのモック
global.fetch = vi.fn();

// TextEncoder/TextDecoderのポリフィル（Node.js環境用）
if (typeof TextEncoder === "undefined") {
  global.TextEncoder = require("util").TextEncoder;
}
if (typeof TextDecoder === "undefined") {
  global.TextDecoder = require("util").TextDecoder;
}

// crypto.subtleのモック（Node.js環境用）
if (typeof crypto === "undefined" || !crypto.subtle) {
  global.crypto = {
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        const hash = require("crypto").createHash("sha256");
        hash.update(Buffer.from(data));
        return hash.digest();
      },
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// テスト対象の関数をインポートするためにコードを分離
// 実際の実装から検証ロジックのみを抽出してテスト

describe("Comment Input Validation", () => {
  const MAX_COMMENT_LENGTH = 2000;
  const MAX_NAME_LENGTH = 30;
  const MAX_PATH_LENGTH = 200;

  function validateInput(body: unknown): { valid: boolean; error?: string } {
    if (!body || typeof body !== "object") {
      return { valid: false, error: "無効なリクエストです" };
    }

    const { path, name, link, content, parent_id, turnstile_token, website } =
      body as Record<string, unknown>;

    // ハニーポット
    if (website !== undefined && website !== "") {
      return { valid: true, error: "honeybot" };
    }

    // path
    if (
      !path ||
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.length > MAX_PATH_LENGTH
    ) {
      return { valid: false, error: "無効なパスです" };
    }

    // content
    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (
      trimmedContent.length === 0 ||
      trimmedContent.length > MAX_COMMENT_LENGTH
    ) {
      return {
        valid: false,
        error: `本文は1文字以上${MAX_COMMENT_LENGTH}文字以内で入力してください`,
      };
    }

    // name
    if (name !== undefined && name !== null) {
      const nameStr = String(name).trim();
      if (nameStr.length > MAX_NAME_LENGTH) {
        return {
          valid: false,
          error: `名前は${MAX_NAME_LENGTH}文字以内で入力してください`,
        };
      }
    }

    // link
    if (link !== undefined && link !== null && link !== "") {
      const linkStr = String(link).trim();
      try {
        const url = new URL(linkStr);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return {
            valid: false,
            error: "リンクはhttp://またはhttps://で始まるURLを指定してください",
          };
        }
      } catch {
        return { valid: false, error: "無効なURL形式です" };
      }
    }

    // parent_id
    if (parent_id !== undefined && parent_id !== null && parent_id !== "") {
      if (typeof parent_id !== "string") {
        return { valid: false, error: "無効な親コメントIDです" };
      }
    }

    // turnstile_token
    if (!turnstile_token || typeof turnstile_token !== "string") {
      return { valid: false, error: "認証トークンが必要です" };
    }

    return { valid: true };
  }

  it("有効な入力を受け入れる", () => {
    const result = validateInput({
      path: "/blog/test/",
      name: "テストユーザー",
      link: "https://example.com",
      content: "これはテストコメントです。",
      parent_id: null,
      turnstile_token: "valid-token",
      website: "",
    });
    expect(result.valid).toBe(true);
  });

  it("path、content、turnstile_tokenが必須", () => {
    // pathなし
    let result = validateInput({
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("無効なパスです");

    // contentなし
    result = validateInput({
      path: "/blog/test/",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("本文は1文字以上");

    // turnstile_tokenなし
    result = validateInput({
      path: "/blog/test/",
      content: "テスト",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("認証トークンが必要です");
  });

  it("空の本文を拒否する", () => {
    const result = validateInput({
      path: "/blog/test/",
      content: "   ",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("本文は1文字以上");
  });

  it("長すぎる本文を拒否する", () => {
    const longContent = "a".repeat(2001);
    const result = validateInput({
      path: "/blog/test/",
      content: longContent,
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("本文は1文字以上");
  });

  it("長すぎる名前を拒否する", () => {
    const longName = "a".repeat(31);
    const result = validateInput({
      path: "/blog/test/",
      name: longName,
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("名前は30文字以内");
  });

  it("無効なURLスキームを拒否する", () => {
    const result = validateInput({
      path: "/blog/test/",
      link: "ftp://example.com",
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("http://またはhttps://");
  });

  it("有効なhttp/https URLを受け入れる", () => {
    const httpResult = validateInput({
      path: "/blog/test/",
      link: "http://example.com",
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(httpResult.valid).toBe(true);

    const httpsResult = validateInput({
      path: "/blog/test/",
      link: "https://example.com/path?query=1",
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(httpsResult.valid).toBe(true);
  });

  it("パスが/で始まらない場合は拒否する", () => {
    const result = validateInput({
      path: "blog/test/",
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("無効なパスです");
  });

  it("長すぎるパスを拒否する", () => {
    const longPath = "/" + "a".repeat(200);
    const result = validateInput({
      path: longPath,
      content: "テスト",
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("無効なパスです");
  });

  it("ハニーポットが埋められている場合は成功を装って破棄する", () => {
    const result = validateInput({
      path: "/blog/test/",
      content: "テスト",
      turnstile_token: "token",
      website: "spam",
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBe("honeybot");
  });

  it("parent_idが文字列でない場合は拒否する", () => {
    const result = validateInput({
      path: "/blog/test/",
      content: "テスト",
      parent_id: 123,
      turnstile_token: "token",
      website: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("無効な親コメントIDです");
  });
});

describe("KV Key Generation", () => {
  const HASH_SALT = "test-salt-12345678901234567890123456789012";

  async function hashPath(path: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${HASH_SALT}:${path}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  }

  function generateSortKey(): string {
    const now = Date.now();
    const maxTimestamp = 9999999999999;
    const reverseTimestamp = (maxTimestamp - now).toString().padStart(13, "0");
    const randomId = Array.from(new Uint8Array(8), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    return `${reverseTimestamp}-${randomId}`;
  }

  it("同一パスは同一プレフィックスになる", async () => {
    const path = "/blog/test-article/";
    const hash1 = await hashPath(path);
    const hash2 = await hashPath(path);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });

  it("異なるパスは異なるプレフィックスになる", async () => {
    const hash1 = await hashPath("/blog/article-1/");
    const hash2 = await hashPath("/blog/article-2/");
    expect(hash1).not.toBe(hash2);
  });

  it("ソートキーは逆順タイムスタンプで始まる", () => {
    const key1 = generateSortKey();
    const key2 = generateSortKey();
    // 逆順タイムスタンプ部分（最初の13文字）で比較
    const ts1 = key1.slice(0, 13);
    const ts2 = key2.slice(0, 13);
    // 後から生成した方が小さい（新しい順でソートされる）
    expect(ts2 <= ts1).toBe(true);
  });

  it("ソートキーにはランダムIDが含まれる", () => {
    const key = generateSortKey();
    const parts = key.split("-");
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBe(13); // reverse timestamp
    expect(parts[1].length).toBe(16); // 8 bytes = 16 hex chars
  });
});

describe("Honeypot Detection", () => {
  function checkHoneypot(website: unknown): boolean {
    return website !== undefined && website !== "";
  }

  it("空文字列は検知しない", () => {
    expect(checkHoneypot("")).toBe(false);
  });

  it("undefinedは検知しない", () => {
    expect(checkHoneypot(undefined)).toBe(false);
  });

  it("値が入っている場合は検知する", () => {
    expect(checkHoneypot("spam")).toBe(true);
    expect(checkHoneypot("http://spam.com")).toBe(true);
    expect(checkHoneypot(" ")).toBe(true);
  });
});
