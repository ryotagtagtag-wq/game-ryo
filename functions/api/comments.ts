import { Turnstile } from "./turnstile";

// 定数
const MAX_COMMENT_LENGTH = parseInt(ENV.MAX_COMMENT_LENGTH || "2000", 10);
const MAX_NAME_LENGTH = 30;
const MAX_PATH_LENGTH = 200;
const MAX_COMMENTS_PER_PAGE = 200;
const HASH_SALT = ENV.COMMENT_HASH_SALT;
const ALLOWED_ORIGIN = ENV.ALLOWED_ORIGIN;
const TURNSTILE_SECRET_KEY = ENV.TURNSTILE_SECRET_KEY;

// KVキーのプレフィックスを生成
function getKeyPrefix(path: string): string {
  const hash = await hashPath(path);
  return `c:${hash}:`;
}

// パスをハッシュ化（ソルト付き）
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

// ランダムID生成
function generateRandomId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// タイムスタンプベースのソートキー生成（新しい順）
function generateSortKey(): string {
  const now = Date.now();
  const maxTimestamp = 9999999999999; // 13桁
  const reverseTimestamp = (maxTimestamp - now).toString().padStart(13, "0");
  return `${reverseTimestamp}-${generateRandomId()}`;
}

// 入力検証
interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "無効なリクエストです" };
  }

  const { path, name, link, content, parent_id, turnstile_token, website } =
    body as Record<string, unknown>;

  // ハニーポット
  if (website !== undefined && website !== "") {
    return { valid: true, error: "honeybot" }; // 成功を装って破棄
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

// 親コメントの存在確認
async function verifyParentComment(
  kv: KVNamespace,
  path: string,
  parentId: string,
): Promise<boolean> {
  const prefix = await getKeyPrefix(path);
  const parentKey = `${prefix}${parentId}`;
  const parentComment = await kv.get(parentKey, "json");
  return parentComment !== null;
}

// コメントの型
interface Comment {
  id: string;
  parent_id: string | null;
  name: string | null;
  link: string | null;
  content: string;
  created_at: string;
}

// GET /api/comments
export async function onRequestGet(
  context: EventContext<Env, any, any>,
): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path || !path.startsWith("/")) {
    return new Response(JSON.stringify({ error: "パスが指定されていません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const prefix = await getKeyPrefix(path);
    const listResult = await env.COMMENTS_KV.list({
      prefix,
      limit: MAX_COMMENTS_PER_PAGE,
    });

    const comments: Comment[] = [];
    for (const key of listResult.keys) {
      const comment = await env.COMMENTS_KV.get(key.name, "json");
      if (comment) {
        comments.push(comment as Comment);
      }
    }

    // 作成日時順（古い順）でソート
    comments.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return new Response(JSON.stringify({ comments }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("コメント取得エラー:", error);
    return new Response(
      JSON.stringify({ error: "コメントの取得に失敗しました" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// POST /api/comments
export async function onRequestPost(
  context: EventContext<Env, any, any>,
): Promise<Response> {
  const { request, env } = context;

  // Origin検証
  const origin = request.headers.get("Origin");
  if (!origin || origin !== ALLOWED_ORIGIN) {
    console.warn("Origin検証失敗:", origin);
    return new Response(
      JSON.stringify({ error: "許可されていないオリジンです" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "無効なJSONです" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 入力検証
  const validation = validateInput(body);
  if (!validation.valid) {
    if (validation.error === "honeybot") {
      // ハニーポット検知: 成功を装って破棄
      return new Response(JSON.stringify({ success: true, discarded: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { path, name, link, content, parent_id, turnstile_token } = body as {
    path: string;
    name?: string | null;
    link?: string | null;
    content: string;
    parent_id?: string | null;
    turnstile_token: string;
  };

  // Turnstile検証
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const turnstile = new Turnstile(TURNSTILE_SECRET_KEY);
  const turnstileResult = await turnstile.verify(turnstile_token, clientIp);

  if (!turnstileResult.success) {
    console.warn("Turnstile検証失敗:", turnstileResult["error-codes"]);
    return new Response(
      JSON.stringify({ error: "認証に失敗しました。もう一度お試しください" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 親コメント確認（返信は1段階のみ）
  if (parent_id) {
    const parentExists = await verifyParentComment(
      env.COMMENTS_KV,
      path,
      parent_id,
    );
    if (!parentExists) {
      return new Response(
        JSON.stringify({ error: "指定された親コメントが見つかりません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    // 親がすでに返信の場合はネストを許可しない（1段階まで）
    const parentKey = `${await getKeyPrefix(path)}${parent_id}`;
    const parentComment = await env.COMMENTS_KV.get(parentKey, "json");
    if (parentComment && (parentComment as Comment).parent_id) {
      return new Response(
        JSON.stringify({ error: "返信への返信はできません" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // コメント保存
  const commentId = generateSortKey();
  const comment: Comment = {
    id: commentId,
    parent_id: parent_id || null,
    name: name?.trim() || null,
    link: link?.trim() || null,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };

  const key = `${await getKeyPrefix(path)}${commentId}`;
  await env.COMMENTS_KV.put(key, JSON.stringify(comment));

  return new Response(JSON.stringify(comment), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

// Cloudflare Workersの型定義
interface Env {
  COMMENTS_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET_KEY: string;
  COMMENT_HASH_SALT: string;
  MAX_COMMENT_LENGTH?: string;
}

interface EventContext<Env, Params, Data> {
  request: Request;
  env: Env;
  params: Params;
  data: Data;
}
