import { Router } from 'express';
import ticketsRouter from './tickets';
import announcementsRouter from './announcements';
import messagesRouter from './messages';
import knowledgeBaseRouter from './knowledgeBase';
import statusRouter from './status';

const router = Router();

router.use('/tickets', ticketsRouter);
router.use('/announcements', announcementsRouter);
router.use('/messages', messagesRouter);
router.use('/knowledge-base', knowledgeBaseRouter);
router.use('/status', statusRouter);

export default router;

