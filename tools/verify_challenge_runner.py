from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.challenges.catalog import CHALLENGES
from app.challenges.runner import run_challenge

SOLUTIONS = {
    "python": """class Solution:
    def solve(self, word1: str, word2: str) -> str:
        result = []
        for index in range(max(len(word1), len(word2))):
            if index < len(word1):
                result.append(word1[index])
            if index < len(word2):
                result.append(word2[index])
        print(f"merged {len(word1)} + {len(word2)} characters")
        return "".join(result)
""",
    "java": """class Solution {
    public String solve(String word1, String word2) {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < Math.max(word1.length(), word2.length()); index++) {
            if (index < word1.length()) result.append(word1.charAt(index));
            if (index < word2.length()) result.append(word2.charAt(index));
        }
        System.out.println("merged " + word1.length() + " + " + word2.length() + " characters");
        return result.toString();
    }
}
""",
    "cpp": """class Solution {
public:
    string solve(string word1, string word2) {
        string result;
        for (size_t index = 0; index < max(word1.size(), word2.size()); ++index) {
            if (index < word1.size()) result += word1[index];
            if (index < word2.size()) result += word2[index];
        }
        cout << "merged " << word1.size() << " + " << word2.size() << " characters\\n";
        return result;
    }
};
""",
}


def main() -> None:
    challenge = CHALLENGES["merge-strings-alternately"]
    for language, source in SOLUTIONS.items():
        result = run_challenge(challenge, language, source, "submit")
        if not result["complete"] or result["passed"] != 20:
            raise AssertionError(f"{language} runner failed: {result}")
        if "merged" not in result["terminal"]:
            raise AssertionError(f"{language} stdout was not captured")
        print(f"{language}: 20/20 cases passed with stdout captured")


if __name__ == "__main__":
    main()
