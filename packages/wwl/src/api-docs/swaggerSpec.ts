import path from 'path'
import swaggerJsdoc from 'swagger-jsdoc'
import config from '../config'

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WorldWideLab Public API",
      version: config.version,
      description: "This is the public facing and unauthenticated portion of the WorldWideLab API.",
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
      contact: {
        name: "XXX",
        url: "https://logrocket.com",
        email: "info@email.com",
      }
    },
    servers: [
      {
        url: `${config.root}:${config.port}/v1`,
      },
    ],
    tags: [
      {
        name: "main",
        description: "The most important endpoints in the API."
      },
      {
        name: "public-info",
        description: "Retrieve information that is marked as public to e.g. track and store randomization of participants."
      },
      {
        name: "update",
        description: "Update information about participants or runs."
      }
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "WWL API KEY",
        }
      }
    }
  },
  apis: [
    path.join(__dirname, "../api/*.ts"),
    path.join(__dirname, "../api/*.js"),
  ],
};

const spec = swaggerJsdoc(options);

export default spec;