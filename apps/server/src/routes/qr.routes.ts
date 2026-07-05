import { Router } from 'express';
import { issueGuestToken } from '../controllers/auth.controller';

const router = Router();

// Public — guest scans QR, gets back a scoped JWT
router.post('/:tableToken', issueGuestToken);

export default router;
