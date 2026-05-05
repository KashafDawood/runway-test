export interface UploadedImage {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface StoreImageParams {
  /** Path segments under `public/uploads`, e.g. `['teams', teamId, 'logo']` or `['users', userId, 'avatar']`. */
  keyParts: string[];
  /** Optional filename prefix, e.g. `logo`, `coverImage`, `avatar`. */
  namePrefix?: string;
}
