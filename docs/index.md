---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "World-Wide-Lab"
  text: "Citizen Science for Everyone"
  tagline: Free and open-source application to collect, store and administer data from online experiments and studies.
  image:
    src: /favicon_hd.png
    alt: logo
  actions:
    - theme: brand
      text: Check out the Demo
      link: https://worldwidelab.org/redirect-demo.html
    - theme: alt
      text: Get Started
      link: /guides/getting-started

features:
  - title: Easy to Use
    icon: 🚀
    details: Download the World-Wide-App Desktop App and you're ready to get started.
  - title: Currently in Beta
    icon: β
    details: World-Wide-Lab is currently in beta — heads up! We're still tweaking a few things here and there.
  - title: Open Source
    icon: 📦
    details: World-Wide-Lab is free and open-source software, so you can use and adapt it as you like.
  - title: Ready for the Web
    icon: 🌐
    details: Once you're ready to launch your studies online, deploy them publicly with the World-Wide-App Server.
  - title: Scalable
    icon: 🔥
    details: Don't lose data when going viral, since you can scale up  performance to accomodate many users at once.
  - title: Plug 'n Play
    icon: 🧩
    details: Easily collect data from jsPsych experiments using the jsPsychWorldWideLab-Plugin.
---

<script>
  if (!import.meta.env.SSR) {
    import('atropos/element').then((atropos) => {
      customElements.define('atropos-component', atropos.default);
    })
  }
</script>

<style>
  .my-atropos {
    display: block;
    width: 100%;
    margin: 2rem auto 0;
    padding: 1rem;
    position: relative;
    overflow: hidden;
  }
  .screenshot-container {
    border-radius: 16px;
    border: 1px solid lightgrey;
    overflow: hidden;
    max-width: 60%;
    margin: 0 auto;
  }
  .screenshot-container img {
    max-width: 100%;
  }
  .floating-logo {
    position: absolute;
    bottom: 33%;
    left: 14%;
    width: 20%;
    padding: 0 1.5%;
  }
  .floating-name {
    position: absolute;
    bottom: 25%;
    left: 14%;
    width: 20%;
    text-align: center;
    font-size: 1.5rem;
    color: #4A5568;
  }

  .floating-support {
    position: absolute;
    bottom: 5%;
    right: 11%;
    width: 18%;
    background-color: white;
    padding: 1rem;
    border-radius: 16px;
    border: 1px solid lightgrey;
    text-align: center;
    opacity: 0.8;
  }
  .floating-support img {
    max-width: 85%;
    margin: 0 auto;
  }
</style>

<atropos-component class="my-atropos" active-offset="40" shadow-scale="0" rotate-x-max="10" rotate-y-max="10">
  <div class="screenshot-container">
    <img src="/img/landing-page/dashboard-no-window.png" />
  </div>
  <img class="floating-logo" src="/public/favicon_hd.png" data-atropos-offset="5"/>
  <div class="floating-name" data-atropos-offset="5">World-Wide-Lab</div>
  <div class="floating-support" data-atropos-offset="7">
    With integrated support for
    <img src="/img/landing-page/jspsych-logo.jpg"/>
  </div>
</atropos-component>
