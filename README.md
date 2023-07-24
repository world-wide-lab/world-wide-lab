<p align="center">
  <img alt="The World-Wide-Lab Logo" src="packages/wwl/static/logo.svg" width="60%" align="center">
</p>

# World-Wide-Lab

World-Wide-Lab is an application to collect, store and administer data from online experiments and studies.

## Packages

The project is split up into multiple packages. If you want to just give it a try, we suggest downloading the *self-contained app* to run it on a desktop computer.

- Self-Contained App ([`electron-app`](./packages/electron-app/)): Desktop application which contains everything to use World-Wide-Lab on your own computer to try it out and run local studies.
- Server ([`wwl`](./packages/wwl/)): The World-Wide-Lab server application containing the core of this software. You can run this on the cloud or on your own server-infrastructure to conduct (large-scale) online research.
- Planned (Not yet implemented)
  - jsPsych Integration ([`jsPsych`](./packages/jsPsych/)): A helper package making it easy to use World-Wide-Lab in combination with jsPsych experiments.
  - API Helper ([`api`](./packages/api/)): A small package to make it easier to use the World-Wide-Lab API in your own study or to store some custom data in World-Wide-Lab. If you use one of the libraries with a supported integration package, you will most probably not need this package.
