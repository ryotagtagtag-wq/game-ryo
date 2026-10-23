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

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[lang][key]) {
        let text = dict[lang][key];
        // Handle count placeholder
        if (el.dataset.i18nCount !== undefined) {
          text = text.replace("{{count}}", el.dataset.i18nCount);
        }
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = text;
        } else {
          el.innerHTML = text;
        }
      }
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    document.documentElement.lang = lang;
  }

  applyLang(currentLang);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".lang-btn");
    if (btn && btn.dataset.lang) applyLang(btn.dataset.lang);
  });

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
    drawer.toggleAttribute("inert", !isOpen);
    overlay.toggleAttribute("inert", !isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  hamburger.addEventListener("click", () => toggleDrawer());
  overlay.addEventListener("click", () => toggleDrawer(false));

  drawer
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", () => toggleDrawer(false)));

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
})();
