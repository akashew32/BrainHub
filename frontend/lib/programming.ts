import { generatedProgrammingQuestions } from "@/lib/programming-question-bank";
import extendedQuestions from "@/lib/extended-programming-questions.json";

export type ProgrammingLanguage =
  "java" | "python" | "cpp" | "python-libraries" | "computer-architecture" | "sql";
export type ProgrammingTopic = "fundamentals" | "function-calls";
export type TriviaMode = "mixed" | ProgrammingTopic;

export type ProgrammingQuestion = {
  id: string;
  concept?: string;
  topic: ProgrammingTopic;
  prompt: string;
  code?: string;
  choices: [string, string, string, string];
  answer: number;
  explanation: string;
};

export type ProgrammingTrack = {
  slug: ProgrammingLanguage;
  name: string;
  badge: string;
  accent: string;
  description: string;
  focus: string;
  topicLabels: Record<ProgrammingTopic, string>;
  questions: ProgrammingQuestion[];
};

const extendedProgrammingQuestions = extendedQuestions as Record<
  "python-libraries" | "computer-architecture" | "sql",
  ProgrammingQuestion[]
>;

const javaQuestions: ProgrammingQuestion[] = [
  {
    id: "java-int-division",
    topic: "fundamentals",
    prompt: "What value is assigned to result?",
    code: "int result = 7 / 2;",
    choices: ["3", "3.5", "4", "Compilation error"],
    answer: 0,
    explanation:
      "Both operands are integers, so Java performs integer division and truncates the fractional part.",
  },
  {
    id: "java-string-equality",
    topic: "fundamentals",
    prompt: "Which expression compares the contents of two Java strings?",
    choices: ["a == b", "a.equals(b)", "a := b", "compare(a, b)"],
    answer: 1,
    explanation:
      "equals compares String contents. The == operator compares whether two references point to the same object.",
  },
  {
    id: "java-final-variable",
    topic: "fundamentals",
    prompt: "What does final mean for a local variable?",
    choices: [
      "Its value cannot be reassigned after initialization",
      "It is visible to every class",
      "It is allocated on the heap",
      "It can only hold primitive values",
    ],
    answer: 0,
    explanation:
      "A final local variable may be assigned once. For object references, the object may still be mutable.",
  },
  {
    id: "java-extends-implements",
    topic: "fundamentals",
    prompt: "How does a class inherit from a class and satisfy an interface?",
    code: "class Trader _____ BaseTrader _____ Comparable<Trader>",
    choices: ["implements / extends", "extends / implements", "inherits / conforms", "extends / extends"],
    answer: 1,
    explanation: "Java uses extends for class inheritance and implements for interface contracts.",
  },
  {
    id: "java-checked-exception",
    topic: "fundamentals",
    prompt: "What must a method do with a checked exception it may produce?",
    choices: [
      "Ignore it",
      "Catch it or declare it with throws",
      "Convert it to an Error",
      "Return it as a value",
    ],
    answer: 1,
    explanation:
      "Checked exceptions are enforced by the compiler and must be caught or declared in the method signature.",
  },
  {
    id: "java-substring",
    topic: "function-calls",
    prompt: "What does this call return?",
    code: '"brainhub".substring(5)',
    choices: ['"brain"', '"hub"', '"ainhub"', '"ub"'],
    answer: 1,
    explanation: "substring uses a zero-based inclusive start index. Index 5 is the h in brainhub.",
  },
  {
    id: "java-list-of",
    topic: "function-calls",
    prompt: "What happens when this code runs?",
    code: "var values = List.of(1, 2, 3);\nvalues.add(4);",
    choices: [
      "The list becomes [1, 2, 3, 4]",
      "add returns false",
      "An UnsupportedOperationException is thrown",
      "The code fails to compile",
    ],
    answer: 2,
    explanation:
      "List.of creates an unmodifiable list. Mutating calls such as add throw UnsupportedOperationException.",
  },
  {
    id: "java-get-default",
    topic: "function-calls",
    prompt: 'What is returned when prices does not contain "ABC"?',
    code: 'prices.getOrDefault("ABC", 0.0)',
    choices: ["null", "0.0", "NaN", "A NoSuchElementException"],
    answer: 1,
    explanation: "Map.getOrDefault returns the supplied fallback when the key has no mapping.",
  },
  {
    id: "java-stream-count",
    topic: "function-calls",
    prompt: "What value does count hold?",
    code: "long count = List.of(1, 2, 3, 4)\n    .stream()\n    .filter(x -> x % 2 == 0)\n    .count();",
    choices: ["1", "2", "4", "The stream itself"],
    answer: 1,
    explanation: "The filter keeps 2 and 4, and count returns the number of retained elements as a long.",
  },
  {
    id: "java-string-join",
    topic: "function-calls",
    prompt: "What does this expression return?",
    code: 'String.join("-", "bid", "ask", "mid")',
    choices: ['"bidaskmid"', '"bid-ask-mid"', '"-bid-ask-mid-"', "[bid, ask, mid]"],
    answer: 1,
    explanation: "String.join inserts the delimiter between elements without adding it at either end.",
  },
];

