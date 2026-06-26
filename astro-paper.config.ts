import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://my-blog-5z2.pages.dev/",
    title: "盐究笔记",
    description: "一个磕盐人的技术自留地 —— 记录学习、项目实践与踩坑，把折腾明白的东西写清楚。",
    author: "磕盐人",
    profile: "https://example.com",
    ogImage: "default-og.jpg",
    lang: "zh",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/aphelius/my-blog/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github",  url: "https://github.com/aphelius" },
    { name: "discord", url: "https://discord.com/channels/alpha_lius" },
    { name: "mail",    url: "mailto:cnljj1001@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});