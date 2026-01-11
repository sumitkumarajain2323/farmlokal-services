import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { ResponseHelper } from '@/utils/response';
import { logger } from '@/utils/logger';
import config from '@/config';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle known application errors
  if (error instanceof AppError) {
    ResponseHelper.error(
      res,
      error.message,
      error.statusCode,
      error.code,
      config.NODE_ENV === 'development' ? error.stack : undefined
    );
    return;
  }

  // Handle validation errors from express-validator
  if (error.name === 'ValidationError') {
    ResponseHelper.error(res, error.message, 400, 'VALIDATION_ERROR');
    return;
  }

  // Handle MySQL errors
  if (error.name === 'Error' && 'code' in error) {
    const mysqlError = error as any;
    
    switch (mysqlError.code) {
      case 'ER_DUP_ENTRY':
        ResponseHelper.error(res, 'Duplicate entry', 409, 'DUPLICATE_ENTRY');
        return;
      case 'ER_NO_REFERENCED_ROW_2':
        ResponseHelper.error(res, 'Referenced record not found', 400, 'INVALID_REFERENCE');
        return;
      case 'ECONNREFUSED':
        ResponseHelper.error(res, 'Database connection failed', 503, 'DATABASE_UNAVAILABLE');
        return;
      default:
        logger.error('MySQL Error:', mysqlError);
        break;
    }
  }

  // Handle Redis errors
  if (error.message && error.message.includes('Redis')) {
    logger.error('Redis Error:', error);
    ResponseHelper.error(res, 'Cache service unavailable', 503, 'CACHE_UNAVAILABLE');
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    ResponseHelper.error(res, 'Invalid token', 401, 'INVALID_TOKEN');
    return;
  }

  if (error.name === 'TokenExpiredError') {
    ResponseHelper.error(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    return;
  }

  // Handle syntax errors (malformed JSON, etc.)
  if (error instanceof SyntaxError && 'body' in error) {
    ResponseHelper.error(res, 'Invalid JSON format', 400, 'INVALID_JSON');
    return;
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    ResponseHelper.error(res, 'Request timeout', 408, 'REQUEST_TIMEOUT');
    return;
  }

  // Default to 500 server error
  const message = config.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  ResponseHelper.error(
    res,
    message,
    500,
    'INTERNAL_SERVER_ERROR',
    config.NODE_ENV === 'development' ? error.stack : undefined
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  ResponseHelper.error(
    res,
    `Route ${req.method} ${req.path} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};