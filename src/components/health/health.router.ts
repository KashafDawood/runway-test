import { Router, Request, Response } from 'express';
import httpStatus from 'http-status';

const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    ok: true,
    message: 'Service is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
