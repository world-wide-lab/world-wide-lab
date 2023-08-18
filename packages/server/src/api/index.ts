import express from "express";

import { routerProtected } from "./protected";
import { routerPublic } from "./public";

const router = express.Router();

router.use("/", routerPublic);
router.use("/", routerProtected);

export default router;
