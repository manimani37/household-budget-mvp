import { getActiveIngredients } from "@/lib/calculations";
import type { Ingredient } from "@/types/domain";

export type RecipeSuggestion = {
  title: string;
  subtitle: string;
  usedIngredients: string[];
  steps: string[];
};

type RecipeRule = {
  title: string;
  subtitle: string;
  keywords: string[];
  steps: (matched: string[]) => string[];
};

const rules: RecipeRule[] = [
  {
    title: "期限優先の具だくさん味噌汁",
    subtitle: "野菜や豆腐をまとめて使いやすい定番",
    keywords: ["豆腐", "ねぎ", "大根", "にんじん", "玉ねぎ", "きのこ", "白菜", "キャベツ"],
    steps: (matched) => [
      `${matched.join("、")}を食べやすい大きさに切る`,
      "だしで火を通し、最後に味噌を溶く",
      "余りそうな葉物は仕上げに入れて食感を残す",
    ],
  },
  {
    title: "冷蔵庫整理のさっと炒め",
    subtitle: "期限が近い食材を主役にできる一皿",
    keywords: ["豚", "鶏", "牛", "キャベツ", "ピーマン", "玉ねぎ", "もやし", "なす", "卵"],
    steps: (matched) => [
      `${matched.join("、")}を油で炒める`,
      "塩こしょう、醤油、みりんで軽く味付けする",
      "卵があれば最後に絡めてボリュームを出す",
    ],
  },
  {
    title: "使い切り卵とじ丼",
    subtitle: "ごはんにのせれば少量の食材でも満足感あり",
    keywords: ["卵", "玉ねぎ", "鶏", "ねぎ", "きのこ", "ほうれん草", "小松菜"],
    steps: (matched) => [
      `${matched.join("、")}をめんつゆか醤油だれで煮る`,
      "溶き卵を回し入れて半熟で火を止める",
      "ごはんにのせ、あれば刻みねぎを足す",
    ],
  },
  {
    title: "期限近め食材のスープ",
    subtitle: "迷ったら煮込んで朝食や作り置きに",
    keywords: ["トマト", "玉ねぎ", "にんじん", "じゃがいも", "キャベツ", "ベーコン", "ウインナー"],
    steps: (matched) => [
      `${matched.join("、")}を角切りにする`,
      "水とコンソメでやわらかくなるまで煮る",
      "塩で整え、余ったごはんやパスタを足してもよい",
    ],
  },
];

export function buildRecipeSuggestions(ingredients: Ingredient[]): RecipeSuggestion[] {
  const active = getActiveIngredients(ingredients);
  const ingredientNames = active.map((ingredient) => ingredient.name);

  const suggestions = rules
    .map((rule) => {
      const matched = ingredientNames.filter((name) =>
        rule.keywords.some((keyword) => name.includes(keyword)),
      );

      return {
        title: rule.title,
        subtitle: rule.subtitle,
        usedIngredients: matched.slice(0, 5),
        steps: rule.steps(matched.slice(0, 5)),
      };
    })
    .filter((recipe) => recipe.usedIngredients.length > 0);

  if (suggestions.length > 0) {
    return suggestions.slice(0, 3);
  }

  const fallback = active.slice(0, 3).map((ingredient) => ingredient.name);
  if (fallback.length === 0) {
    return [];
  }

  return [
    {
      title: "期限が近い食材の使い切りプレート",
      subtitle: "登録食材から自動で作る簡単案",
      usedIngredients: fallback,
      steps: [
        `${fallback.join("、")}を食べやすい大きさにする`,
        "火が通りにくいものから順に加熱する",
        "塩、醤油、ポン酢など家にある調味料でまとめる",
      ],
    },
  ];
}