const pythonQuestions: ProgrammingQuestion[] = [
  {
    id: "python-floor-division",
    topic: "fundamentals",
    prompt: "What is the value of result?",
    code: "result = -7 // 3",
    choices: ["-2", "-2.33", "-3", "3"],
    answer: 2,
    explanation: "Python floor division rounds toward negative infinity, so -7 // 3 is -3 rather than -2.",
  },
  {
    id: "python-tuple",
    topic: "fundamentals",
    prompt: "Which statement about tuples is correct?",
    choices: [
      "Tuples are immutable sequences",
      "Tuples can contain only numbers",
      "Tuples are unordered",
      "Tuples cannot be dictionary keys",
    ],
    answer: 0,
    explanation:
      "Tuples are ordered immutable sequences. A tuple is hashable when all of its elements are hashable.",
  },
  {
    id: "python-is-equals",
    topic: "fundamentals",
    prompt: "What is the difference between is and ==?",
    choices: [
      "There is no difference",
      "is checks identity; == checks value equality",
      "is checks type; == checks identity",
      "is is valid only for numbers",
    ],
    answer: 1,
    explanation: "Use is for object identity—especially comparisons with None—and == for value equality.",
  },
  {
    id: "python-comprehension",
    topic: "fundamentals",
    prompt: "What list is produced?",
    code: "[n * n for n in range(4) if n % 2]",
    choices: ["[0, 4]", "[1, 9]", "[0, 1, 4, 9]", "[1, 3]"],
    answer: 1,
    explanation: "The condition keeps odd values 1 and 3, and the expression squares them.",
  },
  {
    id: "python-dict-order",
    topic: "fundamentals",
    prompt: "What ordering guarantee do normal dictionaries provide in modern Python?",
    choices: [
      "Keys are sorted alphabetically",
      "Insertion order is preserved",
      "Keys are ordered by hash value",
      "No ordering is defined",
    ],
    answer: 1,
    explanation: "Insertion order has been a language guarantee for dict objects since Python 3.7.",
  },
  {
    id: "python-dict-get",
    topic: "function-calls",
    prompt: 'What does this expression return when "qty" is absent?',
    code: 'order.get("qty", 0)',
    choices: ["None", "0", "KeyError", "False"],
    answer: 1,
    explanation: "dict.get returns the provided default instead of raising KeyError for a missing key.",
  },
  {
    id: "python-string-chain",
    topic: "function-calls",
    prompt: "What does this chained call return?",
    code: '"quant".replace("a", "o").upper()',
    choices: ["QUANT", "QUONT", "quant", "Quont"],
    answer: 1,
    explanation: "replace first produces quont, and upper then returns QUONT.",
  },
  {
    id: "python-sorted-key",
    topic: "function-calls",
    prompt: "What list is returned?",
    code: 'sorted(["bbb", "a", "cc"], key=len)',
    choices: ['["a", "cc", "bbb"]', '["bbb", "cc", "a"]', '["a", "bbb", "cc"]', "[1, 2, 3]"],
    answer: 0,
    explanation:
      "The key function supplies each string's length, so sorted orders the strings from shortest to longest.",
  },
  {
    id: "python-zip",
    topic: "function-calls",
    prompt: "What does this expression produce?",
    code: 'list(zip([1, 2], ["a", "b"]))',
    choices: ['[(1, "a"), (2, "b")]', '[[1, 2], ["a", "b"]]', '{1: "a", 2: "b"}', '[(1, 2), ("a", "b")]'],
    answer: 0,
    explanation: "zip pairs items at matching positions; list materializes the iterator as two tuples.",
  },
  {
    id: "python-range",
    topic: "function-calls",
    prompt: "What list is produced?",
    code: "list(range(2, 9, 3))",
    choices: ["[2, 5, 8]", "[2, 5]", "[2, 3, 4, 5, 6, 7, 8]", "[3, 6, 9]"],
    answer: 0,
    explanation: "range starts at 2, advances by 3, and stops before the exclusive upper bound 9.",
  },
];

