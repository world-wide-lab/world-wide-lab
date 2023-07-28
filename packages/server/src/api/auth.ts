import { Request, Response } from "express";
import config from "../config"

function noAuth(res: Response, message: string): boolean {
  res.status(401).json({ error: message })
  return false
}

function requireAuth(req: Request, res: Response): boolean {
  const tokenRegexResult = req.headers.authorization && req.headers.authorization.match(/^Bearer (.*)$/);
  const token = (tokenRegexResult && tokenRegexResult[1]) ?  tokenRegexResult[1] : undefined;
  if (!token) { return noAuth(res, "Authentication via API Key required"); }

  // Verify authentication token
  // TODO: implement a more sophisticated authentication mechanism eventually
  if (!config.api.apiKey) {
    return noAuth(res, "WWL is currently not set up to use an API Key. Please set the respective environment variable.");
  }
  if (token !== config.api.apiKey) {
    return noAuth(res, "The provided API Key is invalid.");
  } else {
    // Authenticated
    return true
  }
}

export {
  requireAuth,
}
