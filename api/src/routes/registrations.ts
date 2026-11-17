import { Router, IRouter, Request, Response } from 'express'
import { registerForSession, validateRegistrationInput } from '../services/registrationService'

// Mounted at /api/training-sessions/:id/registrations
const router: IRouter = Router({ mergeParams: true })

function parseId(value: string): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

router.post('/', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const sessionId = parseId(req.params.id)
    if (sessionId === null) {
      res.status(400).json({ error: 'Invalid session ID' })
      return
    }

    const errors = validateRegistrationInput(req.body)
    if (errors.length > 0) {
      res.status(400).json({ error: 'Invalid registration', details: errors })
      return
    }

    const result = await registerForSession(sessionId, req.body)
    switch (result.kind) {
      case 'session_not_found':
        res.status(404).json({ error: 'Training session not found' })
        return
      case 'duplicate':
        res.status(409).json({ error: 'This email is already registered for this session' })
        return
      case 'full':
        res.status(409).json({ error: 'Training session is full' })
        return
      case 'confirmed':
        res.status(201).json({ ...result.registration, session: result.session })
        return
    }
  } catch (error) {
    console.error('Error creating registration:', error)
    res.status(500).json({ error: 'Failed to create registration' })
  }
})

export default router
