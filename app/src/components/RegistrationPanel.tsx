import { useEffect, useState } from 'react'
import type { TrainingSession } from '../types'
import {
  cancelRegistration,
  getRegistration,
  RegistrationResponse,
  RegistrationStatus,
  SessionCounts,
} from '../api'
import {
  forgetMyRegistration,
  getMyRegistrationId,
  rememberMyRegistration,
} from '../myRegistrations'
import RegistrationForm from './RegistrationForm'

interface Props {
  session: TrainingSession
  onCountsChange: (counts: SessionCounts) => void
}

interface MyRegistration {
  id: number
  status: RegistrationStatus
  position: number | null
}

type Message = { kind: 'success' | 'error'; text: string } | null

function statusLabel(mine: MyRegistration) {
  if (mine.status === 'confirmed') return 'Confirmed'
  if (mine.status === 'waitlisted') return `Waitlisted (position ${mine.position})`
  return 'Cancelled'
}

/** Register / join waitlist / cancel actions for one session card. */
function RegistrationPanel({ session, onCountsChange }: Props) {
  const isFull = session.registered >= session.capacity
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [mine, setMine] = useState<MyRegistration | null>(null)
  const [busy, setBusy] = useState(false)

  // Load the status of a registration made earlier in this browser (survives reloads).
  useEffect(() => {
    const registrationId = getMyRegistrationId(session.id)
    if (registrationId === null) return
    let active = true
    getRegistration(session.id, registrationId).then((result) => {
      if (!active) return
      if (result.ok) {
        const { id, status, position } = result.data
        setMine({ id, status, position })
      } else if (result.status === 404) {
        forgetMyRegistration(session.id)
      }
    })
    return () => {
      active = false
    }
  }, [session.id])

  function handleRegistered(registration: RegistrationResponse) {
    setFormOpen(false)
    rememberMyRegistration(session.id, registration.id)
    setMine({
      id: registration.id,
      status: registration.status,
      position: registration.position ?? null,
    })
    setMessage({
      kind: 'success',
      text:
        registration.status === 'waitlisted'
          ? `You're on the waitlist (position ${registration.position}). Your place is not confirmed yet.`
          : `Registration confirmed for ${registration.name} (${registration.email}).`,
    })
    onCountsChange(registration.session)
  }

  async function handleCancel() {
    if (!mine) return
    const ok = window.confirm(
      `Are you sure you want to cancel your registration for ${session.title}?`
    )
    if (!ok) return
    setBusy(true)
    const result = await cancelRegistration(session.id, mine.id)
    setBusy(false)
    if (result.ok) {
      setMine({ ...mine, status: 'cancelled', position: null })
      setMessage({ kind: 'success', text: 'Your registration has been cancelled' })
      onCountsChange(result.data.session)
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  const isActive = mine !== null && mine.status !== 'cancelled'

  return (
    <div className="session-card__actions">
      {message && (
        <p
          className={
            message.kind === 'success' ? 'session-card__confirmation' : 'registration-form__error'
          }
          role={message.kind === 'success' ? 'status' : 'alert'}
        >
          {message.text}
        </p>
      )}

      {mine && (
        <p className="session-card__my-status">
          Your status: <strong>{statusLabel(mine)}</strong>
        </p>
      )}

      {isActive && (
        <button type="button" className="btn btn--danger" onClick={handleCancel} disabled={busy}>
          Cancel Registration
        </button>
      )}
      {mine?.status === 'cancelled' && (
        <button type="button" className="btn" disabled>
          Cancelled
        </button>
      )}

      {!isActive &&
        (formOpen ? (
          <RegistrationForm
            sessionId={session.id}
            submitLabel={isFull ? 'Join waitlist' : 'Confirm registration'}
            onRegistered={handleRegistered}
            onCancel={() => setFormOpen(false)}
          />
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setMessage(null)
              setFormOpen(true)
            }}
          >
            {isFull ? 'Join Waitlist' : 'Register'}
          </button>
        ))}
    </div>
  )
}

export default RegistrationPanel
