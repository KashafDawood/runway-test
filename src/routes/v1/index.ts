import { Router } from 'express';

import health from '@components/health/health.router';
import auth from '@components/auth/v1/auth.router';
import teamRouter from '@components/team/v1/team.router';
import teamInviteRouter from '@components/teamInvite/v1/teamInvite.router';
import userRoleRouter from '@components/userRole/v1/userRole.router';
import teamChatRouter from '@components/teamChat/v1/teamChat.router';
import eventRouter from '@components/event/v1/event.router';
import gameNoteRouter from '@components/gameNote/v1/gameNote.router';
import guardianLinkRouter from '@components/guardianLink/v1/guardianLink.router';

const router: Router = Router();
router.use('/health', health);
router.use('/auth', auth);
router.use('/teams', teamRouter);
router.use('/teams', guardianLinkRouter);
router.use('/team-invites', teamInviteRouter);
router.use('/user-roles', userRoleRouter);
router.use('/teams-chat', teamChatRouter);
router.use('/teams-event', eventRouter);
router.use('/game-notes', gameNoteRouter);

export default router;
