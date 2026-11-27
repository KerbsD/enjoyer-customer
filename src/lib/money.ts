// Work in integer centavos. Never round or mutate the API's decimal strings.
export function toCentavos(amount: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw new Error("Invalid PHP amount");
  const [pesos, fraction = ""] = amount.split(".");
  const value = Number(pesos) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value)) throw new Error("PHP amount is too large");
  return value;
}

export function fromCentavos(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Invalid centavo amount");
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}
