import { FormEvent, useState } from 'react'
import { registerForSession, RegistrationResponse } from '../api'

interface Props {
  sessionId: number
  submitLabel: string
  onRegistered: (registration: RegistrationResponse) => void
  onCancel: () => void
}

function RegistrationForm({ sessionId, submitLabel, onRegistered, onCancel }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await registerForSession(sessionId, { name, email })
    setSubmitting(false)
    if (result.ok) {
      onRegistered(result.data)
    } else if (result.status === 422) {
      // The deadline passed while the form was open (LATC-7)
      setError('Registration for this session has closed')
    } else {
      setError(result.error)
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit} noValidate>
      <label className="registration-form__field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className="registration-form__field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      {error && (
        <p className="registration-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="registration-form__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Submitting…' : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          Back
        </button>
      </div>
    </form>
  )
}

export default RegistrationForm
