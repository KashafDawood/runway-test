import { Router } from 'express';

import health from '@components/health/health.router';

const router: Router = Router();
router.use('/health', health);

export default router;
