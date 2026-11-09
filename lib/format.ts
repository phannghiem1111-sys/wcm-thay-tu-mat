export const formatVND = (n: number | bigint | null | undefined) =>
  n === null || n === undefined ? "" : `${Number(n).toLocaleString("vi-VN")} ₫`;
export const formatNumber = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toLocaleString("vi-VN"));
export const formatPct = (n: number) => `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
