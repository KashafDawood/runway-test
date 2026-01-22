import { RoleName } from './role.interface';

export const FIXED_ROLES = [
  {
    name: RoleName.COACH,
    displayName: 'Coach',
    isAdmin: true,
    description: 'Full admin access to team resources'
  },
  {
    name: RoleName.ASSISTANT_COACH,
    displayName: 'Assistant Coach',
    isAdmin: true,
    description: 'Admin access similar to coach'
  },
  {
    name: RoleName.PLAYER,
    displayName: 'Player',
    isAdmin: false,
    description: 'Player with limited team access'
  },
  {
    name: RoleName.GUARDIAN,
    displayName: 'Guardian',
    isAdmin: false,
    description: 'Guardian with access to linked player information'
  },
  {
    name: RoleName.MEDIA,
    displayName: 'Media',
    isAdmin: false,
    description: 'Media access with view-only permissions'
  }
] as const;
