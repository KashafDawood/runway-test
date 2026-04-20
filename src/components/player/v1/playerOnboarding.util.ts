import { Player } from './player.model';
import { GuardianLink } from '@components/guardianLink/v1/guardianLink.model';
import { GuardianLinkStatus } from '@components/guardianLink/v1/guardianLink.interface';

/**
 * Derived onboarding gate: minor player without an approved guardian link for this team.
 */
export async function computeNeedsGuardianLink(
  userId: string,
  teamId: string
): Promise<boolean> {
  if (!userId || !teamId) {
    return false;
  }

  const player = await Player.findOne({
    userId,
    teamId
  }).select('_id isMinor');

  if (!player?.isMinor) {
    return false;
  }

  const approved = await GuardianLink.findOne({
    playerId: player._id,
    teamId,
    status: GuardianLinkStatus.APPROVED
  })
    .select('_id')
    .lean();

  return !approved;
}
