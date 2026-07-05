import { Router } from 'express';
import { signup, login, refresh, logout, me, acceptInvite } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.post('/invite/accept', acceptInvite);

export default router;
