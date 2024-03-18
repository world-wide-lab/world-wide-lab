import express from "express";
import swaggerUi from "swagger-ui-express";
import spec from "./swaggerSpec";

const router = express.Router();

const options = {
  failOnErrors: true,
  customCss: ".swagger-ui .topbar { display: none }",
  swaggerOptions: {
    url: "./openapi.json",
    onComplete: () => {
      // https://stackoverflow.com/questions/1420881/how-to-extract-base-url-from-a-string-in-javascript
      // modified to also remove any GET parameters e.g. myUrl.php?test=123
      function getUrlOrigin(url: string) {
        if (url) {
          const parts = url.split("://");

          if (parts.length > 1) {
            return `${parts[0]}://${parts[1].split(/[?\/]/)[0]}`;
          }
          return parts[0].split(/[?\/]/)[0];
        }
      }

      window.addEventListener(
        "message",
        (event) => {
          // Only support messages from the same origin
          if (event.origin !== getUrlOrigin(window.location.href)) {
            return;
          }

          if (!event.data.setApiKey) {
            return;
          }

          // ui: Swagger UI instance
          // @ts-ignore
          ui.preauthorizeApiKey("apiKey", event.data.setApiKey);
        },
        false,
      );
    },
  },
};

router.get("/openapi.json", (req, res) => res.json(spec));
router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(undefined, options));

export default router;
