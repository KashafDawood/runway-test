import { IUser } from '@components/user/v1/user.interface';
import { RoleName } from '@components/role/v1/role.interface';

declare global {
  namespace Express {
    namespace Multer {
      /** Minimal file shape from multer memory storage (no @types/multer dependency). */
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
    }

    interface Request {
      user?: IUser;
      teamId?: string;
      userTeamRole?: RoleName;
      file?: Express.Multer.File;
      files?:
        | {
            [fieldname: string]: Express.Multer.File[];
          }
        | Express.Multer.File[];
    }
  }
}

export {};