const cppQuestions: ProgrammingQuestion[] = [
  {
    id: "cpp-raii",
    topic: "fundamentals",
    prompt: "What does RAII tie to an object's lifetime?",
    choices: [
      "Resource acquisition and release",
      "Only heap allocation",
      "Run-time type information",
      "Template specialization",
    ],
    answer: 0,
    explanation: "RAII acquires a resource during object construction and releases it in the destructor.",
  },
  {
    id: "cpp-reference",
    topic: "fundamentals",
    prompt: "Which statement about a non-const lvalue reference is correct?",
    choices: [
      "It may be null",
      "It must bind to an object and cannot later be reseated",
      "It always owns its object",
      "It creates a copy of the object",
    ],
    answer: 1,
    explanation: "A reference aliases an existing object and cannot be reseated after initialization.",
  },
  {
    id: "cpp-const-method",
    topic: "fundamentals",
    prompt: "What does const after a member-function declaration mean?",
    code: "double price() const;",
    choices: [
      "The function returns a constant",
      "The function cannot modify ordinary data members through this",
      "The function is evaluated at compile time",
      "The function cannot be overridden",
    ],
    answer: 1,
    explanation:
      "A const member function treats this as a pointer to const and cannot mutate non-mutable members.",
  },
  {
    id: "cpp-vector",
    topic: "fundamentals",
    prompt: "Which property describes std::vector?",
    choices: [
      "Fixed-size linked storage",
      "Dynamic contiguous storage",
      "Sorted unique values",
      "Key-value storage",
    ],
    answer: 1,
    explanation: "std::vector is a dynamically sized sequence whose elements are stored contiguously.",
  },
  {
    id: "cpp-virtual-destructor",
    topic: "fundamentals",
    prompt: "Why should a polymorphic base class normally have a virtual destructor?",
    choices: [
      "To make construction faster",
      "To ensure derived destructors run when deleting through a base pointer",
      "To prevent inheritance",
      "To make every method virtual",
    ],
    answer: 1,
    explanation:
      "Deleting a derived object through a base pointer requires a virtual base destructor for complete cleanup.",
  },
  {
    id: "cpp-accumulate",
    topic: "function-calls",
    prompt: "What value does total receive?",
    code: "std::vector<int> v{1, 2, 3};\nint total = std::accumulate(v.begin(), v.end(), 0);",
    choices: ["0", "3", "6", "Compilation error"],
    answer: 2,
    explanation: "std::accumulate starts with 0 and adds every element in the half-open iterator range.",
  },
  {
    id: "cpp-sort",
    topic: "function-calls",
    prompt: "What does this call do?",
    code: "std::sort(values.begin(), values.end());",
    choices: [
      "Returns a sorted copy",
      "Sorts values in place in ascending order",
      "Sorts only the first and last values",
      "Removes duplicate values",
    ],
    answer: 1,
    explanation:
      "std::sort rearranges the supplied random-access range in place using ascending order by default.",
  },
  {
    id: "cpp-emplace",
    topic: "function-calls",
    prompt: "What is the main purpose of emplace_back?",
    choices: [
      "Construct an element directly at the end of a container",
      "Remove the last element",
      "Reserve capacity without constructing",
      "Insert an element at the front",
    ],
    answer: 0,
    explanation:
      "emplace_back forwards constructor arguments and constructs the new element at the container's end.",
  },
  {
    id: "cpp-find",
    topic: "function-calls",
    prompt: "What does std::find return when the value is absent?",
    code: "auto it = std::find(v.begin(), v.end(), target);",
    choices: ["nullptr", "v.begin()", "v.end()", "-1"],
    answer: 2,
    explanation: "Standard iterator algorithms use the end iterator as the not-found sentinel.",
  },
  {
    id: "cpp-move",
    topic: "function-calls",
    prompt: "What does std::move do by itself?",
    choices: [
      "Physically relocates an object immediately",
      "Casts its argument to an xvalue so move operations may be selected",
      "Deletes the source object",
      "Copies the object to the heap",
    ],
    answer: 1,
    explanation:
      "std::move is a cast. A later constructor or assignment may use that xvalue to transfer resources.",
  },
];

