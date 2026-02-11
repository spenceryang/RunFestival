'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRunStore } from '@/lib/store/run-store';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { RunScreen } from '@/components/run/RunScreen';
import { DemoRunScreen } from '@/components/run/DemoRunScreen';
import { CoachingTriggerEngine } from '@/lib/coach/trigger-engine';
import { buildCoachingContext } from '@/lib/coach/context-builder';
import { AudioManager } from '@/lib/audio/audio-manager';
import { VoiceInput } from '@/lib/audio/voice-input';

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
  const store = useRunStore();
  const triggerEngineRef = useRef<CoachingTriggerEngine | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const voiceInputRef = useRef<VoiceInput | null>(null);
  const prevSnapshotRef = useRef<typeof store | null>(null);
  const triggerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Initialize coaching systems
  useEffect(() => {
    if (store.status !== 'running' && store.status !== 'paused') {
      // If we land on /run without starting, redirect to setup
      if (store.status === 'idle') {
        router.replace('/setup');
        return;
      }
    }

    triggerEngineRef.current = new CoachingTriggerEngine();
    audioManagerRef.current = new AudioManager();
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
          {
            name: 'Runner',
            city: 'Unknown',
            experienceLevel: 'intermediate',
            storyTopics: ['history', 'science'],
          },
          collectiveState
        );
        audioManagerRef.current?.enqueue(context);
      }
    }, 3000);

    return () => {
      if (triggerIntervalRef.current) clearInterval(triggerIntervalRef.current);
      triggerEngineRef.current?.reset();
      audioManagerRef.current?.destroy();
      voiceInputRef.current?.destroy();
    };
  }, [store.status, router]);

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
      {
        name: 'Runner',
        city: 'Unknown',
        experienceLevel: 'intermediate',
        storyTopics: ['history', 'science'],
      },
      collectiveState
    );

    // Attach the runner's spoken message if provided
    if (userMessage) {
      context.userMessage = userMessage;
    }

    audioManagerRef.current.enqueue(context);
  }, []);

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

  if (isDemo) {
    return (
      <DemoRunScreen
        onFinish={handleFinish}
        onTalkToCoach={handleTalkToCoach}
        isListening={isListening}
      />
    );
  }

  return (
    <RunScreen
      onFinish={handleFinish}
      onTalkToCoach={handleTalkToCoach}
      isListening={isListening}
    />
  );
}
