export const DEVICE_CATEGORY_VALUES = ["ia", "i", "ii", "iii", "iv"] as const;

export type DeviceCategoryValue = (typeof DEVICE_CATEGORY_VALUES)[number];

export const DEVICE_CATEGORY_LABELS: Record<DeviceCategoryValue, string> = {
  ia: "IA",
  i: "I. kat.",
  ii: "II. kat.",
  iii: "III. kat.",
  iv: "IV. kat.",
};

export function isDeviceCategory(value: string): value is DeviceCategoryValue {
  return (DEVICE_CATEGORY_VALUES as readonly string[]).includes(value);
}

export function getDevicePriceHuf(): number {
  const raw = process.env.ENC_DEVICE_PRICE_HUF;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 499_000;
}
