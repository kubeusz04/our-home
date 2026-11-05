export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(n);
