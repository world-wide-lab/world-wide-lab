import { Request, Response } from "express";
import config from "../config";

function noAuth(res: Response, message: string): void {
  res.status(401).json({ error: message });
}

function requireAuthMiddleware(
  req: Request,
  res: Response,
  next: Function,
): void {
  const tokenRegexResult =
    req.headers.authorization &&
    req.headers.authorization.match(/^Bearer (.*)$/);
  const token =
    tokenRegexResult && tokenRegexResult[1] ? tokenRegexResult[1] : undefined;
  if (!token) {
    noAuth(res, "Authentication via API Key required");
    return;
  }

  // Verify authentication token
  // TODO: implement a more sophisticated authentication mechanism eventually
  if (!config.api.apiKey) {
    noAuth(
      res,
      "WWL is currently not set up to use an API Key. Please set the respective environment variable.",
    );
    return;
  }
  if (token !== config.api.apiKey) {
    noAuth(res, "The provided API Key is invalid.");
    return;
  } else {
    // Authenticated
    next();
  }
}

export { requireAuthMiddleware };
