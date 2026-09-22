export interface PluralRule {
  isMatch(word: string): boolean;
  apply(word: string): string;
}

export interface SingularRule {
  isMatch(word: string): boolean;
  apply(word: string): string;
}

class IrregularRule implements PluralRule, SingularRule {
  private irregulars: Record<string, string> = {
    child: "children",
    mouse: "mice",
    person: "people",
    man: "men",
  };

  isMatch(word: string): boolean {
    const lower = word.toLowerCase();

    return (
      lower in this.irregulars ||
      Object.values(this.irregulars).includes(lower)
    );
  }

  apply(word: string): string {
    const lower = word.toLowerCase();

    if (lower in this.irregulars) {
      return this.irregulars[lower];
    }

    const singular = Object.entries(this.irregulars).find(
      ([, plural]) => plural === lower,
    );

    return singular?.[0] ?? lower;
  }
}

class EndsWithYRule implements PluralRule, SingularRule {
  isMatch(word: string): boolean {
    const lower = word.toLowerCase();

    const vowels = ["a", "e", "i", "o", "u"];

    return (
      lower.endsWith("y") &&
      lower.length > 1 &&
      !vowels.includes(lower[lower.length - 2])
    );
  }

  apply(word: string): string {
    return word.toLowerCase().slice(0, -1) + "ies";
  }
}

class IesToYRule implements SingularRule {
  isMatch(word: string): boolean {
    return word.toLowerCase().endsWith("ies");
  }

  apply(word: string): string {
    return word.toLowerCase().slice(0, -3) + "y";
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

class EsToSingularRule implements SingularRule {
  private suffixes = ["s", "x", "z", "ch", "sh"];

  isMatch(word: string): boolean {
    const lower = word.toLowerCase();

    return (
      lower.endsWith("es") &&
      this.suffixes.some((suffix) => lower.slice(0, -2).endsWith(suffix))
    );
  }

  apply(word: string): string {
    return word.toLowerCase().slice(0, -2);
  }
}

class DefaultPluralRule implements PluralRule {
  isMatch(): boolean {
    return true;
  }

  apply(word: string): string {
    return word.toLowerCase() + "s";
  }
}

class DefaultSingularRule implements SingularRule {
  isMatch(word: string): boolean {
    return word.toLowerCase().endsWith("s");
  }

  apply(word: string): string {
    return word.toLowerCase().slice(0, -1);
  }
}

export class Grammar {
  private pluralRules: PluralRule[];
  private singularRules: SingularRule[];

  constructor(
    customPluralRules: PluralRule[] = [],
    customSingularRules: SingularRule[] = [],
  ) {
    this.pluralRules = [
      ...customPluralRules,
      new IrregularRule(),
      new EndsWithYRule(),
      new SpecialSuffixRule(),
      new DefaultPluralRule(),
    ];

    this.singularRules = [
      ...customSingularRules,
      new IrregularRule(),
      new IesToYRule(),
      new EsToSingularRule(),
      new DefaultSingularRule(),
    ];
  }

  public pluralize(word: string): string {
    const matchedRule = this.pluralRules.find((rule) => rule.isMatch(word));

    return matchedRule
      ? matchedRule.apply(word)
      : word.toLowerCase();
  }

  public singularize(word: string): string {
    const matchedRule = this.singularRules.find((rule) => rule.isMatch(word));

    return matchedRule
      ? matchedRule.apply(word)
      : word.toLowerCase();
  }
}
