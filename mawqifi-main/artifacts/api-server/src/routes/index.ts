import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postsRouter from "./posts";
import chatsRouter from "./chats";
import messagesRouter from "./messages";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(postsRouter);
router.use(chatsRouter);
router.use(messagesRouter);
router.use(adminRouter);

export default router;
