import type { IngredientDictionaryItem, StorageLocation } from "@/types/domain";

export type IngredientRecognition = {
  originalName: string;
  normalizedName: string;
  canonicalName: string;
  category: string;
  dictionaryId: string | null;
  storageType: StorageLocation;
  defaultExpiryDays: number | null;
  recipeCategories: string[];
  tags: string[];
  compatibleIngredients: string[];
  groupId: string | null;
  isUnclassified: boolean;
};

const base = (
  id: string,
  displayName: string,
  aliases: string[],
  category: string,
  storageType: StorageLocation,
  defaultExpiryDays: number,
  recipeCategories: string[],
  tags: string[],
  compatibleIngredients: string[],
  groupId = id,
): IngredientDictionaryItem => ({
  id,
  displayName,
  aliases,
  category,
  storageType,
  defaultExpiryDays,
  recipeCategories,
  tags,
  compatibleIngredients,
  groupId,
});

export const initialIngredientDictionary: IngredientDictionaryItem[] = [
  base("egg", "卵", ["たまご", "玉子", "タマゴ", "egg", "eggs"], "卵・乳製品", "fridge", 14, ["卵料理", "朝食", "丼", "炒め物"], ["節約", "簡単", "たんぱく質"], ["ねぎ", "ご飯", "ベーコン", "ハム", "チーズ", "玉ねぎ", "トマト"]),
  base("negi", "ねぎ", ["ネギ", "青ねぎ", "白ねぎ", "長ねぎ", "長ネギ", "小ねぎ", "万能ねぎ", "葱", "green onion", "scallion"], "野菜", "vegetable_room", 7, ["和食", "炒め物", "スープ"], ["薬味", "節約", "香味野菜"], ["卵", "豆腐", "味噌", "豚肉", "鶏肉", "ご飯"]),
  base("onion", "玉ねぎ", ["玉葱", "たまねぎ", "タマネギ", "onion"], "野菜", "room", 21, ["炒め物", "スープ", "丼", "洋食"], ["常備", "節約"], ["卵", "豚肉", "鶏肉", "牛肉", "じゃがいも", "チーズ"]),
  base("cabbage", "キャベツ", ["きゃべつ", "cabbage"], "野菜", "vegetable_room", 7, ["炒め物", "サラダ", "スープ"], ["節約", "かさ増し"], ["豚肉", "もやし", "ベーコン", "卵", "味噌"]),
  base("carrot", "にんじん", ["人参", "ニンジン", "carrot"], "野菜", "vegetable_room", 14, ["炒め物", "スープ", "煮物"], ["常備", "彩り"], ["玉ねぎ", "じゃがいも", "鶏肉", "キャベツ"]),
  base("potato", "じゃがいも", ["じゃが芋", "ジャガイモ", "馬鈴薯", "potato"], "野菜", "room", 21, ["煮物", "洋食", "スープ"], ["常備", "節約"], ["玉ねぎ", "にんじん", "チーズ", "ベーコン", "鶏肉"]),
  base("bean-sprout", "もやし", ["モヤシ", "bean sprout", "bean sprouts"], "野菜", "fridge", 3, ["炒め物", "ナムル", "節約料理"], ["節約", "簡単", "かさ増し"], ["豚肉", "卵", "ねぎ", "キャベツ", "キムチ"]),
  base("tomato", "トマト", ["とまと", "ミニトマト", "プチトマト", "tomato"], "野菜", "vegetable_room", 7, ["サラダ", "洋食", "スープ", "朝食"], ["彩り", "簡単"], ["卵", "チーズ", "ベーコン", "玉ねぎ", "きゅうり"]),
  base("cucumber", "きゅうり", ["キュウリ", "胡瓜", "cucumber"], "野菜", "vegetable_room", 5, ["サラダ", "和え物", "副菜"], ["簡単", "さっぱり"], ["トマト", "ツナ", "マヨネーズ", "味噌"]),
  base("lettuce", "レタス", ["れたす", "lettuce"], "野菜", "vegetable_room", 5, ["サラダ", "朝食", "付け合わせ"], ["簡単"], ["トマト", "ハム", "チーズ", "食パン", "ツナ"]),
  base("hakusai", "白菜", ["はくさい", "ハクサイ", "napa cabbage"], "野菜", "vegetable_room", 10, ["鍋", "スープ", "煮物"], ["かさ増し", "節約"], ["豚肉", "鶏肉", "豆腐", "味噌", "ねぎ"]),
  base("komatsuna", "小松菜", ["こまつな", "コマツナ"], "野菜", "vegetable_room", 4, ["炒め物", "おひたし", "スープ"], ["緑黄色野菜", "簡単"], ["油揚げ", "卵", "豚肉", "味噌"]),
  base("spinach", "ほうれん草", ["ホウレン草", "ホウレンソウ", "菠菜", "spinach"], "野菜", "vegetable_room", 4, ["おひたし", "炒め物", "朝食"], ["緑黄色野菜"], ["卵", "ベーコン", "チーズ", "牛乳"]),
  base("eggplant", "なす", ["ナス", "茄子", "eggplant"], "野菜", "vegetable_room", 5, ["炒め物", "煮物", "和食"], ["夏野菜"], ["豚肉", "味噌", "トマト", "ひき肉"]),
  base("green-pepper", "ピーマン", ["ぴーまん", "green pepper"], "野菜", "vegetable_room", 7, ["炒め物", "副菜"], ["彩り", "簡単"], ["豚肉", "牛肉", "ひき肉", "玉ねぎ"]),
  base("mushroom", "きのこ", ["キノコ", "茸", "mushroom", "mushrooms", "エリンギ", "まいたけ", "舞茸"], "野菜", "fridge", 5, ["炒め物", "スープ", "和食"], ["低カロリー", "かさ増し"], ["卵", "ご飯", "鶏肉", "玉ねぎ", "味噌"], "mushroom"),
  base("shimeji", "しめじ", ["シメジ", "ぶなしめじ"], "野菜", "fridge", 5, ["炒め物", "スープ", "和食"], ["低カロリー"], ["卵", "ご飯", "鶏肉", "味噌"], "mushroom"),
  base("enoki", "えのき", ["エノキ", "えのきだけ", "榎"], "野菜", "fridge", 5, ["鍋", "スープ", "和食"], ["低カロリー", "節約"], ["豚肉", "豆腐", "ねぎ", "味噌"], "mushroom"),
  base("shiitake", "しいたけ", ["椎茸", "シイタケ", "shiitake"], "野菜", "fridge", 5, ["煮物", "炒め物", "和食"], ["うま味"], ["鶏肉", "ねぎ", "豆腐", "ご飯"], "mushroom"),
  base("pork", "豚肉", ["豚", "ぶた肉", "豚こま", "豚バラ", "豚ロース", "ポーク", "pork"], "肉・魚", "fridge", 3, ["炒め物", "丼", "和食", "節約料理"], ["たんぱく質", "節約"], ["キャベツ", "もやし", "玉ねぎ", "キムチ", "にんじん", "ねぎ"]),
  base("chicken", "鶏肉", ["鶏", "とり肉", "鳥肉", "鶏もも", "鶏むね", "ささみ", "チキン", "chicken"], "肉・魚", "fridge", 3, ["丼", "炒め物", "煮物", "洋食"], ["たんぱく質", "節約"], ["卵", "玉ねぎ", "ねぎ", "ご飯", "じゃがいも"]),
  base("beef", "牛肉", ["牛", "ぎゅう肉", "牛こま", "牛バラ", "ビーフ", "beef"], "肉・魚", "fridge", 3, ["炒め物", "丼", "洋食"], ["たんぱく質"], ["玉ねぎ", "ご飯", "じゃがいも", "ピーマン"]),
  base("ground-meat", "ひき肉", ["挽肉", "ミンチ", "合い挽き", "合挽き", "ground meat"], "肉・魚", "fridge", 2, ["炒め物", "丼", "カレー", "中華"], ["節約", "たんぱく質"], ["豆腐", "なす", "玉ねぎ", "ピーマン", "トマト"]),
  base("bacon", "ベーコン", ["bacon"], "肉・魚", "fridge", 7, ["朝食", "洋食", "スープ"], ["簡単", "うま味"], ["卵", "チーズ", "玉ねぎ", "キャベツ", "トマト"]),
  base("ham", "ハム", ["ロースハム", "ham"], "肉・魚", "fridge", 7, ["朝食", "サンドイッチ", "炒め物"], ["簡単"], ["卵", "チーズ", "レタス", "食パン", "きゅうり"]),
  base("sausage", "ウインナー", ["ウィンナー", "ソーセージ", "sausage"], "肉・魚", "fridge", 7, ["朝食", "炒め物", "スープ"], ["簡単"], ["卵", "キャベツ", "じゃがいも", "ケチャップ"]),
  base("tuna", "ツナ", ["ツナ缶", "シーチキン", "tuna"], "肉・魚", "room", 180, ["サラダ", "パスタ", "丼"], ["常備", "簡単", "たんぱく質"], ["きゅうり", "マヨネーズ", "ご飯", "パスタ", "レタス"]),
  base("salmon", "鮭", ["さけ", "サケ", "しゃけ", "シャケ", "salmon"], "肉・魚", "fridge", 3, ["和食", "焼き物", "ご飯"], ["たんぱく質"], ["ご飯", "味噌", "チーズ", "ほうれん草"]),
  base("mackerel", "サバ", ["鯖", "さば", "mackerel"], "肉・魚", "fridge", 3, ["和食", "煮物", "焼き物"], ["たんぱく質"], ["味噌", "ねぎ", "ご飯", "しょうが"]),
  base("shrimp", "エビ", ["えび", "海老", "shrimp"], "肉・魚", "fridge", 2, ["炒め物", "パスタ", "中華"], ["たんぱく質"], ["卵", "チーズ", "トマト", "パスタ"]),
  base("tofu", "豆腐", ["とうふ", "トウフ", "絹豆腐", "木綿豆腐", "tofu"], "大豆製品", "fridge", 4, ["和食", "スープ", "節約料理"], ["節約", "簡単", "たんぱく質"], ["ねぎ", "味噌", "キムチ", "ひき肉", "しょうが"]),
  base("natto", "納豆", ["なっとう", "ナットウ", "natto"], "大豆製品", "fridge", 7, ["朝食", "ご飯", "和食"], ["節約", "簡単", "たんぱく質"], ["ご飯", "卵", "ねぎ", "キムチ"]),
  base("aburaage", "油揚げ", ["あぶらあげ", "薄揚げ"], "大豆製品", "fridge", 5, ["味噌汁", "煮物", "和食"], ["節約"], ["小松菜", "味噌", "ねぎ", "うどん"]),
  base("cheese", "チーズ", ["スライスチーズ", "ピザ用チーズ", "cheese"], "卵・乳製品", "fridge", 14, ["朝食", "洋食", "焼き物"], ["簡単", "たんぱく質"], ["卵", "ベーコン", "ハム", "トマト", "じゃがいも"]),
  base("milk", "牛乳", ["ミルク", "milk"], "卵・乳製品", "fridge", 7, ["朝食", "スープ", "洋食"], ["たんぱく質"], ["ほうれん草", "チーズ", "卵", "パスタ"]),
  base("yogurt", "ヨーグルト", ["ヨーグルト", "yogurt", "yoghurt"], "卵・乳製品", "fridge", 10, ["朝食", "デザート"], ["簡単"], ["食パン", "牛乳"]),
  base("cooked-rice", "ご飯", ["ごはん", "御飯", "白米", "ライス", "rice", "cooked rice"], "主食", "room", 1, ["丼", "朝食", "炒め物", "和食"], ["主食", "節約"], ["卵", "ねぎ", "豚肉", "鶏肉", "納豆", "ツナ"], "rice"),
  base("rice", "米", ["お米", "こめ", "コメ", "白米", "rice"], "主食", "room", 180, ["ご飯", "丼", "和食"], ["主食", "常備"], ["卵", "ねぎ", "豚肉", "鶏肉", "納豆"], "rice"),
  base("pasta", "パスタ", ["スパゲティ", "スパゲッティ", "spaghetti", "pasta"], "主食", "room", 180, ["パスタ", "洋食", "簡単料理"], ["主食", "常備"], ["トマト", "ベーコン", "ツナ", "チーズ", "牛乳"]),
  base("udon", "うどん", ["饂飩", "udon"], "主食", "fridge", 5, ["麺", "和食", "簡単料理"], ["主食", "簡単"], ["ねぎ", "卵", "油揚げ", "めんつゆ"]),
  base("soba", "そば", ["蕎麦", "ソバ", "soba"], "主食", "fridge", 5, ["麺", "和食", "簡単料理"], ["主食", "簡単"], ["ねぎ", "卵", "めんつゆ"]),
  base("bread", "食パン", ["パン", "トースト", "bread"], "主食", "room", 4, ["朝食", "サンドイッチ"], ["主食", "簡単"], ["卵", "ハム", "チーズ", "レタス", "ヨーグルト"]),
  base("ramen", "ラーメン", ["中華麺", "らーめん", "ramen"], "主食", "room", 90, ["麺", "中華", "簡単料理"], ["主食", "簡単"], ["卵", "ねぎ", "豚肉", "もやし"]),
  base("kimchi", "キムチ", ["kimchi"], "加工食品", "fridge", 14, ["韓国風", "炒め物", "ご飯"], ["簡単", "発酵食品"], ["豚肉", "豆腐", "納豆", "もやし", "ご飯"]),
  base("curry-powder", "カレー粉", ["カレー", "カレーパウダー", "curry powder"], "調味料", "room", 180, ["カレー", "炒め物", "洋食"], ["常備"], ["玉ねぎ", "にんじん", "じゃがいも", "鶏肉", "豚肉"]),
  base("miso", "味噌", ["みそ", "ミソ", "miso"], "調味料", "opened_fridge", 60, ["味噌汁", "和食", "煮物"], ["常備"], ["ねぎ", "豆腐", "豚肉", "キャベツ", "サバ"]),
  base("soy-sauce", "醤油", ["しょうゆ", "しょう油", "正油", "soy sauce"], "調味料", "room", 180, ["和食", "炒め物", "丼"], ["常備"], ["卵", "ご飯", "ねぎ", "豚肉"]),
  base("mentsuyu", "めんつゆ", ["麺つゆ", "つゆ", "mentsuyu"], "調味料", "opened_fridge", 30, ["麺", "丼", "和食"], ["常備", "簡単"], ["うどん", "そば", "卵", "ねぎ"]),
  base("mayonnaise", "マヨネーズ", ["マヨ", "mayonnaise", "mayo"], "調味料", "opened_fridge", 60, ["サラダ", "和え物", "朝食"], ["常備", "簡単"], ["ツナ", "きゅうり", "卵", "食パン"]),
  base("ketchup", "ケチャップ", ["ketchup", "トマトケチャップ"], "調味料", "opened_fridge", 60, ["洋食", "炒め物", "朝食"], ["常備", "簡単"], ["卵", "ウインナー", "食パン", "チーズ"]),
  base("ginger", "しょうが", ["生姜", "ショウガ", "ginger"], "調味料", "vegetable_room", 14, ["和食", "炒め物", "薬味"], ["香味野菜"], ["豆腐", "豚肉", "サバ", "ねぎ"]),
];

