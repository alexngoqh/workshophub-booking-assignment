import { Router, IRouter, Request, Response } from 'express'
import {
  cancelRegistration,
  getRegistration,
  registerForSession,
  validateRegistrationInput,
} from '../services/registrationService'

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
      case 'waitlisted':
        res
          .status(202)
          .json({ ...result.registration, position: result.position, session: result.session })
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

type RegistrationParams = { id: string; registrationId: string }

function parseRegistrationParams(req: Request<RegistrationParams>, res: Response) {
  const sessionId = parseId(req.params.id)
  const registrationId = parseId(req.params.registrationId)
  if (sessionId === null || registrationId === null) {
    res.status(400).json({ error: 'Invalid session or registration ID' })
    return null
  }
  return { sessionId, registrationId }
}

router.get('/:registrationId', async (req: Request<RegistrationParams>, res: Response) => {
  try {
    const ids = parseRegistrationParams(req, res)
    if (!ids) return
    const registration = await getRegistration(ids.sessionId, ids.registrationId)
    if (!registration) {
      res.status(404).json({ error: 'Registration not found' })
      return
    }
    res.json(registration)
  } catch (error) {
    console.error('Error fetching registration:', error)
    res.status(500).json({ error: 'Failed to fetch registration' })
  }
})

router.delete('/:registrationId', async (req: Request<RegistrationParams>, res: Response) => {
  try {
    const ids = parseRegistrationParams(req, res)
    if (!ids) return
    const result = await cancelRegistration(ids.sessionId, ids.registrationId)
    switch (result.kind) {
      case 'not_found':
        res.status(404).json({ error: 'Registration not found' })
        return
      case 'already_cancelled':
        res.status(409).json({ error: 'Registration is already cancelled' })
        return
      case 'cancelled':
        res.json({
          ...result.registration,
          promotedRegistrationId: result.promotedRegistrationId,
          session: result.session,
        })
        return
    }
  } catch (error) {
    console.error('Error cancelling registration:', error)
    res.status(500).json({ error: 'Failed to cancel registration' })
  }
})

export default router
