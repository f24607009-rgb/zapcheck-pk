import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import billsRouter from "./bills";
import chatRouter from "./chat";
import tariffsRouter from "./tariffs";
import appliancesRouter from "./appliances";
import meterRouter from "./meter";

const router: IRouter = Router();
router.use(healthRouter);
router.use(authRouter);
router.use(billsRouter);
router.use(chatRouter);
router.use(tariffsRouter);
router.use(appliancesRouter);
router.use(meterRouter);
export default router;