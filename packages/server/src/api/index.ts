import express from "express";

import { routerProtected } from "./protected.js";
import { routerPublic } from "./public.js";

const router = express.Router();

router.use("/", routerPublic);
router.use("/", routerProtected);

export default router;
