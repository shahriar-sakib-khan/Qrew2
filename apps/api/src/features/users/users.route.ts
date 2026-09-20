import { Hono } from 'hono';
import { UsersController } from './users.controller';
import { requireAuth } from '../../infra/middleware/auth';

const usersRouter = new Hono();

usersRouter.use('*', requireAuth);

usersRouter.post('/verify-password', UsersController.verifyPassword);
usersRouter.post('/me/otp', UsersController.sendDeleteOtp);
usersRouter.delete('/me', UsersController.deleteMe);

export { usersRouter };
