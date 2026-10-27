from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.challenges.catalog import CHALLENGES
from app.challenges.runner import run_challenge

MERGE_SOLUTIONS = {
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

DESIGN_SOLUTIONS = {
    "python": """class Solution:
    def solve(self, operations: list[str], arguments: list[list[int]]) -> list[int]:
        store = {}
        output = []
        for operation, args in zip(operations, arguments):
            key = args[0]
            if operation == "put":
                store[key] = args[1]
                output.append(-1)
            elif operation == "get":
                output.append(store.get(key, -1))
            elif operation == "exists":
                output.append(1 if key in store else 0)
            else:
                output.append(1 if store.pop(key, None) is not None else 0)
        return output
""",
    "java": """class Solution {
    public int[] solve(String[] operations, int[][] arguments) {
        Map<Integer, Integer> store = new HashMap<>();
        int[] output = new int[operations.length];
        for (int index = 0; index < operations.length; index++) {
            int key = arguments[index][0];
            switch (operations[index]) {
                case "put" -> {
                    store.put(key, arguments[index][1]);
                    output[index] = -1;
                }
                case "get" -> output[index] = store.getOrDefault(key, -1);
                case "exists" -> output[index] = store.containsKey(key) ? 1 : 0;
                default -> output[index] = store.remove(key) == null ? 0 : 1;
            }
        }
        return output;
    }
}
""",
    "cpp": """class Solution {
public:
    vector<int> solve(vector<string> operations, vector<vector<int>> arguments) {
        unordered_map<int, int> store;
        vector<int> output;
        for (size_t index = 0; index < operations.size(); ++index) {
            int key = arguments[index][0];
            if (operations[index] == "put") {
                store[key] = arguments[index][1];
                output.push_back(-1);
            } else if (operations[index] == "get") {
                output.push_back(store.count(key) ? store[key] : -1);
            } else if (operations[index] == "exists") {
                output.push_back(store.count(key) ? 1 : 0);
            } else {
                output.push_back(store.erase(key) ? 1 : 0);
            }
        }
        return output;
    }
};
""",
}


def main() -> None:
    scenarios = [
        ("merge-strings-alternately", MERGE_SOLUTIONS, True),
        ("lld-key-value-store", DESIGN_SOLUTIONS, False),
    ]
    for slug, solutions, expects_stdout in scenarios:
        challenge = CHALLENGES[slug]
        for language, source in solutions.items():
            result = run_challenge(challenge, language, source, "submit")
            if not result["complete"] or result["passed"] != 20:
                raise AssertionError(f"{slug} {language} runner failed: {result}")
            if expects_stdout and "merged" not in result["terminal"]:
                raise AssertionError(f"{language} stdout was not captured")
            print(f"{slug} {language}: 20/20 cases passed")


if __name__ == "__main__":
    main()
