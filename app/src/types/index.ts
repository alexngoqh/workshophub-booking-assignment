export interface TrainingSession {
  id: number
  title: string
  description: string
  date: string
  capacity: number
  registered: number
  location: string
  deliveryMode: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface RegistrationInput {
  name: string
  email: string
}

export interface RegistrationResponse {
  id: number
  sessionId: number
  name: string
  email: string
  status: RegistrationStatus
  createdAt: string
  position?: number
  session: {
    id: number
    title: string
    registered: number
    capacity: number
    waitlisted: number
  }
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled'

export interface CancelResponse {
  status: 'cancelled'
  promotedRegistrationId: number | null
  session: RegistrationResponse['session']
}

export interface RegistrationStatusView {
  id: number
  sessionId: number
  status: RegistrationStatus
  position: number | null
}

export interface RegistrationListItem {
  id: number
  name: string
  email: string
  status: RegistrationStatus
  createdAt: string
}

export interface RegistrationRoster {
  confirmed: RegistrationListItem[]
  waitlisted: RegistrationListItem[]
}
