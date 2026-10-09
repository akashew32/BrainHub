import type { Difficulty } from "@/types/games";

export type RandomSource = () => number;

export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function difficultyIndex(difficulty: Difficulty) {
  return { easy: 0, medium: 1, hard: 2, expert: 3 }[difficulty];
}

const diceMemo = new Map<string, number>();
export function stoppingValue(bank: number, rollsLeft: number): number {
  const key = `${bank}:${rollsLeft}`;
  const cached = diceMemo.get(key);
  if (cached !== undefined) return cached;
  if (rollsLeft <= 0) return bank;
  const outcomes = [1, 2, 3, 4].map((face) => stoppingValue(bank + face, rollsLeft - 1));
  outcomes.push(stoppingValue(bank + 10, rollsLeft - 1), 0);
  const result = Math.max(bank, outcomes.reduce((sum, value) => sum + value, 0) / 6);
  diceMemo.set(key, result);
  return result;
}

export function stoppingDecision(bank: number, rollsLeft: number) {
  const stopEv = bank;
  const outcomes = [1, 2, 3, 4].map((face) => stoppingValue(bank + face, rollsLeft - 1));
  outcomes.push(stoppingValue(bank + 10, rollsLeft - 1), 0);
  const continueEv = rollsLeft > 0 ? outcomes.reduce((sum, value) => sum + value, 0) / 6 : -Infinity;
  return { stopEv, continueEv, optimal: continueEv > stopEv ? ("continue" as const) : ("stop" as const) };
}

const cardMemo = new Map<string, number>();
export function cardStoppingValue(total: number, deck: number[], drawsLeft: number): number {
  const key = `${total}:${drawsLeft}:${[...deck].sort((a, b) => a - b).join(",")}`;
  const cached = cardMemo.get(key);
  if (cached !== undefined) return cached;
  if (drawsLeft <= 0 || deck.length === 0) return total;
  const continuation = deck.reduce((sum, card, index) => {
    const remaining = [...deck.slice(0, index), ...deck.slice(index + 1)];
    return sum + cardStoppingValue(total + card, remaining, drawsLeft - 1) / deck.length;
  }, 0);
  const value = Math.max(total, continuation);
  cardMemo.set(key, value);
  return value;
}

export function cardStoppingDecision(total: number, deck: number[], drawsLeft: number) {
  const continueEv = deck.length
    ? deck.reduce((sum, card, index) => {
        const remaining = [...deck.slice(0, index), ...deck.slice(index + 1)];
        return sum + cardStoppingValue(total + card, remaining, drawsLeft - 1) / deck.length;
      }, 0)
    : -Infinity;
  return {
    stopEv: total,
    continueEv,
    optimal: continueEv > total ? ("continue" as const) : ("stop" as const),
  };
}

export function offerContinuationValue(offersLeft: number, values: number[]): number {
  if (offersLeft <= 0) return 0;
  const afterRejecting = offerContinuationValue(offersLeft - 1, values);
  return values.reduce((sum, offer) => sum + Math.max(offer, afterRejecting), 0) / values.length;
}

export function expectedProfit(probability: number, winProfit: number, loss: number) {
  return probability * winProfit - (1 - probability) * loss;
}

export function impliedProbability(profitToOne: number) {
  return 1 / (profitToOne + 1);
}

export function decimalOdds(probability: number) {
  return 1 / probability;
}

export function kellyFraction(probability: number, profitToOne: number) {
  return Math.max(0, (profitToOne * probability - (1 - probability)) / profitToOne);
}

export function logarithmicScore(estimate: number, target: number) {
  if (estimate <= 0 || target <= 0) return 0;
  return Math.max(0, 100 - 55 * Math.abs(Math.log(estimate / target)));
}

export type AuctionType = "first-price" | "second-price" | "common-value";
export function firstPriceTarget(value: number, bidders: number) {
  return (value * (bidders - 1)) / bidders;
}

export function settleAuction(bids: number[], values: number[], type: AuctionType) {
  const winner = bids.reduce((best, bid, index) => (bid > bids[best]! ? index : best), 0);
  const sorted = [...bids].sort((a, b) => b - a);
  const payment =
    type === "first-price" ? bids[winner]! : type === "second-price" ? sorted[1]! : bids[winner]!;
  return { winner, payment, profit: values[winner]! - payment };
}

export function bayesUpdate(prior: number, likelihoodTrue: number, likelihoodFalse: number) {
  const numerator = prior * likelihoodTrue;
  return numerator / (numerator + (1 - prior) * likelihoodFalse);
}

export function brierScore(estimate: number, outcome: boolean) {
  return (estimate - Number(outcome)) ** 2;
}

export type BookLevel = { tick: number; quantity: number };
export function sweepBook(levels: BookLevel[], quantity: number) {
  let remaining = quantity;
  let notionalTicks = 0;
  let filled = 0;
  const fills: BookLevel[] = [];
  for (const level of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.quantity);
    fills.push({ tick: level.tick, quantity: take });
    remaining -= take;
    filled += take;
    notionalTicks += take * level.tick;
  }
  return { fills, filled, remaining, averageTick: filled ? notionalTicks / filled : 0 };
}

const takeMemo = new Map<string, boolean>();
export function isWinningTakeaway(stones: number, moves: number[], misere = false): boolean {
  if (stones === 0) return misere;
  const key = `${stones}:${moves.join(",")}:${misere}`;
  const cached = takeMemo.get(key);
  if (cached !== undefined) return cached;
  const legal = moves.filter((move) => move <= stones);
  const winning = legal.some((move) => !isWinningTakeaway(stones - move, moves, misere));
  takeMemo.set(key, winning);
  return winning;
}

export function optimalTakeawayMoves(stones: number, moves: number[], misere = false) {
  return moves.filter((move) => move <= stones && !isWinningTakeaway(stones - move, moves, misere));
}

export function penneyResponse(sequence: string) {
  const opposite = sequence[1] === "H" ? "T" : "H";
  return opposite + sequence.slice(0, 2);
}
