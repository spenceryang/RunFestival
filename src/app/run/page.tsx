'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRunStore } from '@/lib/store/run-store';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { RunScreen } from '@/components/run/RunScreen';
import { DemoRunScreen } from '@/components/run/DemoRunScreen';
import { DevRunScreen } from '@/components/run/DevRunScreen';
import { CoachingTriggerEngine } from '@/lib/coach/trigger-engine';
import { buildCoachingContext } from '@/lib/coach/context-builder';
import { AudioManager } from '@/lib/audio/audio-manager';
import { VoiceInput } from '@/lib/audio/voice-input';
import {
  useCoachingStore,
  summarizeMessage,
  extractTopics,
  detectCliffhanger,
} from '@/lib/store/coaching-store';
import type { CoachingHistory } from '@/lib/coach/context-builder';
import { useUserStore } from '@/lib/store/user-store';
import { generateStoryPlan } from '@/lib/agents/story-curator';
import { shouldReview, reviewCoachingMessage, formatQualityFeedback } from '@/lib/agents/quality-supervisor';
import { formatPace } from '@/lib/gps/pace';

export default function RunPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-festival-darker" />}>
      <RunPage />
    </Suspense>
  );
}

function RunPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';
  const isDev = searchParams.get('dev') === 'true';
  const store = useRunStore();
  const triggerEngineRef = useRef<CoachingTriggerEngine | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const voiceInputRef = useRef<VoiceInput | null>(null);
  const prevSnapshotRef = useRef<typeof store | null>(null);
  const triggerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const userProfile = useUserStore((s) => s.user);

  const getUserProfileForCoaching = useCallback(() => {
    if (userProfile) {
      return {
        name: userProfile.name,
        city: userProfile.city ?? 'Unknown',
        experienceLevel: userProfile.experienceLevel,
        storyTopics: userProfile.storyTopics,
      };
    }
    return {
      name: 'Runner',
      city: 'Unknown',
      experienceLevel: 'intermediate' as const,
      storyTopics: ['history', 'science'],
    };
  }, [userProfile]);

  const getCoachingHistory = useCallback((): CoachingHistory => {
    const store = useCoachingStore.getState();
    return {
      recentMessages: store.getRecentHistory(5).map((m) => ({
        triggerType: m.triggerType,
        summary: m.summary,
        topics: m.topics,
      })),
      topicsCovered: store.getTopicsCovered(),
      lastCliffhanger: store.getLastCliffhanger(),
    };
  }, []);

  const messageCountRef = useRef(0);

  const buildOnComplete = useCallback(
    (triggerType: string, userMessage?: string) => {
      return (fullText: string) => {
        const idx = messageCountRef.current++;
        useCoachingStore.getState().addMessage({
          triggerType: triggerType as import('@/types/coach').TriggerType,
          text: fullText,
          summary: summarizeMessage(fullText),
          topics: extractTopics(fullText),
          hasCliffhanger: detectCliffhanger(fullText),
          userMessage,
          timestamp: Date.now(),
        });

        // Async: fire story plan generation on first idle trigger
        if (triggerType === 'idle_storytelling' && !useCoachingStore.getState().cachedStoryPlan) {
          const profile = getUserProfileForCoaching();
          generateStoryPlan({
            userInterests: profile.storyTopics,
            activityType: userProfile?.activityTypes?.[0] ?? 'running',
            topicsCovered: useCoachingStore.getState().getTopicsCovered(),
            persona: useRunStore.getState().persona,
          }).then((plan) => {
            if (plan) useCoachingStore.getState().setStoryPlan(plan);
          });
        }

        // Async: fire quality review every 3rd message
        if (shouldReview(idx)) {
          const runState = useRunStore.getState();
          reviewCoachingMessage({
            coachingMessage: fullText,
            triggerType,
            persona: runState.persona,
            runContext: {
              distanceKm: runState.distanceMeters / 1000,
              paceFormatted: formatPace(runState.currentPaceSecondsPerKm),
              elapsedMinutes: runState.elapsedSeconds / 60,
            },
            previousTopics: useCoachingStore.getState().getTopicsCovered(),
          }).then((review) => {
            if (review) useCoachingStore.getState().addQualityReview(review);
          });
        }
      };
    },
    [getUserProfileForCoaching, userProfile]
  );

  // Keep callback refs up to date to avoid stale closures in the trigger interval
  const getCoachingHistoryRef = useRef(getCoachingHistory);
  useEffect(() => { getCoachingHistoryRef.current = getCoachingHistory; }, [getCoachingHistory]);

  const buildOnCompleteRef = useRef(buildOnComplete);
  useEffect(() => { buildOnCompleteRef.current = buildOnComplete; }, [buildOnComplete]);

  const getUserProfileForCoachingRef = useRef(getUserProfileForCoaching);
  useEffect(() => { getUserProfileForCoachingRef.current = getUserProfileForCoaching; }, [getUserProfileForCoaching]);

  // Effect 1: Redirect if user lands on /run without an active run
  useEffect(() => {
    if (store.status === 'idle') {
      router.replace('/setup');
    }
  }, [store.status, router]);

  // Effect 2: Initialize coaching systems once — clean up on unmount only
  const coachingInitializedRef = useRef(false);

  useEffect(() => {
    // Only initialize once per mount
    if (coachingInitializedRef.current) return;

    const status = useRunStore.getState().status;
    if (status !== 'running' && status !== 'paused') return;

    coachingInitializedRef.current = true;

    triggerEngineRef.current = new CoachingTriggerEngine();
    audioManagerRef.current = new AudioManager();
    audioManagerRef.current.onActiveChange(setIsCoaching);
    voiceInputRef.current = new VoiceInput();

    // Evaluate triggers every 3 seconds
    triggerIntervalRef.current = setInterval(() => {
      const currentState = useRunStore.getState();
      if (currentState.status !== 'running') return;

      const trigger = triggerEngineRef.current?.evaluate(
        {
          status: currentState.status,
          distanceMeters: currentState.distanceMeters,
          elapsedSeconds: currentState.elapsedSeconds,
          currentPaceSecondsPerKm: currentState.currentPaceSecondsPerKm,
          averagePaceSecondsPerKm: currentState.averagePaceSecondsPerKm,
          targetPaceSecondsPerKm: currentState.targetPaceSecondsPerKm,
          targetDistanceMeters: currentState.targetDistanceMeters,
          currentSplit: currentState.currentSplit,
          splits: currentState.splits,
        },
        prevSnapshotRef.current
          ? {
              status: prevSnapshotRef.current.status,
              distanceMeters: prevSnapshotRef.current.distanceMeters,
              elapsedSeconds: prevSnapshotRef.current.elapsedSeconds,
              currentPaceSecondsPerKm: prevSnapshotRef.current.currentPaceSecondsPerKm,
              averagePaceSecondsPerKm: prevSnapshotRef.current.averagePaceSecondsPerKm,
              targetPaceSecondsPerKm: prevSnapshotRef.current.targetPaceSecondsPerKm,
              targetDistanceMeters: prevSnapshotRef.current.targetDistanceMeters,
              currentSplit: prevSnapshotRef.current.currentSplit,
              splits: prevSnapshotRef.current.splits,
            }
          : null
      );

      prevSnapshotRef.current = { ...currentState };

      if (trigger) {
        const collectiveState = useCollectiveStore.getState();
        const coachingState = useCoachingStore.getState();
        const qualityFeedback = formatQualityFeedback(coachingState.qualityReviews);
        const context = buildCoachingContext(
          currentState.persona,
          trigger.type,
          {
            distanceMeters: currentState.distanceMeters,
            elapsedSeconds: currentState.elapsedSeconds,
            currentPaceSecondsPerKm: currentState.currentPaceSecondsPerKm,
            averagePaceSecondsPerKm: currentState.averagePaceSecondsPerKm,
            targetPaceSecondsPerKm: currentState.targetPaceSecondsPerKm,
            targetDistanceMeters: currentState.targetDistanceMeters,
            splits: currentState.splits,
            isPaused: false,
          },
          getUserProfileForCoachingRef.current(),
          collectiveState,
          getCoachingHistoryRef.current(),
          coachingState.cachedStoryPlan,
          qualityFeedback
        );
        audioManagerRef.current?.enqueue(context, buildOnCompleteRef.current(trigger.type));
      }
    }, 3000);

    return () => {
      if (triggerIntervalRef.current) clearInterval(triggerIntervalRef.current);
      triggerEngineRef.current?.reset();
      audioManagerRef.current?.destroy();
      voiceInputRef.current?.destroy();
      useCoachingStore.getState().reset();
      coachingInitializedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 3: Pause/resume audio when run status changes
  useEffect(() => {
    if (store.status === 'paused') {
      audioManagerRef.current?.pause();
    } else if (store.status === 'running') {
      audioManagerRef.current?.resume();
    }
  }, [store.status]);

  const handleFinish = useCallback(() => {
    router.push('/recap');
  }, [router]);

  const sendToCoach = useCallback((userMessage?: string) => {
    const currentState = useRunStore.getState();
    const collectiveState = useCollectiveStore.getState();

    if (!triggerEngineRef.current || !audioManagerRef.current) return;

    const trigger = triggerEngineRef.current.triggerUserInitiated({
      status: currentState.status,
      distanceMeters: currentState.distanceMeters,
      elapsedSeconds: currentState.elapsedSeconds,
      currentPaceSecondsPerKm: currentState.currentPaceSecondsPerKm,
      averagePaceSecondsPerKm: currentState.averagePaceSecondsPerKm,
      targetPaceSecondsPerKm: currentState.targetPaceSecondsPerKm,
      targetDistanceMeters: currentState.targetDistanceMeters,
      currentSplit: currentState.currentSplit,
      splits: currentState.splits,
    });

    const coachingState = useCoachingStore.getState();
    const qualityFeedback = formatQualityFeedback(coachingState.qualityReviews);
    const context = buildCoachingContext(
      currentState.persona,
      trigger.type,
      {
        distanceMeters: currentState.distanceMeters,
        elapsedSeconds: currentState.elapsedSeconds,
        currentPaceSecondsPerKm: currentState.currentPaceSecondsPerKm,
        averagePaceSecondsPerKm: currentState.averagePaceSecondsPerKm,
        targetPaceSecondsPerKm: currentState.targetPaceSecondsPerKm,
        targetDistanceMeters: currentState.targetDistanceMeters,
        splits: currentState.splits,
        isPaused: currentState.status === 'paused',
      },
      getUserProfileForCoaching(),
      collectiveState,
      getCoachingHistory(),
      coachingState.cachedStoryPlan,
      qualityFeedback
    );

    // Attach the runner's spoken message if provided
    if (userMessage) {
      context.userMessage = userMessage;
      // Interrupt current audio — user's voice response takes priority
      audioManagerRef.current.interrupt();
    }

    audioManagerRef.current.enqueue(context, buildOnComplete(trigger.type, userMessage));
  }, [getCoachingHistory, buildOnComplete, getUserProfileForCoaching]);

  const handleTalkToCoach = useCallback(() => {
    // If already listening, stop and fall back to regular coach trigger
    if (voiceInputRef.current?.isListening) {
      voiceInputRef.current.stop();
      setIsListening(false);
      return;
    }

    // Try voice input first; fall back to regular coach trigger if unsupported
    if (VoiceInput.isSupported()) {
      const started = voiceInputRef.current?.start(
        (transcript) => {
          setIsListening(false);
          sendToCoach(transcript);
        },
        () => {
          setIsListening(false);
        }
      );

      if (started) {
        setIsListening(true);
        return;
      }
    }

    // Fallback: trigger coach without voice message
    sendToCoach();
  }, [sendToCoach]);

  if (isDev) {
    // Verify dev auth from sessionStorage
    const isDevAuthed = typeof window !== 'undefined' && sessionStorage.getItem('dev-auth') === 'true';
    if (!isDevAuthed) {
      router.replace('/dev');
      return <div className="min-h-screen bg-festival-darker" />;
    }
    return (
      <DevRunScreen
        onFinish={handleFinish}
        onTalkToCoach={handleTalkToCoach}
        isListening={isListening}
        isCoaching={isCoaching}
      />
    );
  }

  if (isDemo) {
    return (
      <DemoRunScreen
        onFinish={handleFinish}
        onTalkToCoach={handleTalkToCoach}
        isListening={isListening}
        isCoaching={isCoaching}
      />
    );
  }

  return (
    <RunScreen
      onFinish={handleFinish}
      onTalkToCoach={handleTalkToCoach}
      isListening={isListening}
      isCoaching={isCoaching}
    />
  );
}
