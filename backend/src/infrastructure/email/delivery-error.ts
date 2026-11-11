export class EmailDeliveryError extends Error {
  constructor(public retryable: boolean) {
    // Provider bodies can contain addresses, message content, and credentials.
    super('EMAIL_DELIVERY_FAILED');
  }
}
