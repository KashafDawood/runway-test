import { Router } from 'express';

import health from '@components/health/health.router';
import auth from '@components/auth/v1/auth.router';

const router: Router = Router();
router.use('/health', health);
router.use('/auth', auth);

export default router;
