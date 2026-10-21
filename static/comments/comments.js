// Comment System Client
(function () {
  "use strict";

  // 設定をdata属性から取得
  const container = document.getElementById("comments-container");
  if (!container) return;

  const apiPath = container.dataset.apiPath || "/api/comments";
  const turnstileSiteKey = container.dataset.turnstileSiteKey;
  const pagePath = container.dataset.pagePath || location.pathname;
  const maxComments = parseInt(container.dataset.maxComments || "200", 10);

  let turnstileWidgetId = null;
  let isSubmitting = false;

  /**
   * HTMLエスケープ
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * リンク要素の生成
   * @param {string} href
   * @param {string} text
   * @returns {HTMLAnchorElement}
   */
  function createLinkElement(href, text) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    a.rel = "nofollow noopener noreferrer";
    a.target = "_blank";
    return a;
  }

  /**
   * 日時フォーマット
   * @param {string} isoString
   * @returns {string}
   */
  function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * コメント要素の作成
   * @param {CommentData} comment
   * @param {number} depth
   * @returns {HTMLElement}
   */
  function createCommentElement(comment, depth) {
    const wrapper = document.createElement("div");
    wrapper.className = "comment-wrapper";
    wrapper.style.marginLeft = `${depth * 24}px`;
    wrapper.dataset.commentId = comment.id;

    const commentEl = document.createElement("article");
    commentEl.className = "comment";

    // ヘッダー
    const header = document.createElement("header");
    header.className = "comment-header";

    // 名前
    if (comment.name) {
      const nameEl = document.createElement("span");
      nameEl.className = "comment-name";
      if (comment.link) {
        nameEl.appendChild(
          createLinkElement(comment.link, escapeHtml(comment.name)),
        );
      } else {
        nameEl.textContent = escapeHtml(comment.name);
      }
      header.appendChild(nameEl);
    }

    // 日時
    const timeEl = document.createElement("time");
    timeEl.className = "comment-time";
    timeEl.dateTime = comment.created_at;
    timeEl.textContent = formatDate(comment.created_at);
    header.appendChild(timeEl);

    commentEl.appendChild(header);

    // 本文
    const contentEl = document.createElement("div");
    contentEl.className = "comment-content";
    contentEl.textContent = comment.content;
    commentEl.appendChild(contentEl);

    // 返信ボタン（親コメントのみ）
    if (!comment.parent_id) {
      const replyBtn = document.createElement("button");
      replyBtn.className = "comment-reply-btn";
      replyBtn.type = "button";
      replyBtn.textContent = "返信";
      replyBtn.addEventListener("click", () =>
        showReplyForm(comment.id, wrapper),
      );
      commentEl.appendChild(replyBtn);
    }

    wrapper.appendChild(commentEl);
    return wrapper;
  }

  /**
   * 返信フォーム表示
   * @param {string} parentId
   * @param {HTMLElement} parentWrapper
   */
  function showReplyForm(parentId, parentWrapper) {
    // 既存の返信フォームを削除
    const existingForm = parentWrapper.querySelector(".reply-form");
    if (existingForm) existingForm.remove();

    const form = createCommentForm(parentId);
    parentWrapper.appendChild(form);
    form.querySelector("textarea")?.focus();
  }

  /**
   * コメントフォーム作成（新規投稿用・返信用共通）
   * @param {string|null} parentId
   * @returns {HTMLElement}
   */
  function createCommentForm(parentId) {
    const form = document.createElement("form");
    form.className = "comment-form reply-form";
    form.dataset.parentId = parentId || "";

    // トークン入力
    const tokenInput = document.createElement("input");
    tokenInput.type = "hidden";
    tokenInput.name = "turnstile_token";
    form.appendChild(tokenInput);

    // ハニーポット
    const honeyInput = document.createElement("input");
    honeyInput.type = "checkbox";
    honeyInput.name = "website";
    honeyInput.style.display = "none";
    honeyInput.tabIndex = -1;
    honeyInput.autocomplete = "off";
    form.appendChild(honeyInput);

    // 名前
    const nameGroup = document.createElement("div");
    nameGroup.className = "form-group";
    const nameLabel = document.createElement("label");
    nameLabel.htmlFor = `comment-name-${parentId || "new"}`;
    nameLabel.textContent = "名前（任意）";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = `comment-name-${parentId || "new"}`;
    nameInput.name = "name";
    nameInput.maxLength = 30;
    nameInput.placeholder = "匿名";
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);

    // リンク
    const linkGroup = document.createElement("div");
    linkGroup.className = "form-group";
    const linkLabel = document.createElement("label");
    linkLabel.htmlFor = `comment-link-${parentId || "new"}`;
    linkLabel.textContent = "リンク（任意）";
    const linkInput = document.createElement("input");
    linkInput.type = "url";
    linkInput.id = `comment-link-${parentId || "new"}`;
    linkInput.name = "link";
    linkInput.placeholder = "https://example.com";
    linkGroup.appendChild(linkLabel);
    linkGroup.appendChild(linkInput);
    form.appendChild(linkGroup);

    // 本文
    const contentGroup = document.createElement("div");
    contentGroup.className = "form-group";
    const contentLabel = document.createElement("label");
    contentLabel.htmlFor = `comment-content-${parentId || "new"}`;
    contentLabel.textContent = "コメント";
    const contentArea = document.createElement("textarea");
    contentArea.id = `comment-content-${parentId || "new"}`;
    contentArea.name = "content";
    contentArea.rows = 4;
    contentArea.required = true;
    contentArea.setAttribute("aria-required", "true");
    contentGroup.appendChild(contentLabel);
    contentGroup.appendChild(contentArea);
    form.appendChild(contentGroup);

    // Turnstileウィジェットコンテナ
    const turnstileContainer = document.createElement("div");
    turnstileContainer.className = "turnstile-container";
    turnstileContainer.id = `turnstile-${parentId || "new"}`;
    form.appendChild(turnstileContainer);

    // エラー表示
    const errorDiv = document.createElement("div");
    errorDiv.className = "comment-error";
    errorDiv.setAttribute("role", "alert");
    errorDiv.style.display = "none";
    form.appendChild(errorDiv);

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "comment-submit-btn";
    submitBtn.textContent = parentId ? "返信を送信" : "コメントを送信";
    form.appendChild(submitBtn);

    // 送信処理
    form.addEventListener("submit", (e) => handleSubmit(e, form, parentId));

    // Turnstileレンダリング
    if (typeof turnstile !== "undefined" && turnstileSiteKey) {
      turnstileWidgetId = turnstile.render(turnstileContainer.id, {
        sitekey: turnstileSiteKey,
        theme: "auto",
        callback: (token) => {
          tokenInput.value = token;
        },
        "expired-callback": () => {
          tokenInput.value = "";
        },
      });
    }

    return form;
  }

  /**
   * 送信ハンドラ
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {string|null} parentId
   */
  async function handleSubmit(event, form, parentId) {
    event.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    const submitBtn = form.querySelector(".comment-submit-btn");
    const errorDiv = form.querySelector(".comment-error");
    const tokenInput = form.querySelector('input[name="turnstile_token"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "送信中...";
    }
    if (errorDiv) {
      errorDiv.style.display = "none";
      errorDiv.textContent = "";
    }

    const formData = new FormData(form);
    const body = {
      path: pagePath,
      name: formData.get("name") || null,
      link: formData.get("link") || null,
      content: formData.get("content"),
      parent_id: parentId,
      turnstile_token: tokenInput?.value || "",
      website: formData.get("website") || "",
    };

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "短時間に多くの投稿が行われました。しばらく時間をおいてから再度お試しください",
          );
        }
        throw new Error(data.error || "投稿に失敗しました");
      }

      // ハニーポットで破棄された場合
      if (data.discarded) {
        form.reset();
        if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
          turnstile.reset(turnstileWidgetId);
        }
        return;
      }

      // 成功: コメントを追加表示
      /** @type {CommentData} */
      const newComment = data;
      const commentsList = document.getElementById("comments-list");
      if (commentsList) {
        if (parentId) {
          // 返信の場合：親コメントの直後に挿入
          const parentWrapper = document.querySelector(
            `[data-comment-id="${parentId}"]`,
          );
          if (parentWrapper) {
            const replyEl = createCommentElement(newComment, 1);
            parentWrapper.appendChild(replyEl);
          }
        } else {
          // 新規コメント：リストの先頭に追加（古い順なので最後）
          commentsList.appendChild(createCommentElement(newComment, 0));
        }
      }

      // フォームリセット
      form.reset();
      if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
        turnstile.reset(turnstileWidgetId);
      }

      // 返信フォームなら削除
      if (parentId) {
        form.remove();
      }
    } catch (err) {
      if (errorDiv) {
        errorDiv.textContent =
          err instanceof Error ? err.message : "エラーが発生しました";
        errorDiv.style.display = "block";
      }
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = parentId ? "返信を送信" : "コメントを送信";
      }
    }
  }

  /**
   * コメント一覧取得・描画
   */
  async function loadComments() {
    const listEl = document.getElementById("comments-list");
    const loadingEl = document.getElementById("comments-loading");
    const errorEl = document.getElementById("comments-error");

    if (!listEl) return;

    try {
      if (loadingEl) loadingEl.style.display = "block";
      if (errorEl) errorEl.style.display = "none";

      const response = await fetch(
        `${apiPath}?path=${encodeURIComponent(pagePath)}`,
        {
          credentials: "same-origin",
        },
      );

      if (!response.ok) {
        throw new Error("コメントの読み込みに失敗しました");
      }

      /** @type {{ comments: CommentData[] }} */
      const data = await response.json();
      const comments = data.comments || [];

      // 親コメントと返信を分離
      const parentComments = comments.filter((c) => !c.parent_id);
      const replies = comments.filter((c) => c.parent_id);

      // 返信を親IDでグループ化
      /** @type {Map<string, CommentData[]>} */
      const repliesByParent = new Map();
      for (const reply of replies) {
        if (reply.parent_id) {
          const arr = repliesByParent.get(reply.parent_id) || [];
          arr.push(reply);
          repliesByParent.set(reply.parent_id, arr);
        }
      }

      // 描画
      listEl.innerHTML = "";
      for (const parent of parentComments) {
        const wrapper = createCommentElement(parent, 0);
        listEl.appendChild(wrapper);

        // 返信がある場合
        const parentReplies = repliesByParent.get(parent.id) || [];
        for (const reply of parentReplies) {
          wrapper.appendChild(createCommentElement(reply, 1));
        }
      }

      // コメント数更新
      const countEl = document.getElementById("comments-count");
      if (countEl) {
        countEl.textContent = `${comments.length}件`;
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent =
          err instanceof Error
            ? err.message
            : "コメントの読み込みに失敗しました";
        errorEl.style.display = "block";
      }
    } finally {
      if (loadingEl) loadingEl.style.display = "none";
    }
  }

  /**
   * 初期化
   */
  function init() {
    // ローディング表示
    const loadingEl = document.createElement("div");
    loadingEl.id = "comments-loading";
    loadingEl.className = "comments-loading";
    loadingEl.textContent = "コメントを読み込み中...";
    container.appendChild(loadingEl);

    // エラー表示用
    const errorEl = document.createElement("div");
    errorEl.id = "comments-error";
    errorEl.className = "comments-error";
    errorEl.style.display = "none";
    container.appendChild(errorEl);

    // コメント一覧エリア作成
    const listContainer = document.createElement("div");
    listContainer.id = "comments-list";
    listContainer.className = "comments-list";
    container.appendChild(listContainer);

    // 新規投稿フォーム
    const formContainer = document.createElement("div");
    formContainer.id = "comments-form-container";
    formContainer.appendChild(createCommentForm());
    container.appendChild(formContainer);

    // 読み込み
    loadComments();
  }

  // 初期化実行（Turnstileの読み込みを待たずに即実行）
  // Turnstileウィジェットはフォーム作成時に遅延レンダリングされる
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/**
 * @typedef {Object} CommentData
 * @property {string} id
 * @property {string|null} parent_id
 * @property {string|null} name
 * @property {string|null} link
 * @property {string} content
 * @property {string} created_at
 */
