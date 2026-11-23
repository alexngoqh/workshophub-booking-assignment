import { Router, IRouter, Request, Response } from 'express'
import {
  RegistrationInput,
  cancelRegistration,
  getRegistrationStatus,
  registerForSession,
  validateRegistrationInput,
} from '../services/registrationService'

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

    const result = await registerForSession(sessionId, req.body as RegistrationInput)

    switch (result.kind) {
      case 'session_not_found':
        res.status(404).json({ error: 'Training session not found' })
        return
      case 'confirmed':
        res.status(201).json({ ...result.registration, session: result.session })
        return
      case 'waitlisted':
        res
          .status(202)
          .json({ ...result.registration, position: result.position, session: result.session })
        return
    }
  } catch (error) {
    console.error('Error creating registration:', error)
    res.status(500).json({ error: 'Failed to create registration' })
  }
})

type RegistrationParams = { id: string; registrationId: string }

function parseIds(
  req: Request<RegistrationParams>,
  res: Response
): { sessionId: number; registrationId: number } | null {
  const sessionId = parseId(req.params.id)
  if (sessionId === null) {
    res.status(400).json({ error: 'Invalid session ID' })
    return null
  }
  const registrationId = parseId(req.params.registrationId)
  if (registrationId === null) {
    res.status(400).json({ error: 'Invalid registration ID' })
    return null
  }
  return { sessionId, registrationId }
}

router.delete('/:registrationId', async (req: Request<RegistrationParams>, res: Response) => {
  try {
    const ids = parseIds(req, res)
    if (ids === null) {
      return
    }

    const result = await cancelRegistration(ids.sessionId, ids.registrationId)

    switch (result.kind) {
      case 'not_found':
        res.status(404).json({ error: 'Registration not found' })
        return
      case 'already_cancelled':
        res.status(409).json({ error: 'Registration is already cancelled' })
        return
      case 'cancelled':
        res.status(200).json({ status: 'cancelled', session: result.session })
        return
    }
  } catch (error) {
    console.error('Error cancelling registration:', error)
    res.status(500).json({ error: 'Failed to cancel registration' })
  }
})

router.get('/:registrationId', async (req: Request<RegistrationParams>, res: Response) => {
  try {
    const ids = parseIds(req, res)
    if (ids === null) {
      return
    }

    const result = await getRegistrationStatus(ids.sessionId, ids.registrationId)

    switch (result.kind) {
      case 'not_found':
        res.status(404).json({ error: 'Registration not found' })
        return
      case 'found':
        res.status(200).json(result.view)
        return
    }
  } catch (error) {
    console.error('Error fetching registration:', error)
    res.status(500).json({ error: 'Failed to fetch registration' })
  }
})

export default router
