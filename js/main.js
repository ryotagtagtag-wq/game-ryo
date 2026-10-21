/**
 * Shared JS — i18n, SSH command copy, hamburger menu, contact form
 * Loaded via defer in base layout
 */

// ============================================
// i18n language switcher
// ============================================
(function () {
  const dict = window.__I18N__;
  if (!dict) return;

  const STORAGE_KEY = "game_ryo_lang";
  let currentLang = localStorage.getItem(STORAGE_KEY) || "ja";

  function applyLang(lang) {
    if (!dict[lang]) lang = "ja";
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    // Update all elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[lang][key]) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = dict[lang][key];
        } else {
          el.innerHTML = dict[lang][key];
        }
      }
    });

    // Update lang buttons
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    // Update html lang
    document.documentElement.lang = lang;
  }

  // Initial apply
  applyLang(currentLang);

  // Event delegation for lang buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".lang-btn");
    if (btn && btn.dataset.lang) {
      applyLang(btn.dataset.lang);
    }
  });

  // Expose for inline scripts that might need it
  window.__setLang = applyLang;
})();

// ============================================
// SSH command copy & dynamic update
// ============================================
(function () {
  const input = document.getElementById("ssh-username");
  const codeEl = document.getElementById("ssh-command");
  const copyBtn = document.getElementById("ssh-copy-btn");

  if (!input || !codeEl || !copyBtn) return;

  const host = codeEl.dataset.host || "sns.ryopc.org";
  const port = codeEl.dataset.port || "2221";

  function updateCommand() {
    const user = input.value.trim() || "guest";
    codeEl.textContent = `ssh ${user}@${host} -p ${port}`;
  }

  input.addEventListener("input", updateCommand);
  updateCommand();

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeEl.textContent);
      const original = copyBtn.textContent;
      // Use i18n dict for translated text
      const dict = window.__I18N__;
      const lang = localStorage.getItem("game_ryo_lang") || "ja";
      copyBtn.textContent =
        (dict && dict[lang] && dict[lang].activity_ssh_copied) ||
        (lang === "ja" ? "コピーしました！" : "Copied!");
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = original;
        copyBtn.classList.remove("copied");
      }, 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  });
})();

// ============================================
// Hamburger menu (mobile drawer)
// ============================================
(function () {
  const hamburger = document.getElementById("hamburger-btn");
  const drawer = document.getElementById("mobile-drawer");
  const overlay = document.getElementById("drawer-overlay");

  if (!hamburger || !drawer || !overlay) return;

  function toggleDrawer(open) {
    const isOpen =
      typeof open === "boolean" ? open : !drawer.classList.contains("open");
    drawer.classList.toggle("open", isOpen);
    overlay.classList.toggle("open", isOpen);
    hamburger.setAttribute("aria-expanded", isOpen);
    drawer.setAttribute("aria-hidden", !isOpen);
    overlay.setAttribute("aria-hidden", !isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  hamburger.addEventListener("click", () => toggleDrawer());
  overlay.addEventListener("click", () => toggleDrawer(false));

  // Close on link click
  drawer
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", () => toggleDrawer(false)));

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open"))
      toggleDrawer(false);
  });
})();

// ============================================
// Contact form submit handling
// ============================================
(function () {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "送信中...";
      // Let formsubmit.co handle the actual submission
      // Re-enable after timeout in case of issues
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "送信する";
      }, 10000);
    }
  });
})();

// ============================================
// Blog pagination (blog list page)
// ============================================
(function () {
  const prevBtn = document.querySelector('.pagination a[href*="previous"]');
  const nextBtn = document.querySelector('.pagination a[href*="next"]');
  // Pagination works via standard links - no JS needed
})();

// ============================================
// 404 page easter egg
// ============================================
(function () {
  if (!document.body.classList.contains("page-404")) return;

  const securePayload =
    "aHR0cHM6Ly9mby5yeW9wYy5vcmcvZ2V0LXJvbGUvUWxpdzBRYWtLbHA0RlJOVQ==";
  window.connect = function () {
    console.log(
      "%c[SUCCESS] 認証シグナルを検知。難読化データの復元を開始します...",
      "color: #00ff00; font-weight: bold;",
    );
    const targetUrl = atob(securePayload);
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 1200);
    return "🚀 接続中...";
  };

  console.log(
    [
      "============================================================",
      "",
      "",
      "   __ _  __ _ _ __ ___   ___   _ __ _   _  ___  ",
      "  / _` |/ _` | '_ ` _ \\ / _ \\ | '__| | | |/ _ \\ ",
      " | (_| | (_| | | | | | |  __/ | |  | |_| | (_) |",
      "  \\__, |\\__,_|_| |_| |_|\\___| |_|   \\__, |\\___/ ",
      "   __/ |                  ______     __/ |      ",
      "  |___/                  |______|   |___/       ",
      "                                                              ",
      "    さて、このコンソールを見ているということは……おそらくだいぶ優秀な技術者ですね？",
      "    こんなエラー画面の裏側まで覗きにくるなんて、さては僕みたいな人だな？",
      "    もしよかったら、技術者仲間になりませんか？",
      "    連絡はこのコマンドで ➔ ssh guest@sns.ryopc.org -p 2221",
      "    ギークなあなたへ挑戦状",
      "    このコンソールで connect() を実行（入力してEnter）すると、秘密の場所に繋がります。",
      "    ============================================================",
    ].join("\n"),
  );
})();
