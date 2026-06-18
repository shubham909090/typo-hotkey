export function applyOriginalCase(original: string, suggestion: string): string {
  if (original.length === 0 || suggestion.length === 0) {
    return suggestion;
  }

  if (isAllUppercase(original)) {
    return suggestion.toLocaleUpperCase("en-US");
  }

  if (isCapitalized(original)) {
    return capitalize(suggestion);
  }

  return suggestion;
}

function isAllUppercase(value: string): boolean {
  const letters = value.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toLocaleUpperCase("en-US");
}

function isCapitalized(value: string): boolean {
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) {
    return false;
  }

  const first = letters.at(0) ?? "";
  const rest = letters.slice(1);
  return (
    first === first.toLocaleUpperCase("en-US") &&
    rest === rest.toLocaleLowerCase("en-US")
  );
}

function capitalize(value: string): string {
  const [first = "", ...rest] = Array.from(value.toLocaleLowerCase("en-US"));
  return `${first.toLocaleUpperCase("en-US")}${rest.join("")}`;
}
