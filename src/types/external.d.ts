declare module "dictionary-en" {
  const dictionary: {
    aff: Buffer;
    dic: Buffer;
  };
  export default dictionary;
}

declare module "nspell" {
  interface Dictionary {
    aff: Buffer;
    dic: Buffer;
  }

  interface Spell {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }

  export default function nspell(dictionary: Dictionary): Spell;
}
