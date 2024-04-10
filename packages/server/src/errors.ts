import type { ErrorRequestHandler } from "express";
import { ValidationError } from "yup";
import { logger } from "./logger.js";

class AppError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Note: For the error handler to proper work with errors, they need to be
// passed along using the next function.
const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  logger.error(error);

  let status = 500;
  let type = error.name || "ServerError";
  const message =
    error.message || "Unspecified Server Error. Please check the server log.";
  if (error instanceof ValidationError) {
    status = 400;
    type = "ValidationError";
  } else if (error instanceof AppError) {
    status = error.status;
  }

  if (res.headersSent) {
    // Special Case: Header has already been sent, so we can not return JSON as a type
    res.send(
      `ERROR: ${message}. This error occured after data and headers have been sent. Please check the server logs.`,
    );
    return;
  }
  res.status(status).json({
    type: type,
    error: message,
  });
};

export { AppError, errorHandler };
