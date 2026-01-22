import { IUser } from '@components/user/v1/user.interface';
import { RoleName } from '@components/role/v1/role.interface';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      teamId?: string;
      userTeamRole?: RoleName;
    }
  }
}

export {};
