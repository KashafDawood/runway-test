import { Router } from 'express';

import health from '@components/health/health.router';
import auth from '@components/auth/v1/auth.router';
import teamRouter from '@components/team/v1/team.router';
import teamInviteRouter from '@components/teamInvite/v1/teamInvite.router';
import userRoleRouter from '@components/userRole/v1/userRole.router';

const router: Router = Router();
router.use('/health', health);
router.use('/auth', auth);
router.use('/teams', teamRouter);
router.use('/team-invites', teamInviteRouter);
router.use('/user-roles', userRoleRouter);

export default router;
