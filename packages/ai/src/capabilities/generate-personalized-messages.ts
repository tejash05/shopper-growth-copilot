import { AiCapability, Channel, ProductCategory, type Persona } from '@scp/shared';
import type { Capability } from '../types.js';
import { personalizedMessagesOutput, type PersonalizedMessagesOutput } from '../schemas.js';
import type { GeneratePersonalizedMessagesInput, MessageCustomer } from '../inputs.js';

interface CategoryCopy {
  hook: string; // the product hook
  defaultOffer: string;
}

const CATEGORY_COPY: Record<ProductCategory, CategoryCopy> = {
  FASHION: { hook: 'your favourite summer styles are back', defaultOffer: 'STYLE15' },
  BEAUTY: { hook: 'your skincare & beauty favourites are waiting', defaultOffer: 'GLOW15' },
  SNEAKERS: { hook: 'fresh sneaker drops just landed', defaultOffer: 'KICKS15' },
  ACCESSORIES: { hook: 'new statement accessories just arrived', defaultOffer: 'EDIT15' },
};

function buildBody(
  customer: MessageCustomer,
  channel: Channel,
  discount: number,
  offerCode: string,
  brandName: string,
): { subject?: string; body: string } {
  const copy = CATEGORY_COPY[customer.favouriteCategory];
  const name = customer.firstName;

  switch (channel) {
    case Channel.SMS: {
      // Hard requirement: < 160 chars. Keep it tight.
      const body = `${name}, ${copy.hook} at ${brandName}. ${discount}% off with ${offerCode}. Shop now.`;
      return { body: body.length > 160 ? body.slice(0, 157) + '...' : body };
    }
    case Channel.WHATSAPP: {
      const body = `Hey ${name}! ${capitalize(copy.hook)} at ${brandName}. Enjoy ${discount}% off this weekend with code ${offerCode}. Tap to explore your edit 👉`;
      return { body };
    }
    case Channel.EMAIL: {
      const subject = `${name}, ${discount}% off your ${brandName} favourites`;
      const body = `Hi ${name},\n\n${capitalize(copy.hook)} — and we saved your spot. As a valued ${customer.city} shopper, here's ${discount}% off your next order with code ${offerCode}.\n\nExplore the latest arrivals curated for you.\n\nWith love,\nThe ${brandName} Team`;
      return { subject, body };
    }
    case Channel.RCS: {
      const body = `${name}, ${copy.hook} ✨\nGet ${discount}% off with ${offerCode}.\n[ Shop the edit ]  [ View lookbook ]`;
      return { body };
    }
    default:
      return { body: `${name}, ${copy.hook}.` };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const generatePersonalizedMessages: Capability<
  GeneratePersonalizedMessagesInput,
  PersonalizedMessagesOutput
> = {
  name: AiCapability.GENERATE_PERSONALIZED_MESSAGES,
  schemaHint: personalizedMessagesOutput.toString(),
  buildPrompt: (input) =>
    [
      `Generate a personalised marketing message for EACH customer for a retail brand (${input.brandName ?? 'the brand'}).`,
      `Channel: ${input.channel}. Goal: ${input.goal ?? 'drive repeat purchase'}.`,
      'Personalise by first name, city, favourite category and persona. Reference their actual interests.',
      'SMS must be under 160 characters. Email needs a subject. WhatsApp/RCS should be friendly with a clear CTA.',
      `Offer: ${input.discountPercent ?? 15}% off, code ${input.offerCode ?? 'auto per category'}.`,
      `Customers: ${JSON.stringify(input.customers.slice(0, 25))}`,
      'Return JSON: { messages: [{ customerId, channel, subject?, body }] }.',
    ].join('\n'),
  mock: (input) => {
    const discount = input.discountPercent ?? 15;
    const brandName = input.brandName ?? 'your brand';
    const messages = input.customers.map((c) => {
      const offerCode = input.offerCode ?? CATEGORY_COPY[c.favouriteCategory].defaultOffer;
      const { subject, body } = buildBody(c, input.channel, discount, offerCode, brandName);
      return { customerId: c.customerId, channel: input.channel, subject, body };
    });
    return {
      result: { messages },
      explanation: `Generated ${messages.length} personalised ${input.channel} messages keyed on first name + favourite category.`,
      confidence: 0.82,
    };
  },
};

/** Render a stored template for one customer (used at launch for the whole audience). */
export function renderTemplate(
  template: string,
  vars: {
    firstName: string;
    category: ProductCategory;
    offer: string;
    city: string;
    persona: Persona;
    brandName?: string;
  },
): string {
  const brandName = vars.brandName ?? 'your brand';
  return template
    .replace(/\{\{\s*firstName\s*\}\}/g, vars.firstName)
    .replace(/\{\{\s*category\s*\}\}/g, vars.category.toLowerCase())
    .replace(/\{\{\s*offer\s*\}\}/g, vars.offer)
    .replace(/\{\{\s*city\s*\}\}/g, vars.city)
    .replace(/\{\{\s*persona\s*\}\}/g, vars.persona)
    .replace(/\{\{\s*brandName\s*\}\}/g, brandName);
}
