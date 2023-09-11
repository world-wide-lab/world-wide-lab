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
      { text: 'About', link: '/guides/what-is-world-wide-lab' },
      { text: 'Get Started', link: '/guides/getting-started' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is World-Wide-Lab?', link: '/guides/what-is-world-wide-lab' },
          { text: 'Getting Started', link: '/guides/getting-started' },
          { text: 'Downloading Data', link: '/guides/download-data' },
        ]
      },
      {
        text: 'Collecting Data',
        items: [
          { text: 'Using the jsPsych Integration', link: '/guides/integration-jsPsych' },
          { text: 'World-Wide-Web Client', link: '/guides/client' },
        ]
      },
      {
        text: 'Running World-Wide-Lab',
        items: [
          { text: 'Running Locally', link: '/guides/running-locally' },
          { text: 'Deploying to the Cloud', link: '/guides/deployment' },
        ]
      },
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
