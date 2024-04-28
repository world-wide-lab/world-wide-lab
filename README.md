<p align="center">
  <img alt="The World-Wide-Lab Logo" src="img/logo.svg" width="60%" align="center">
</p>

# World-Wide-Lab

World-Wide-Lab is an application to collect, store and administer data from online experiments and studies.

> [!NOTE]  
> World-Wide-Lab is currently in beta, so we might still be tweaking a few things here and there. Feel free to [reach out to us](mailto:wwl@simson.io) if you want to start using it for a project and we can help you get started!

## Packages

The project is split up into multiple packages. If you want to just give it a try, we suggest downloading the _self-contained app_ to run it on a desktop computer.

- Self-Contained App ([`electron-app`](./electron-app/)): Desktop application which contains everything to use World-Wide-Lab on your own computer to try it out and run local studies.
- Server ([`server`](./packages/server/)): The World-Wide-Lab server application containing the core of this software. You can run this on the cloud or on your own server-infrastructure to conduct (large-scale) online research.
- Client ([`client`](./packages/client/)): A small package to make it easier to use the World-Wide-Lab API in your own study or to store some custom data in World-Wide-Lab. If you use one of the libraries with a supported integration package, you will most probably not need this package.
- Deployment Helper ([`deploy`](./packages/deploy/)): A small package to automate deploying World-Wide-Lab to a cloud provider.
- jsPsych Integration ([`integration-jsPsych`](./packages/integration-jsPsych/)): A helper package making it easy to use World-Wide-Lab in combination with [jsPsych](https://www.jspsych.org/) experiments.
- Documentation ([`docs`](./docs/)): The website and documentation of World-Wide-Lab.
- Internal Packages (only used for development)
  - Server Tester ([`test-server`](./packages/test-server/)): Used to test a running World-Wide-Lab server.
