import { Router, IRouter, Request, Response } from 'express'
import { getAllSessionsForAdmin } from '../services/trainingSessionService'

const router: IRouter = Router()

// TODO: restrict to authenticated users before going to production
router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    res.json(await getAllSessionsForAdmin())
  } catch {
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

export default router
