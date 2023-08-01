import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "World-Wide-Lab",
  description: "World-Wide-Lab is an application to collect, store and administer data from online experiments and studies.",
  head: [
    ['link', { rel: 'icon', href: '/img/favicon.png', type: 'image/png' }]
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/img/favicon.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/markdown-examples' }
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/world-wide-lab/world-wide-lab' }
    ],

    editLink: {
      pattern: 'https://github.com/world-wide-lab/world-wide-lab/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
  }
})
