export interface TrainingSession {
  id: number
  title: string
  description: string
  date: string
  capacity: number
  registered: number
  waitlisted: number
  /** ISO date-time; null when registration never closes. */
  registrationDeadline: string | null
  location: string
  deliveryMode: string
  status: string
  createdAt: string
  updatedAt: string
}
