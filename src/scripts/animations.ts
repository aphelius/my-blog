// 动效脚本：滚动递进 + 首页标题打字机
// 在每次页面加载（含 View Transitions 软导航）后重新初始化。

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 滚动进入视口时为 .reveal 元素添加 .is-visible */
function initScrollReveal() {
  const targets = document.querySelectorAll<HTMLElement>(".reveal");
  if (targets.length === 0) return;

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    targets.forEach(el => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
  );

  targets.forEach(el => observer.observe(el));
}

/** 首页标题打字机效果 */
function initTyping() {
  const el = document.querySelector<HTMLElement>("[data-typing]");
  if (!el) return;

  const fullText = el.dataset.typing ?? el.textContent ?? "";
  if (!fullText) return;

  // 减弱动态：直接显示完整文字，不加光标
  if (prefersReducedMotion()) {
    el.textContent = fullText;
    return;
  }

  el.textContent = "";
  const cursor = document.createElement("span");
  cursor.className = "typing-cursor";
  cursor.textContent = "▍";
  el.after(cursor);

  let i = 0;
  const tick = () => {
    el.textContent = fullText.slice(0, i);
    i += 1;
    if (i <= fullText.length) {
      window.setTimeout(tick, 110);
    } else {
      // 打完后让光标再闪几秒后淡出
      window.setTimeout(() => cursor.remove(), 3000);
    }
  };
  window.setTimeout(tick, 250);
}

function init() {
  initScrollReveal();
  initTyping();
}

document.addEventListener("astro:page-load", init);
