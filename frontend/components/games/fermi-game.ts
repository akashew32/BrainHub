export type FermiQuestion = {
  prompt: string;
  reference: number;
  low: number;
  high: number;
  reasoning: string;
  category: string;
};

const rows: Array<[string, number, number, number, string, string]> = [
  [
    "How many elevators operate in Manhattan?",
    70000,
    50000,
    90000,
    "Estimate buildings by type, floors, then elevators per building.",
    "Cities",
  ],
  [
    "How many piano tuners work in Chicago?",
    120,
    70,
    200,
    "Piano-owning households times tuning frequency divided by jobs per tuner.",
    "Services",
  ],
  [
    "How many cups of coffee are sold in New York City each day?",
    4000000,
    2500000,
    6500000,
    "Residents plus commuters times buyer share and cups purchased.",
    "Consumption",
  ],
  [
    "How many tennis balls fit in a school bus?",
    500000,
    350000,
    750000,
    "Usable interior volume divided by ball volume with packing loss.",
    "Volume",
  ],
  [
    "How many flights are airborne over the US at a typical moment?",
    5500,
    3500,
    7500,
    "Daily departures times average flight duration divided by 24 hours.",
    "Transport",
  ],
  [
    "How many pizza slices are eaten in the US each day?",
    100000000,
    70000000,
    140000000,
    "Population times weekly pizza incidence and slices per occasion.",
    "Consumption",
  ],
  [
    "How many traffic lights are in London?",
    6500,
    4500,
    9000,
    "Signalized intersections times average signal assemblies.",
    "Cities",
  ],
  [
    "How many golf balls are sold worldwide each year?",
    1200000000,
    700000000,
    1800000000,
    "Golfers times rounds and balls lost, plus replacements.",
    "Markets",
  ],
  [
    "How many haircuts occur in the US each day?",
    1500000,
    1000000,
    2500000,
    "Population divided by average days between haircuts.",
    "Services",
  ],
  [
    "How many smartphones are charged worldwide tonight?",
    5500000000,
    4000000000,
    7000000000,
    "Active smartphones times the share charged daily.",
    "Technology",
  ],
  [
    "How many ATM withdrawals occur in the US each day?",
    15000000,
    9000000,
    25000000,
    "Adults times monthly cash-withdrawal frequency divided by 30.",
    "Finance",
  ],
  [
    "How many books are in the New York Public Library system?",
    55000000,
    40000000,
    70000000,
    "Branch holdings plus the much larger research collections.",
    "Knowledge",
  ],
  [
    "How many liters of water do US households use daily?",
    90000000000,
    60000000000,
    130000000000,
    "Households times residents and per-person indoor/outdoor usage.",
    "Utilities",
  ],
  [
    "How many taxi and rideshare trips occur in Paris each day?",
    650000,
    350000,
    1000000,
    "Residents and visitors times rides per person-day.",
    "Transport",
  ],
  [
    "How many emails are sent globally each minute?",
    240000000,
    150000000,
    350000000,
    "Global daily email volume divided by 1,440 minutes.",
    "Technology",
  ],
  [
    "How many restaurant meals are served in the US each day?",
    70000000,
    45000000,
    110000000,
    "Population times the fraction eating out on a typical day.",
    "Consumption",
  ],
  [
    "How many bicycles are in Amsterdam?",
    900000,
    700000,
    1200000,
    "Population times bikes per resident in a high-ownership city.",
    "Cities",
  ],
  [
    "How many pairs of running shoes sell globally each year?",
    750000000,
    450000000,
    1200000000,
    "Runners and casual users times replacement cadence.",
    "Markets",
  ],
  [
    "How many gas stations are in the United States?",
    145000,
    120000,
    180000,
    "Population per station cross-checked against town counts.",
    "Infrastructure",
  ],
  [
    "How many photos are uploaded to the internet each second?",
    50000,
    25000,
    100000,
    "Daily social and photo uploads divided by seconds per day.",
    "Technology",
  ],
  [
    "How many dogs live in the UK?",
    13000000,
    9000000,
    17000000,
    "Households times dog-owning share and dogs per owning home.",
    "Population",
  ],
  [
    "How many movie tickets sell worldwide each day?",
    20000000,
    10000000,
    35000000,
    "Annual global admissions divided by 365.",
    "Entertainment",
  ],
  [
    "How many commercial ships are at sea right now?",
    55000,
    35000,
    80000,
    "Active fleet times the share underway rather than in port.",
    "Transport",
  ],
  [
    "How many windows are in Manhattan?",
    12000000,
    8000000,
    20000000,
    "Buildings times floors and windows per floor by building type.",
    "Cities",
  ],
  [
    "How many toothbrushes sell globally each day?",
    12000000,
    8000000,
    22000000,
    "Population divided by replacement period, adjusted for access.",
    "Consumption",
  ],
  [
    "How many parking spaces are in Los Angeles?",
    18000000,
    12000000,
    25000000,
    "Vehicles and residents times multiple spaces per car.",
    "Cities",
  ],
  [
    "How many barrels of oil are consumed worldwide per hour?",
    4200000,
    3500000,
    5000000,
    "Roughly 100 million barrels per day divided by 24.",
    "Energy",
  ],
  [
    "How many active credit cards are in the US?",
    1100000000,
    700000000,
    1500000000,
    "Adults times cards per holder, including store cards.",
    "Finance",
  ],
  [
    "How many sheets of office paper are used globally each day?",
    1000000000,
    500000000,
    2000000000,
    "Office workers times sheets used per worker-day.",
    "Consumption",
  ],
  [
    "How many public school teachers work in the US?",
    3200000,
    2700000,
    4000000,
    "Students divided by average student-teacher ratio.",
    "Population",
  ],
  [
    "How many data centers operate worldwide?",
    11000,
    7000,
    18000,
    "Major facilities plus regional colocation sites.",
    "Technology",
  ],
  [
    "How many containers do global ports handle each day?",
    2400000,
    1600000,
    3200000,
    "Annual TEU throughput divided by 365.",
    "Trade",
  ],
  [
    "How many people use the London Underground daily?",
    3600000,
    2500000,
    5000000,
    "Residents and commuters times transit mode share.",
    "Transport",
  ],
  [
    "How many weddings occur worldwide per day?",
    160000,
    100000,
    250000,
    "Population times annual marriage rate divided by 365.",
    "Population",
  ],
  [
    "How many apples are eaten in Europe each day?",
    110000000,
    70000000,
    170000000,
    "Population times annual per-capita apple consumption.",
    "Consumption",
  ],
  [
    "How many security cameras operate in China?",
    600000000,
    350000000,
    900000000,
    "Urban public and commercial areas times camera density.",
    "Technology",
  ],
  [
    "How many packages are delivered in the US each day?",
    70000000,
    45000000,
    100000000,
    "Annual carrier volume divided by calendar days.",
    "Logistics",
  ],
  [
    "How many wind turbines operate worldwide?",
    450000,
    300000,
    650000,
    "Installed capacity divided by average turbine capacity.",
    "Energy",
  ],
  [
    "How many hotel rooms are in Las Vegas?",
    150000,
    120000,
    180000,
    "Strip inventory plus downtown and local hotels.",
    "Cities",
  ],
  [
    "How many coins circulate in the United States?",
    150000000000,
    100000000000,
    250000000000,
    "Decades of mint production less attrition and exports.",
    "Finance",
  ],
];

export const fermiQuestions: FermiQuestion[] = rows.map(
  ([prompt, reference, low, high, reasoning, category]) => ({
    prompt,
    reference,
    low,
    high,
    reasoning,
    category,
  }),
);

export function fermiScore(answer: number, reference: number) {
  if (answer <= 0 || reference <= 0) throw new Error("Estimates must be positive");
  const ratio = answer / reference;
  const error = Math.abs(Math.log10(ratio));
  return { ratio, score: Math.max(0, Math.round(100 * (1 - Math.min(error, 2) / 2))) };
}

export function fermiFeedback(ratio: number) {
  if (ratio <= 0) return "No estimate submitted";
  const factor = Math.max(ratio, 1 / ratio);
  if (factor <= 1.1) return "Within 10%";
  if (factor <= 1.25) return "Within 25%";
  if (factor <= 2) return "Within 2×";
  if (factor <= 5) return "Within 5×";
  if (factor <= 10) return "Correct order of magnitude";
  return "Off by more than an order of magnitude";
}
