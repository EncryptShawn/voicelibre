//src/components/bottomBar/utils/memoryLabelUtils.ts
//
//For responder menu configuration options
//

export function getMemoryLabel(value: number, type: "short" | "long") {
  if (value === 0) return "Ignore";
  if (type === "short") {
    if (value <= 3) return "Pay attention";
    if (value <= 7) return "Really pay attention";
    return "Intense attention";
  } else {
    if (value <= 3) return "Remember some";
    if (value <= 7) return "Remember a lot";
    return "Remember too much";
  }
}

export function getExpirationLabel(value: number) {
  if (value <= 400) return `${value} min (a while)`;
  if (value <= 900) return `${value} min (long time)`;
  if (value < 1440) return `${value} min (most day)`;
  return `${value} min (all day)`;
}
