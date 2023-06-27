import express from 'express';
import swaggerUi from 'swagger-ui-express';
import spec from './swaggerSpec';

const router = express.Router();

const options = {
  failOnErrors: true,
  swaggerOptions: {
    url: "./openapi.json",
  },
};

router.get("/openapi.json", (req, res) => res.json(spec));
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(undefined, options));

export default router;
