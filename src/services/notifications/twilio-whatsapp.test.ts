import { describe, expect, it } from 'vitest';
import {
  TWILIO_WHATSAPP_TEMPLATE_NAMES,
  normalizeWhatsAppAddress,
  parseTwilioContentSidMap,
} from './twilio-whatsapp';

describe('Twilio WhatsApp addressing', () => {
  it('normalizes E.164 numbers to Twilio WhatsApp addresses', () => {
    expect(normalizeWhatsAppAddress('+27656193535')).toBe('whatsapp:+27656193535');
    expect(normalizeWhatsAppAddress('whatsapp:+16627057391')).toBe(
      'whatsapp:+16627057391',
    );
  });

  it('keeps logical template names separate from Twilio Content names', () => {
    expect(TWILIO_WHATSAPP_TEMPLATE_NAMES.BOOKING_CONFIRMED).toBe(
      'dt_booking_confirmed',
    );
  });

  it('accepts only Twilio Content SIDs in the optional map', () => {
    expect(parseTwilioContentSidMap(undefined)).toEqual({});
    expect(
      parseTwilioContentSidMap(
        '{"BOOKING_CONFIRMED":"HXaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","SKIP":"not-a-sid"}',
      ),
    ).toEqual({
      BOOKING_CONFIRMED: 'HXaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(() => parseTwilioContentSidMap('[]')).toThrow(
      'invalid_template_configuration',
    );
  });
});
