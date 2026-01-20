import {
  createParamDecorator,
  ExecutionContext,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { byteEncoder } from '@0xpolygonid/js-sdk';

// Custom decorator to extract raw payload as Uint8Array
// Supports: request.rawBody (Uint8Array) and string body (encoded to Uint8Array)
export const RawPayload = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Uint8Array => {
    const request = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();

    const payload: Uint8Array | null =
      request.rawBody ??
      (typeof request.body === 'string'
        ? byteEncoder.encode(request.body)
        : null);

    if (!payload) {
      throw new Error('Raw payload is missing in the request');
    }

    return payload;
  },
);
