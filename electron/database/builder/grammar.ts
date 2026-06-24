export interface PluralRule {
  isMatch(word: string): boolean;
  apply(word: string): string;
}

class IrregularRule implements PluralRule {
  private irregulars: Record<string, string> = {
    child: "children",
    mouse: "mice",
    person: "people",
    man: "men",
  };

  isMatch(word: string): boolean {
    return word.toLowerCase() in this.irregulars;
  }

  apply(word: string): string {
    return this.irregulars[word.toLowerCase()];
  }
}

class EndsWithYRule implements PluralRule {
  isMatch(word: string): boolean {
    const lower = word.toLowerCase();
    const vowels = ["a", "e", "i", "o", "u"];
    return lower.endsWith("y") && !vowels.includes(lower[lower.length - 2]);
  }

  apply(word: string): string {
    return word.toLowerCase().slice(0, -1) + "ies";
  }
}

class SpecialSuffixRule implements PluralRule {
  private suffixes = ["s", "x", "z", "ch", "sh"];

  isMatch(word: string): boolean {
    const lower = word.toLowerCase();
    return this.suffixes.some((suffix) => lower.endsWith(suffix));
  }

  apply(word: string): string {
    return word.toLowerCase() + "es";
  }
}

class DefaultRule implements PluralRule {
  isMatch(): boolean {
    return true;
  }

  apply(word: string): string {
    return word.toLowerCase() + "s";
  }
}

export class Grammar {
  private rules: PluralRule[];

  constructor(customRules: PluralRule[] = []) {
    this.rules = [
      ...customRules,
      new IrregularRule(),
      new EndsWithYRule(),
      new SpecialSuffixRule(),
      new DefaultRule(),
    ];
  }

  public pluralize(word: string): string {
    const matchedRule = this.rules.find((rule) => rule.isMatch(word));
    return matchedRule ? matchedRule.apply(word) : word.toLowerCase();
  }
}
