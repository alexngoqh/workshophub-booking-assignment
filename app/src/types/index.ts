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
  createdAt: string
  session: {
    id: number
    title: string
    registered: number
    capacity: number
  }
}
