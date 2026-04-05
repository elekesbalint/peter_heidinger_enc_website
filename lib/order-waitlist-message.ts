/** Szöveg + link a rendelés oldali „nincs szabad készülék” várólista-üzenethez. */

export type OrderWaitlistMessageSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string; bold?: boolean };

export const ORDER_WAITLIST_MESSAGE_SEGMENTS: OrderWaitlistMessageSegment[] = [
  {
    type: "text",
    text: "Jelenleg nincs elérhető készülékünk az általad választott kategóriából. Ha 2 héten belül utaznál, bérelj ENC-t az ",
  },
  { type: "link", text: "ENCbérbeadás.hu", href: "https://encberbeadas.hu", bold: true },
  {
    type: "text",
    text: "-n. Ha utazásod későbbi időpontban történik, abban az esetben keresni fogunk, amint érkeznek szabad készülékeink.",
  },
];

export function orderWaitlistMessagePlain(): string {
  return ORDER_WAITLIST_MESSAGE_SEGMENTS.map((s) => s.text).join("");
}
