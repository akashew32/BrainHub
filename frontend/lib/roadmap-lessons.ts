import { learningRoadmaps, type LearningRoadmap, type RoadmapStage } from "@/lib/roadmaps";
import { slugifyTopic } from "@/lib/roadmap-utils";

export type LessonQuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
};

export type RoadmapLesson = {
  id: string;
  roadmapSlug: string;
  roadmapTitle: string;
  topicSlug: string;
  title: string;
  stageIndex: number;
  topicIndex: number;
  stageTitle: string;
  level: RoadmapStage["level"];
  accent: string;
  estimatedMinutes: number;
  summary: string;
  objectives: string[];
  sections: Array<{ heading: string; body: string }>;
  keyIdeas: Array<{ label: string; detail: string }>;
  workedExample: { prompt: string; steps: string[]; result: string };
  exercise: { prompt: string; hints: string[]; solution: string };
  quiz: LessonQuizQuestion[];
  prerequisiteIds: string[];
};

type DomainGuide = {
  foundation: string;
  firstMove: string;
  representation: string;
  operation: string;
  validation: string;
  failure: string;
  scenario: (topic: string, level: RoadmapStage["level"]) => string;
  exercise: (topic: string, level: RoadmapStage["level"]) => string;
};

const domainGuides: Record<string, DomainGuide> = {
  probability: {
    foundation:
      "Probability arguments are only as reliable as their sample space, information set, and dependence assumptions. Make each of those visible before calculating.",
    firstMove: "Declare the experiment, events, information, and assumptions before choosing a formula.",
    representation:
      "Represent uncertainty with events, random variables, distributions, or filtrations at the level the problem requires.",
    operation:
      "Condition, transform, or aggregate the model while preserving normalization and dependence structure.",
    validation:
      "Check that probabilities normalize, boundary cases behave correctly, and conditioning information is used consistently.",
    failure:
      "Applying a familiar distribution without checking its assumptions or confusing independence with disjointness.",
    scenario: (topic, level) =>
      `${level} probability model: use ${topic.toLowerCase()} to analyze a finite experiment first, then state what changes in a continuous or asymptotic version.`,
    exercise: (topic, level) =>
      `Construct a ${level.toLowerCase()}-level probability model with at least four outcomes in which ${topic.toLowerCase()} is essential. Compute one target quantity, then verify normalization and one edge case.`,
  },
  "linear-algebra": {
    foundation:
      "Linear algebra separates an abstract structure from its coordinates. Strong solutions identify the spaces and maps first, then use a matrix representation without confusing the matrix for the underlying object.",
    firstMove: "Name the vector spaces, dimensions, linear maps, and basis assumptions before computing.",
    representation:
      "Translate the objects into vectors, matrices, subspaces, or operators while tracking the chosen basis.",
    operation:
      "Use elimination, factorization, projection, or spectral structure to expose the invariant being studied.",
    validation:
      "Verify dimensions, rank-nullity, reconstruction error, and invariance under a change of coordinates.",
    failure:
      "Performing matrix arithmetic without checking dimensions, basis dependence, or whether the map is actually linear.",
    scenario: (topic, level) =>
      `${level} operator study: build a small matrix that exhibits ${topic.toLowerCase()}, compute the relevant structure, and interpret it geometrically.`,
    exercise: (topic, level) =>
      `Choose an explicit 3×3 matrix or linear map for a ${level.toLowerCase()}-level demonstration of ${topic.toLowerCase()}. Carry out the computation, identify the invariant, and verify the result with an independent criterion.`,
  },
  calculus: {
    foundation:
      "Calculus connects local change, accumulated change, and approximation. Every manipulation depends on a domain and regularity assumptions that should be stated rather than guessed.",
    firstMove: "Identify the domain, limiting process, and smoothness or integrability assumptions.",
    representation:
      "Express the question through a limit, derivative, integral, series, vector field, or differential equation.",
    operation:
      "Apply the appropriate local approximation or accumulation theorem and keep track of constants and orientation.",
    validation:
      "Check units, signs, endpoints, initial conditions, and the result against a numerical or geometric estimate.",
    failure:
      "Using a differentiation or integration rule outside its hypotheses or dropping boundary and initial data.",
    scenario: (topic, level) =>
      `${level} change model: apply ${topic.toLowerCase()} to a concrete function, explain the geometry, and compare the symbolic result with a numerical check.`,
    exercise: (topic, level) =>
      `At ${level.toLowerCase()} depth, use f(x)=x³−2x+1, or f(x,y)=x²+xy+y² when multivariable structure is needed, to demonstrate ${topic.toLowerCase()}. State the domain, compute the relevant quantity, and test a boundary case.`,
  },
  "real-analysis": {
    foundation:
      "Real analysis turns intuition about limits, continuity, size, and approximation into quantified statements. The order of quantifiers and the exact hypotheses carry the proof.",
    firstMove:
      "Write the governing definition with every quantifier and hypothesis before selecting a theorem.",
    representation:
      "Translate informal claims into inequalities, neighborhoods, sequences, measurable sets, or norm estimates.",
    operation:
      "Choose witnesses or bounds in the correct quantifier order and cite only the hypotheses a theorem needs.",
    validation:
      "Audit every quantifier, test endpoint and pathological cases, and search for a counterexample if a hypothesis is removed.",
    failure:
      "Arguing from a picture, swapping quantifiers, or invoking a theorem without verifying compactness, completeness, or measurability.",
    scenario: (topic, level) =>
      `${level} proof audit: formulate ${topic.toLowerCase()} from definitions, isolate the decisive hypothesis, and test the statement on both a standard example and a counterexample.`,
    exercise: (topic, level) =>
      `Write a ${level.toLowerCase()}-level, definition-first proof or counterexample involving ${topic.toLowerCase()}. Mark each quantifier, name the theorem used at every step, and explain which conclusion fails when one hypothesis is removed.`,
  },
  "discrete-math": {
    foundation:
      "Discrete mathematics studies finite or countable structures through exact definitions, invariants, and constructive arguments. Small examples are useful, but they must support a proof that scales.",
    firstMove: "Define the objects, admissible operations, and target property with precise finite notation.",
    representation:
      "Model the problem using sets, relations, graphs, recurrences, modular classes, or combinatorial configurations.",
    operation:
      "Count, construct, recurse, or preserve an invariant, choosing a method that matches the structure.",
    validation:
      "Check tiny and extremal cases, prove termination, and compare a constructive result with an independent bound.",
    failure:
      "Generalizing from examples without induction, double-counting configurations, or ignoring an algorithm's invariant.",
    scenario: (topic, level) =>
      `${level} finite-structure problem: use ${topic.toLowerCase()} on a six-element example, identify the invariant, and explain how the argument scales with input size.`,
    exercise: (topic, level) =>
      `Build a six-element set, graph, or sequence that makes ${topic.toLowerCase()} visible at ${level.toLowerCase()} depth. Compute or prove the target property, then test the smallest and largest meaningful cases.`,
  },
};

