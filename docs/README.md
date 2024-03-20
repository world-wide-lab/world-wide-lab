<p align="center">
  <img alt="The World-Wide-Lab Logo" src="../img/logo.svg" width="60%" align="center">
</p>

# World-Wide-Lab: Documentation

This directory contains the source code for the World-Wide-Lab documentation. You can view the rendered documentation online at <https://worldwidelab.org>.

## Setup

To build the documentation, you need to have [Node.js](https://nodejs.org/) installed on your system. Most modern versions of Node.js should work, but we recommend using the version referenced in the `.nvmrc` file [here](../.nvmrc).

 Once you have Node.js installed, you can install the required dependencies by running:

```bash
npm install
```

## Viewing the Documentation

To view the documentation, you can run the following command. This will start a local server which will automatically update as you make changes to the documentation.

```bash
npm run dev
```

Please note, that by default, the preview server does not generate the complete Reference section. If you want to also the automatically generated reference, please refer to the section on automatically generating the reference.

## Building

### Automatically Generating the Reference

The World-Wide-Lab documentation includes a section with a complete API reference for its exported packages. This section is automatically generated from the source code.

Generating the reference requires building these packages, we therefore need to first install their dependencies. You can do this by navigating to the root directory of the repository (world-wide-lab) and running the following command (you only need to do this once / whenever the dependencies change).

```bash
# In the root directory of the repository (one level above docs/)
npm install
```

After installing the dependencies, you can generate the reference by running the following command in the root directory of the repository. This command will build the packages and generate their references.

```bash
npm run ref
```

### Building the Documentation

To build the documentation, you can run the following command. This will aitp,automatically re-generate the reference amd generate a static version of the documentation in the `dist` directory. Please read the section on automatically generating the reference to install the requirements before running this command.

```bash
npm run build
```
