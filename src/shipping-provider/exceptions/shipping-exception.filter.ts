export class ShippingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidProviderException extends ShippingException {
  constructor(providerName: string, available: string[] = []) {
    const list = available.length ? ` Available: ${available.join(', ')}` : '';
    super(`Invalid shipping provider: "${providerName}".${list}`);
  }
}

export class CredentialsException extends ShippingException {
  constructor(providerName: string, required: string[]) {
    super(`${providerName} credentials must include: ${required.join(', ')}.`);
  }
}

export class CreateOrderException extends ShippingException {
  constructor(message: string) {
    super(`Create order failed: ${message}`);
  }
}

export class CreateOrderValidationException extends ShippingException {
  constructor(public readonly errors: Record<string, string[]>) {
    super(`Order validation failed: ${JSON.stringify(errors)}`);
  }
}

export class FunctionNotSupportedException extends ShippingException {
  constructor(fn: string, providerName: string) {
    super(`${fn}() is not supported by ${providerName}.`);
  }
}

export class NotImplementedException extends ShippingException {
  constructor(fn: string) {
    super(`${fn}() is not implemented yet.`);
  }
}

export class HttpShippingException extends ShippingException {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
  }
}

export class TrackingIdNotFoundException extends ShippingException {
  constructor(trackingId: string, providerName?: string) {
    const provider = providerName ? ` (${providerName})` : '';
    super(`Tracking ID not found: "${trackingId}"${provider}.`);
  }
}