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

/** 跟随鼠标的反相圆（仿 MiMo）：缓动拖尾 + 悬停可点击元素放大 */
let lensBound = false;
function initCursorLens() {
  if (lensBound) return; // 监听器与动画循环只需启动一次，跨软导航持续生效
  if (prefersReducedMotion()) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  // 目标坐标（光标实时）与当前坐标（缓动逼近）
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  let started = false;

  const lens = () => document.querySelector<HTMLElement>(".cursor-lens");

  const loop = () => {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    const el = lens();
    if (el) el.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(loop);
  };

  const interactive = (t: EventTarget | null) =>
    t instanceof Element &&
    !!t.closest('a, button, [role="button"], input, textarea, select, summary');

  window.addEventListener(
    "mousemove",
    e => {
      tx = e.clientX;
      ty = e.clientY;
      const el = lens();
      if (el) {
        el.classList.add("is-active");
        el.classList.toggle("is-hover", interactive(e.target));
      }
      if (!started) {
        // 首次出现时不从 (0,0) 飞入，直接定位
        started = true;
        cx = tx;
        cy = ty;
      }
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () =>
    lens()?.classList.remove("is-active")
  );

  requestAnimationFrame(loop);
  lensBound = true;
}

function init() {
  initScrollReveal();
  initTyping();
  initCursorLens();
}

document.addEventListener("astro:page-load", init);
