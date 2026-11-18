export const peso = (amount: string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount));

export const shopTime = (instant: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));

export const shopClock = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours < 12 ? "am" : "pm";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
};
