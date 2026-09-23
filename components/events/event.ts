export type EventItem = {
  id: string
  date: string
  month: string
  title: string
  description?: string
  host?: string
  location: string
  format: 'Online' | 'In person'
  duration: string
  attendees: number
  capacity: number
  category?: string
  tone?: string
  tags: string[]
  startsAt?: string
}
