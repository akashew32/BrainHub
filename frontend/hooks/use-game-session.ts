"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Difficulty, GameSlug } from "@/types/games";

export function useGameSession(slug: GameSlug) {
  const [sessionId, setSessionId] = useState("");
  const [persistenceError, setPersistenceError] = useState("");
  const startedAt = useRef(0);

  const startSession = useCallback(
    async (difficulty: Difficulty) => {
      startedAt.current = performance.now();
      try {
        const result = await api.create(slug, difficulty);
        setSessionId(result.id);
        setPersistenceError("");
        return result;
      } catch {
        setPersistenceError("Progress is local until the BrainHub API is available.");
        return null;
      }
    },
    [slug],
  );

  const completeSession = useCallback(
    async (score: number, metrics: Record<string, unknown>, won?: boolean) => {
      if (!sessionId) return;
      try {
        await api.complete(slug, sessionId, {
          score,
          duration_ms: Math.round(performance.now() - startedAt.current),
          won,
          metrics,
        });
        setPersistenceError("");
      } catch {
        setPersistenceError("This result could not be saved. You can still play again.");
      }
    },
    [sessionId, slug],
  );

  return { sessionId, persistenceError, startSession, completeSession };
}
