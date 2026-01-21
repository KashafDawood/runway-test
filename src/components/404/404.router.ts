import httpStatus from 'http-status';
import { Router, Request, Response } from 'express';

const router: Router = Router();
router.all('*', (req: Request, res: Response) => {
  const resBody = 'Route not found';
  res.status(httpStatus.NOT_FOUND).json({ ok: false, message: resBody });
});

export default router;
