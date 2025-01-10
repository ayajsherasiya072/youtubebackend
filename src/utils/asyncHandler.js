import {ApiError} from '../utils/ApiError.js'

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
          success: err.success,
          statusCode: err.statusCode,
          message: err.message,
          errors: err.errors,
        });
      }
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Internal Server Error",
        errors: [],
      });
    });
  };
};
export { asyncHandler };