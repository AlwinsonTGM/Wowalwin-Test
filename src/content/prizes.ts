/**
 * The Kahon, as typed data. Every item here is a PLACEHOLDER until a Presenter
 * replaces it with something they actually have in their hands — the spec is
 * blunt about why: every item must be physically present and genuinely
 * redeemable, because a Player can win any of them. See `placeholder`.
 */

export type Prize = {
  readonly id: string;
  /** What the Stage reads out, exactly as the Presenter will say it. */
  readonly label: string;
  /** The redeemable value in pesos. Stand-ins until the real item is chosen. */
  readonly value: number;
  /** Always true here, and loud on the Stage: nobody presents a voucher they
   *  do not have. A Presenter who swaps the strings deletes this flag, and the
   *  Stage stops printing the warning. */
  readonly placeholder: boolean;
};

export const Pera = {
  id: 'pera',
  label: 'Pera — voucher',
  value: 50,
  placeholder: true,
} as const satisfies Prize;

/** Bokya is the losing outcome of the Kahon (the glossary is explicit about
 *  what to call it). It is in the table, not beside it, so the draw can reach
 *  it — and it carries no value, because nothing was won. */
export const Bokya = {
  id: 'bokya',
  label: 'Bokya',
  value: 0,
  placeholder: false,
} as const satisfies Prize;

/**
 * What the Kahon draws from. Ordered from the smallest thing in the box to the
 * largest, so a Presenter can read the drama off the order: `value` is what
 * makes a reveal land, and a table of equal prizes makes a reveal flat.
 */
export const kahonPrizes: readonly Prize[] = [
  { id: 'kahon-1', label: 'Isang libre para sa kape', value: 40, placeholder: true },
  { id: 'kahon-2', label: 'Isang libre para sa juice', value: 40, placeholder: true },
  { id: 'kahon-3', label: 'Sandwich at tubig', value: 80, placeholder: true },
  { id: 'kahon-4', label: 'Isang libre para sa merienda', value: 100, placeholder: true },
  { id: 'kahon-5', label: 'Isang balon ng soft drinks', value: 150, placeholder: true },
  { id: 'kahon-6', label: 'Isang libre para sa fast food', value: 200, placeholder: true },
  { id: 'kahon-7', label: 'Isang grocery hamper', value: 300, placeholder: true },
  { id: 'kahon-8', label: 'Dalawang libre para sa fast food', value: 400, placeholder: true },
];

/** Everything the Kahon can draw, Bokya included. */
export const kahonTable: readonly Prize[] = [...kahonPrizes, Bokya];

/**
 * True while any part of the prize table is still a stand-in. The finale
 * (ticket 05) reads this to say so on the Stage before the box is opened,
 * rather than letting a room watch someone announce a sandwich they went out
 * and bought.
 */
export const hasPlaceholderPrizes = (): boolean =>
  Pera.placeholder || kahonTable.some((prize) => prize.placeholder);

export const findPrize = (id: string): Prize | undefined => kahonTable.find((prize) => prize.id === id);

export const peso = (value: number): string => `₱${value}`;