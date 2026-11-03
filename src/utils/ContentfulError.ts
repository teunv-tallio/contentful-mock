export class ContentfulError extends Error {
  status: number
  statusText: string
  details: Record<string, unknown>

  constructor(
    status: number,
    statusText: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ContentfulError'
    this.status = status
    this.statusText = statusText
    this.details = details
    Object.setPrototypeOf(this, ContentfulError.prototype)
  }
}