export function mergeIngredientDictionaries(
  userDictionary: IngredientDictionaryItem[] = [],
): IngredientDictionaryItem[] {
  const result = [...initialIngredientDictionary];

  userDictionary.forEach((item) => {
    const normalizedId = item.id || `user-${normalizeIngredientName(item.displayName)}`;
    const next = {
      ...item,
      id: normalizedId,
      isUserDefined: true,
      groupId: item.groupId || normalizedId,
    };
    const existingIndex = result.findIndex(
      (current) =>
        current.id === next.id ||
        normalizeIngredientName(current.displayName) === normalizeIngredientName(next.displayName),
    );

    if (existingIndex >= 0) {
      result[existingIndex] = {
        ...result[existingIndex],
        ...next,
        aliases: unique([...result[existingIndex].aliases, ...next.aliases]),
        compatibleIngredients: unique([
          ...result[existingIndex].compatibleIngredients,
          ...next.compatibleIngredients,
        ]),
        recipeCategories: unique([
          ...result[existingIndex].recipeCategories,
          ...next.recipeCategories,
        ]),
        tags: unique([...result[existingIndex].tags, ...next.tags]),
      };
      return;
    }

    result.push(next);
  });

  return result;
}

export function normalizeIngredientName(value: string): string {
  return toHiragana(value.normalize("NFKC").toLowerCase())
    .replace(/[ \t\r\n　・･,、。.\-_/／\\()[\]（）「」『』【】]/g, "")
    .trim();
}

