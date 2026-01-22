export interface ITokenDecoded {
  _id: string;
  iat: number;
  exp: number;
}

export interface ITokenPayload {
  _id: string;
  email: string;
  role: string;
  email_verified: boolean;
}
