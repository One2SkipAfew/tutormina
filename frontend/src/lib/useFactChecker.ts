/**
 * useFactChecker — Real-time fact-checking hook
 *
 * Queue-based: receives transcript segments, batches them into checkable claims,
 * and calls the AI API's /fact-check endpoint. Caches results to avoid re-checking.
 */

import { useState, useRef, useCallback } from 'react';
import { factCheck, type FactCheckResult } from './aiApi';

interface UseFactCheckerReturn {
  /** All fact-check results accumulated during the session. */
  results: FactCheckResult[];
  /** Whether a fact-check request is currently in progress. */
  isChecking: boolean;
  /** Run a fact check against the current transcript. */
  checkTranscript: (transcript: string, resourceContext?: string) => Promise<void>;
  /** Clear all results. */
  clearResults: () => void;
}

export function useFactChecker(): UseFactCheckerReturn {
  const [results, setResults] = useState<FactCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // Cache to avoid re-checking the same claims
  const checkedClaimsRef = useRef<Set<string>>(new Set());

  const checkTranscript = useCallback(async (transcript: string, resourceContext?: string) => {
    if (!transcript.trim() || isChecking) return;

    setIsChecking(true);
    try {
      const response = await factCheck(transcript, { resourceContext });
      const newResults = (response.results || []).filter(
        (r) => !checkedClaimsRef.current.has(r.claim)
      );

      // Add to cache
      for (const r of newResults) {
        checkedClaimsRef.current.add(r.claim);
      }

      if (newResults.length > 0) {
        setResults(prev => [...prev, ...newResults]);
      }
    } catch (err) {
      console.error('Fact-check error:', err);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  const clearResults = useCallback(() => {
    setResults([]);
    checkedClaimsRef.current.clear();
  }, []);

  return {
    results,
    isChecking,
    checkTranscript,
    clearResults,
  };
}
