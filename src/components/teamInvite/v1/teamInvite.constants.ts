export const INVITE_EXPIRY_DAYS = 7;
export const INVITE_EXPIRY_MS = INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export const INVITE_ERRORS = {
  NOT_FOUND: 'Invite not found or has expired',
  ALREADY_ACCEPTED: 'This invite has already been accepted',
  EXPIRED: 'This invite has expired',
  INVALID_TOKEN: 'Invalid invite token',
  ALREADY_MEMBER: 'You are already a member of this team',
  PENDING_INVITE_EXISTS: 'An invite to this email already exists for this team',
  NOT_COACH: 'Only coaches can send team invites',
  SELF_INVITE: 'You cannot invite yourself to the team'
} as const;