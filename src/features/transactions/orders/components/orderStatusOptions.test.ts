import { describe, expect, it } from 'vitest';
import { ORDER_STATUS_OPTIONS } from './orderStatusOptions';

describe('order status options', () => {
  it('contains only the four order lifecycle statuses', () => {
    expect(ORDER_STATUS_OPTIONS.map(({ value }) => value)).toEqual([
      'UNPAID',
      'PAID',
      'CANCELLED',
      'COMPLETED',
    ]);
    expect(ORDER_STATUS_OPTIONS.map(({ value }) => value)).not.toContain('REFUNDED');
  });
});
