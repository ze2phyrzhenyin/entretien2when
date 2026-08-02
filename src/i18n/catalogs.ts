import enCore from "./messages/en/core.json";
import enLegacy from "./messages/en/legacy.json";
import zhCore from "./messages/zh-CN/core.json";
import zhLegacy from "./messages/zh-CN/legacy.json";
import type { AppLocale } from "./config";

export const catalogs = {
  "zh-CN": { ...zhCore, ...zhLegacy },
  en: { ...enCore, ...enLegacy }
} satisfies Record<AppLocale, Record<string, string>>;

export type MessageKey = keyof (typeof catalogs)["zh-CN"];

export function interpolateMessage(message: string, values: Record<string, string | number> = {}) {
  return message.replace(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder
  );
}

export function translateMessage(
  locale: AppLocale,
  key: MessageKey,
  values?: Record<string, string | number>
) {
  return interpolateMessage(catalogs[locale][key] ?? catalogs["zh-CN"][key], values);
}

export type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

export function createTranslator(locale: AppLocale): Translator {
  return (key, values) => translateMessage(locale, key, values);
}

export function selectPluralValue<T>(
  locale: AppLocale,
  count: number,
  forms: { one: T; other: T }
) {
  return new Intl.PluralRules(locale).select(count) === "one" ? forms.one : forms.other;
}

const knownSourceKeys = new Map<string, MessageKey>();

for (const [key, source] of Object.entries(catalogs["zh-CN"]) as Array<[MessageKey, string]>) {
  if (!knownSourceKeys.has(source)) knownSourceKeys.set(source, key);
}

const valuePlaceholderPattern = /\{(value\d+)\}/g;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type KnownSourceTemplate = {
  key: MessageKey;
  pattern: RegExp;
  placeholders: string[];
  staticLength: number;
};

const localizableTemplatePlaceholders: Partial<Record<MessageKey, ReadonlySet<string>>> = {
  "legacy.value0_must_be_a_number.00a4e8c7": new Set(["value0"]),
  "legacy.value0_must_be_an_integer.02803019": new Set(["value0"]),
  "legacy.value0_must_be_a_positive_integer.17b7c005": new Set(["value0"]),
  "legacy.invalid_format_value0_value1.9eb3822b": new Set(["value0"]),
  "legacy.value0_up_to_2000_characters.a8ff727a": new Set(["value0"]),
  "legacy.please_fill_in_value0.26b2ff9b": new Set(["value0"]),
  "legacy.fill_in_at_most_value0_value1_at_one_time.c6beabac": new Set(["value1"])
};

const contextualPlaceholderTranslations: Partial<
  Record<MessageKey, Partial<Record<string, Partial<Record<MessageKey, string>>>>>
> = {
  "legacy.invalid_format_value0_value1.9eb3822b": {
    value0: {
      "legacy.recipient.c237b665": "recipient",
      "legacy.cc.cac1f173": "CC",
      "legacy.blind_copy_bcc.74992ad8": "BCC"
    }
  },
  "legacy.fill_in_at_most_value0_value1_at_one_time.c6beabac": {
    value1: {
      "legacy.recipient.c237b665": "recipient",
      "legacy.cc.cac1f173": "CC",
      "legacy.blind_copy_bcc.74992ad8": "BCC"
    }
  }
};

const knownSourceTemplates = (Object.entries(catalogs["zh-CN"]) as Array<[MessageKey, string]>)
  .flatMap<KnownSourceTemplate>(([key, source]) => {
    const placeholders: string[] = [];
    let cursor = 0;
    let expression = "^";

    for (const match of source.matchAll(valuePlaceholderPattern)) {
      expression += escapeRegularExpression(source.slice(cursor, match.index));
      expression += "([\\s\\S]*?)";
      placeholders.push(match[1]!);
      cursor = (match.index ?? 0) + match[0].length;
    }

    if (placeholders.length === 0) return [];
    expression += `${escapeRegularExpression(source.slice(cursor))}$`;

    return [
      {
        key,
        pattern: new RegExp(expression, "u"),
        placeholders,
        staticLength: source.replace(valuePlaceholderPattern, "").length
      }
    ];
  })
  .sort((left, right) => right.staticLength - left.staticLength);

/**
 * Translates only a system-authored message that is already present in the
 * reviewed Chinese catalog. Unknown values, including database and user
 * content, are returned byte-for-byte unchanged.
 */
export function translateKnownSource(locale: AppLocale, source: string) {
  if (locale === "zh-CN") return source;

  const exactKey = knownSourceKeys.get(source);
  if (exactKey) return translateMessage(locale, exactKey);

  for (const template of knownSourceTemplates) {
    const match = template.pattern.exec(source);
    if (!match) continue;

    const values: Record<string, string> = {};
    template.placeholders.forEach((placeholder, index) => {
      const capturedValue = match[index + 1] ?? "";
      const capturedKey = localizableTemplatePlaceholders[template.key]?.has(placeholder)
        ? knownSourceKeys.get(capturedValue)
        : undefined;
      values[placeholder] = capturedKey
        ? (contextualPlaceholderTranslations[template.key]?.[placeholder]?.[capturedKey] ??
          translateMessage(locale, capturedKey))
        : capturedValue;
    });
    return translateMessage(locale, template.key, values);
  }

  return source;
}