export const programmingTracks: ProgrammingTrack[] = [
  {
    slug: "java",
    name: "Java",
    badge: "JAVA",
    accent: "#f97316",
    description: "Types, object semantics, collections, streams, and standard method calls.",
    focus: "Strong typing · collections · object behavior",
    topicLabels: { fundamentals: "Fundamentals", "function-calls": "Function calls" },
    questions: [...javaQuestions, ...generatedProgrammingQuestions.java],
  },
  {
    slug: "python",
    name: "Python",
    badge: "PY",
    accent: "#facc15",
    description: "Core language behavior, built-ins, containers, iteration, and string operations.",
    focus: "Language fundamentals · built-in functions",
    topicLabels: { fundamentals: "Fundamentals", "function-calls": "Function calls" },
    questions: [...pythonQuestions, ...generatedProgrammingQuestions.python],
  },
  {
    slug: "cpp",
    name: "C++",
    badge: "C++",
    accent: "#60a5fa",
    description: "Value semantics, memory safety, STL containers, iterators, and algorithms.",
    focus: "Modern C++ · standard library",
    topicLabels: { fundamentals: "Fundamentals", "function-calls": "Function calls" },
    questions: [...cppQuestions, ...generatedProgrammingQuestions.cpp],
  },
  {
    slug: "python-libraries",
    name: "Python Libraries",
    badge: "PY LIBS",
    accent: "#a78bfa",
    description:
      "Important standard-library and ecosystem tools for data structures, files, dates, testing, databases, and async I/O.",
    focus: "Standard library · APIs · testing · I/O",
    topicLabels: { fundamentals: "Library concepts", "function-calls": "APIs and calls" },
    questions: extendedProgrammingQuestions["python-libraries"],
  },
  {
    slug: "computer-architecture",
    name: "Computer Architecture",
    badge: "ARCH",
    accent: "#22d3ee",
    description:
      "Instruction execution, caches, memory translation, concurrency hardware, and performance reasoning.",
    focus: "CPU · cache · memory · performance",
    topicLabels: { fundamentals: "Architecture", "function-calls": "Systems reasoning" },
    questions: extendedProgrammingQuestions["computer-architecture"],
  },
  {
    slug: "sql",
    name: "SQL",
    badge: "SQL",
    accent: "#34d399",
    description:
      "Relational design, transactions, indexes, joins, aggregation, window functions, and query behavior.",
    focus: "Relational model · queries · indexes",
    topicLabels: { fundamentals: "Database concepts", "function-calls": "Query behavior" },
    questions: extendedProgrammingQuestions.sql,
  },
];

export const programmingMap = Object.fromEntries(
  programmingTracks.map((track) => [track.slug, track]),
) as Record<ProgrammingLanguage, ProgrammingTrack>;

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const replacement = Math.floor(random() * (index + 1));
    [result[index], result[replacement]] = [result[replacement]!, result[index]!];
  }
  return result;
}

function selectDistinctConcepts(questions: ProgrammingQuestion[], count: number, random: () => number) {
  const groups = new Map<string, ProgrammingQuestion[]>();
  for (const question of questions) {
    const concept = question.concept ?? question.id;
    const group = groups.get(concept) ?? [];
    group.push(question);
    groups.set(concept, group);
  }

  const selected = shuffled([...groups.values()], random)
    .slice(0, count)
    .map((group) => shuffled(group, random)[0]!);

  return shuffled(selected, random);
}

export function selectProgrammingQuestions(
  track: ProgrammingTrack,
  mode: TriviaMode,
  random: () => number = Math.random,
) {
  if (mode !== "mixed") {
    return selectDistinctConcepts(
      track.questions.filter((question) => question.topic === mode),
      5,
      random,
    );
  }
  const fundamentals = selectDistinctConcepts(
    track.questions.filter((question) => question.topic === "fundamentals"),
    5,
    random,
  );
  const functionCalls = selectDistinctConcepts(
    track.questions.filter((question) => question.topic === "function-calls"),
    5,
    random,
  );
  return shuffled([...fundamentals, ...functionCalls], random);
}
