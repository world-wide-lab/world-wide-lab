import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import config from "../config.js";
import { getDirectory } from "../util.js";

const dirname = getDirectory(import.meta.url);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WorldWideLab Public API",
      version: config.version,
      description:
        "This is the public facing and unauthenticated portion of the WorldWideLab API.",
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
      contact: {
        name: "XXX",
        url: "https://logrocket.com",
        email: "info@email.com",
      },
    },
    servers: [
      {
        url: "/v1",
      },
    ],
    tags: [
      {
        name: "main",
        description: "The most important endpoints in the API.",
      },
      {
        name: "public-info",
        description:
          "Retrieve information that is marked as public to e.g. track and store randomization of participants.",
      },
      {
        name: "update",
        description: "Update information about participants or sessions.",
      },
      {
        name: "download",
        description: "Export or download data for analyses.",
      },
      {
        name: "replication",
        description: "Replicate data from a WWL server to another.",
      },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "WWL API KEY",
        },
      },
    },
  },
  apis: [path.join(dirname, "../api/*.ts"), path.join(dirname, "../api/*.js")],
};

const spec = swaggerJsdoc(options);

export default spec;
