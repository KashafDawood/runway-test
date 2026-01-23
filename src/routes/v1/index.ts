import { Router } from 'express';

import health from '@components/health/health.router';
import auth from '@components/auth/v1/auth.router';
import teamRouter from '@components/team/v1/team.router';

const router: Router = Router();
router.use('/health', health);
router.use('/auth', auth);
router.use('/teams', teamRouter); 

export default router;
