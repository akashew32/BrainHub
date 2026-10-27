import catalog from "@/lib/challenge-catalog.json";

export type ChallengeLanguage = "python" | "java" | "cpp";
export type ChallengeDifficulty = "Easy" | "Medium" | "Hard" | "Design";
export type ChallengeCategory = "Algorithm" | "Low-Level Design";

export type ChallengeValue = string | number | boolean | ChallengeValue[];

export type ChallengeCase = {
  args: ChallengeValue[];
  expected: ChallengeValue;
};

export type CodingChallenge = {
  number: number | string;
  slug: string;
  title: string;
  difficulty: ChallengeDifficulty;
  category: ChallengeCategory;
  topics: string[];
  summary: string;
  constraints: string[];
  signature: {
    method: string;
    params: Array<{ name: string; type: string }>;
    returnType: string;
  };
  starterCode: Record<ChallengeLanguage, string>;
  caseCount: number;
  samples: ChallengeCase[];
  officialUrl: string | null;
};

export type ChallengeResult = {
  status: { id: number; description: string };
  terminal: string;
  results: Array<{
    index: number;
    passed: boolean;
    expected: string;
    actual: string;
  }>;
  passed: number;
  total: number;
  complete: boolean;
  time: string | null;
  memory: number | null;
  provider: string;
};

export const codingChallenges = catalog.problems as CodingChallenge[];
export const challengeMap = Object.fromEntries(
  codingChallenges.map((challenge) => [challenge.slug, challenge]),
) as Record<string, CodingChallenge>;

export const challengeCounts = {
  total: codingChallenges.length,
  algorithms: codingChallenges.filter((challenge) => challenge.category === "Algorithm").length,
  designs: codingChallenges.filter((challenge) => challenge.category === "Low-Level Design").length,
  easy: codingChallenges.filter((challenge) => challenge.difficulty === "Easy").length,
  medium: codingChallenges.filter((challenge) => challenge.difficulty === "Medium").length,
  hard: codingChallenges.filter((challenge) => challenge.difficulty === "Hard").length,
};
