import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "World-Wide-Lab",
  description:
    "World-Wide-Lab is an application to collect, store and administer data from online experiments and studies.",
  // Depends on the deployment path
  base: "/",
  head: [["link", { rel: "icon", href: "/favicon.png", type: "image/png" }]],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/favicon.png",

    search: {
      provider: "local",
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "About", link: "/guides/what-is-world-wide-lab" },
      { text: "Get Started", link: "/guides/getting-started" },
      {
        text: "Community",
        link: "https://github.com/world-wide-lab/world-wide-lab/discussions",
      },
      { text: "Reference", link: "/reference/" },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          {
            text: "What is World-Wide-Lab?",
            link: "/guides/what-is-world-wide-lab",
          },
          { text: "Getting Started", link: "/guides/getting-started" },
          { text: "Downloading Data", link: "/guides/download-data" },
        ],
      },
      {
        text: "Collecting Data",
        items: [
          {
            text: "Using the jsPsych Integration",
            link: "/guides/integration-jsPsych",
          },
          { text: "World-Wide-Web Client", link: "/guides/client" },
        ],
      },
      {
        text: "Running World-Wide-Lab",
        items: [
          { text: "Running Locally", link: "/guides/running-locally" },
          { text: "Configuring the Server", link: "/guides/configuration" },
          { text: "Deploying to the Cloud", link: "/guides/deployment" },
        ],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/world-wide-lab/world-wide-lab",
      },
    ],

    editLink: {
      pattern: ({ filePath }) => {
        if (filePath.startsWith("reference/")) {
          const basePath = filePath
            .replace("reference/", "")
            .replace("index.md", "")
            .replace(".md", "")
            .split(".")[0];
          return `https://github.com/world-wide-lab/world-wide-lab/edit/main/packages/${basePath}`;
        }
        return `https://github.com/world-wide-lab/world-wide-lab/edit/main/docs/${filePath}`;
      },
      text: "Edit this page on GitHub",
    },
  },
  srcExclude: ["README.md"],
});
