import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from '@/utils/errors';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    throw new ValidationError('Validation failed', errorMessages[0]?.field);
  }
  
  next();
};

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    handleValidationErrors(req, res, next);
  };
};

export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

export const validateCursor = (cursor?: string): boolean => {
  if (!cursor) return true;
  
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return typeof parsed.id === 'number' && typeof parsed.timestamp === 'string';
  } catch {
    return false;
  }
};

export const encodeCursor = (id: number, timestamp: string): string => {
  const cursor = { id, timestamp };
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
};

export const decodeCursor = (cursor: string): { id: number; timestamp: string } => {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new ValidationError('Invalid cursor format');
  }
};