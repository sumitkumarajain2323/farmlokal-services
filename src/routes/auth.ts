import { Router } from 'express';
import { oauthService } from '@/modules/auth/oauth-service';
import { ResponseHelper } from '@/utils/response';
import { asyncHandler } from '@/middlewares/error-handler';
import { strictRateLimiter } from '@/middlewares/rate-limiter';
import { logger } from '@/utils/logger';

const router = Router();

// Apply strict rate limiting to auth routes
router.use(strictRateLimiter.middleware());

// GET /auth/token - Get OAuth access token info
router.get(
  '/token',
  asyncHandler(async (req, res) => {
    const tokenInfo = await oauthService.getTokenInfo();

    ResponseHelper.success(
      res,
      {
        isValid: tokenInfo.isValid,
        expiresIn: tokenInfo.expiresIn,
      },
      'Token information retrieved successfully'
    );
  })
);

// POST /auth/token/refresh - Force refresh OAuth token
router.post(
  '/token/refresh',
  asyncHandler(async (req, res) => {
    logger.info('Manual token refresh requested');
    
    // Invalidate current token to force refresh
    await oauthService.invalidateToken();
    
    // Get new token (this will fetch from provider)
    const accessToken = await oauthService.getAccessToken();
    
    // Get token info for response
    const tokenInfo = await oauthService.getTokenInfo();

    ResponseHelper.success(
      res,
      {
        refreshed: true,
        expiresIn: tokenInfo.expiresIn,
        // Don't return the actual token for security
      },
      'Token refreshed successfully'
    );
  })
);

// DELETE /auth/token - Invalidate current token
router.delete(
  '/token',
  asyncHandler(async (req, res) => {
    await oauthService.invalidateToken();

    ResponseHelper.success(
      res,
      { invalidated: true },
      'Token invalidated successfully'
    );
  })
);

export default router;