const levelGuides: Record<RoadmapStage["level"], string> = {
  Foundation: "Prioritize exact definitions, notation, and one transparent example before abstraction.",
  Core: "Connect the definition to a reusable theorem and execute a complete representative calculation.",
  Advanced: "Compare methods, expose hidden assumptions, and analyze failure modes or limiting behavior.",
  Graduate:
    "Work definition-first, prove the structural claim, and connect it to a broader theory or research tool.",
};

function makeQuizQuestion(
  id: string,
  prompt: string,
  correct: string,
  distractors: string[],
  position: number,
  explanation: string,
): LessonQuizQuestion {
  const choices = [...distractors];
  choices.splice(position % (distractors.length + 1), 0, correct);
  return { id, prompt, choices, answer: choices.indexOf(correct), explanation };
}

function buildLesson(
  roadmap: LearningRoadmap,
  stage: RoadmapStage,
  topic: string,
  stageIndex: number,
  topicIndex: number,
): RoadmapLesson {
  const guide = domainGuides[roadmap.slug]!;
  const topicSlug = slugifyTopic(topic);
  const id = `${roadmap.slug}:${topicSlug}`;
  const previousTopic = topicIndex > 0 ? stage.topics[topicIndex - 1] : null;
  const previousStage = stageIndex > 0 ? roadmap.stages[stageIndex - 1] : null;
  const prerequisiteIds = [
    previousTopic ? `${roadmap.slug}:${slugifyTopic(previousTopic)}` : null,
    !previousTopic && previousStage ? `${roadmap.slug}:${slugifyTopic(previousStage.topics.at(-1)!)}` : null,
  ].filter((value): value is string => value !== null);

  const summary = `${topic} is topic ${topicIndex + 1} of the ${stage.title} stage. ${stage.description}`;
  const firstQuizPosition = topicIndex % 4;
  const validationPosition = (topicIndex + 2) % 4;

  return {
    id,
    roadmapSlug: roadmap.slug,
    roadmapTitle: roadmap.title,
    topicSlug,
    title: topic,
    stageIndex,
    topicIndex,
    stageTitle: stage.title,
    level: stage.level,
    accent: roadmap.accent,
    estimatedMinutes: 18 + stageIndex * 2 + (topicIndex % 3) * 3,
    summary,
    objectives: [
      `State the central definitions and assumptions behind ${topic.toLowerCase()}.`,
      `Execute a representative ${roadmap.title.toLowerCase()} argument involving ${topic.toLowerCase()}.`,
      `Diagnose a common failure and verify the result independently.`,
    ],
    sections: [
      {
        heading: "Why this topic matters",
        body: `${guide.foundation} Within ${stage.title.toLowerCase()}, ${topic.toLowerCase()} supplies a tool needed for the stage checkpoint: ${stage.checkpoint}`,
      },
      {
        heading: "A reliable reasoning pattern",
        body: `${levelGuides[stage.level]} Start by doing this: ${guide.firstMove} Next, ${guide.representation.toLowerCase()} Then ${guide.operation.toLowerCase()} Finally, ${guide.validation.toLowerCase()}`,
      },
      {
        heading: "What to watch for",
        body: `The most common failure is ${guide.failure.toLowerCase()} For ${topic.toLowerCase()}, write assumptions beside the step that uses them and keep a separate verification line in every solution.`,
      },
    ],
    keyIdeas: [
      { label: "Frame", detail: guide.firstMove },
      { label: "Execute", detail: guide.operation },
      { label: "Verify", detail: guide.validation },
    ],
    workedExample: {
      prompt: guide.scenario(topic, stage.level),
      steps: [
        `Restate ${topic.toLowerCase()} using the objects and notation of the problem; list every assumption before calculating.`,
        guide.representation,
        `${guide.operation} Record intermediate results so the argument can be audited.`,
        guide.validation,
      ],
      result: `A finished solution is not just a final value: it shows why the chosen method applies and demonstrates the ${stage.title.toLowerCase()} checkpoint—${stage.checkpoint}`,
    },
    exercise: {
      prompt: guide.exercise(topic, stage.level),
      hints: [
        `Begin from the definition of ${topic.toLowerCase()}, not from a memorized formula.`,
        guide.firstMove,
        `Use this final audit: ${guide.validation}`,
      ],
      solution: `A strong response defines ${topic.toLowerCase()}, states the model and hypotheses, carries out the central operation without skipped steps, and closes with an independent check. It should explicitly connect the result to this stage goal: ${stage.checkpoint}`,
    },
    quiz: [
      makeQuizQuestion(
        `${id}:frame`,
        `What is the strongest first move in a problem centered on ${topic}?`,
        guide.firstMove,
        [
          "Search for the longest available formula and substitute immediately.",
          "Assume the standard hypotheses without writing them down.",
          "Compute several examples and treat the observed pattern as proof.",
        ],
        firstQuizPosition,
        `The framing step prevents invalid calculations: ${guide.firstMove}`,
      ),
      makeQuizQuestion(
        `${id}:mastery`,
        `Which result best demonstrates mastery of ${topic} within this stage?`,
        stage.checkpoint,
        [
          `Memorize the spelling of every term in ${stage.title}.`,
          "Finish one guided example without explaining why the method applies.",
          "Recognize the topic name when it appears in a list.",
        ],
        (firstQuizPosition + 1) % 4,
        `The roadmap uses an observable performance gate rather than recall: ${stage.checkpoint}`,
      ),
      makeQuizQuestion(
        `${id}:validate`,
        `After solving a ${topic} exercise, which validation is most informative?`,
        guide.validation,
        [
          "Check only that the final expression looks familiar.",
          "Compare the number of lines with a worked solution.",
          "Round every intermediate value until the result is simple.",
        ],
        validationPosition,
        `Independent validation catches both conceptual and computational mistakes: ${guide.validation}`,
      ),
    ],
    prerequisiteIds,
  };
}

export const roadmapLessons = learningRoadmaps.flatMap((roadmap) =>
  roadmap.stages.flatMap((stage, stageIndex) =>
    stage.topics.map((topic, topicIndex) => buildLesson(roadmap, stage, topic, stageIndex, topicIndex)),
  ),
);

export const roadmapLessonMap = Object.fromEntries(
  roadmapLessons.map((lesson) => [lesson.id, lesson]),
) as Record<string, RoadmapLesson>;

export function getRoadmapLesson(roadmapSlug: string, topicSlug: string) {
  return roadmapLessonMap[`${roadmapSlug}:${topicSlug}`];
}

export function getAdjacentLessons(lesson: RoadmapLesson) {
  const roadmapSequence = roadmapLessons.filter((item) => item.roadmapSlug === lesson.roadmapSlug);
  const index = roadmapSequence.findIndex((item) => item.id === lesson.id);
  return {
    previous: index > 0 ? roadmapSequence[index - 1] : null,
    next: index < roadmapSequence.length - 1 ? roadmapSequence[index + 1] : null,
  };
}