export function findIngredientByName(
  name: string,
  dictionary: IngredientDictionaryItem[] = initialIngredientDictionary,
): IngredientDictionaryItem | null {
  const normalizedName = normalizeIngredientName(name);
  const exact = dictionary.find((item) =>
    getSearchNames(item).some((candidate) => candidate === normalizedName),
  );
  if (exact) {
    return exact;
  }

  return (
    dictionary
      .flatMap((item) => getSearchNames(item).map((candidate) => ({ item, candidate })))
      .filter(({ candidate }) => candidate.length >= 2)
      .sort((a, b) => b.candidate.length - a.candidate.length)
      .find(
        ({ candidate }) => normalizedName.includes(candidate) || candidate.includes(normalizedName),
      )?.item ?? null
  );
}

export function getCanonicalIngredient(
  name: string,
  dictionary: IngredientDictionaryItem[] = initialIngredientDictionary,
): IngredientRecognition {
  const normalizedName = normalizeIngredientName(name);
  const item = findIngredientByName(name, dictionary);

  if (!item) {
    return {
      originalName: name,
      normalizedName,
      canonicalName: name.trim(),
      category: "未分類",
      dictionaryId: null,
      storageType: "fridge",
      defaultExpiryDays: null,
      recipeCategories: [],
      tags: ["未分類"],
      compatibleIngredients: [],
      groupId: null,
      isUnclassified: true,
    };
  }

  return {
    originalName: name,
    normalizedName,
    canonicalName: item.displayName,
    category: item.category,
    dictionaryId: item.id,
    storageType: item.storageType,
    defaultExpiryDays: item.defaultExpiryDays,
    recipeCategories: item.recipeCategories,
    tags: item.tags,
    compatibleIngredients: item.compatibleIngredients,
    groupId: item.groupId ?? item.id,
    isUnclassified: false,
  };
}

