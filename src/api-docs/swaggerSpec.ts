import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WorldWideLab Public API",
      version: process.env.npm_package_version as string,
      description: "This is the public facing and unauthenticated portion of the WorldWideLab API.",
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
        url: `http://localhost:${process.env.PORT}/v1`,
      },
    ],
  },
  apis: ["./src/api/*.ts"],
};

const spec = swaggerJsdoc(options);

export default spec;