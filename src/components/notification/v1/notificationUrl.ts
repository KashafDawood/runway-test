import config from '@config/config';

const base = (config.app.frontEndUrl || 'http://localhost:3000').replace(/\/+$/, '');

function url(path: string): string {
  return `${base}${path}`;
}

export const notificationUrl = {
  home: () => url('/home'),

  event: {
    detail: (eventId: string) => url(`/event/${eventId}`),
    calendar: () => url('/calendar'),
  },

  team: {
    manage: (teamId: string) => url(`/team-manage/${teamId}`),
    list: () => url('/manage-team'),
  },

  invite: {
    accept: (token: string) => url(`/team/invite/accept?token=${encodeURIComponent(token)}`),
    pending: () => url('/team/join/pending'),
    manageTeam: () => url('/manage-team'),
  },

  chat: {
    team: (teamId: string) => url(`/team-chat/${teamId}`),
  },
};