export function matchIngredients(
  a: string,
  b: string,
  dictionary: IngredientDictionaryItem[] = initialIngredientDictionary,
): boolean {
  const first = getCanonicalIngredient(a, dictionary);
  const second = getCanonicalIngredient(b, dictionary);

  if (first.dictionaryId && first.dictionaryId === second.dictionaryId) {
    return true;
  }
  if (first.groupId && first.groupId === second.groupId) {
    return true;
  }
  if (first.category !== "未分類" && first.category === second.category) {
    const firstName = normalizeIngredientName(first.canonicalName);
    const secondName = normalizeIngredientName(second.canonicalName);
    return firstName.includes(secondName) || secondName.includes(firstName);
  }

  const normalizedA = normalizeIngredientName(a);
  const normalizedB = normalizeIngredientName(b);
  return normalizedA.length >= 2 && normalizedB.length >= 2
    ? normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)
    : false;
}

export function areCompatibleIngredients(
  a: string,
  b: string,
  dictionary: IngredientDictionaryItem[] = initialIngredientDictionary,
): boolean {
  const first = getCanonicalIngredient(a, dictionary);
  const second = getCanonicalIngredient(b, dictionary);

  return (
    first.compatibleIngredients.some((name) => matchIngredients(name, second.canonicalName, dictionary)) ||
    second.compatibleIngredients.some((name) => matchIngredients(name, first.canonicalName, dictionary))
  );
}

export function getIngredientTags(
  name: string,
  dictionary: IngredientDictionaryItem[] = initialIngredientDictionary,
): string[] {
  return getCanonicalIngredient(name, dictionary).tags;
}

function getSearchNames(item: IngredientDictionaryItem): string[] {
  return [item.displayName, ...item.aliases].map(normalizeIngredientName);
}

function toHiragana(value: string): string {
  return value.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function unique(values: string[]): string[] {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}
