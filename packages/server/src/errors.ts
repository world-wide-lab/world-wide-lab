import type { ErrorRequestHandler } from "express";
import { ValidationError } from "yup";
import { logger } from "./logger";

class AppError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Note: For the error handler to proper work with errors, they need to be
// passed along using the next function.
const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  logger.error(error);

  let status = 500;
  const message = error.message || "Server Error. Please check the server log.";
  if (error instanceof ValidationError) {
    status = 400;
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
  res.status(status).json({ error: message });
};

export { AppError, errorHandler };
