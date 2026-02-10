import { Request } from 'express';
import { IUser } from '@components/user/v1/user.interface';
import { RoleName } from '@components/role/v1/role.interface';

// Extended Express request used across middlewares/controllers
export interface RequestWithContext extends Request {
  user?: IUser;
  teamId?: string;
  userTeamRole?: RoleName;
}

