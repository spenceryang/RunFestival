'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/lib/store/user-store';
import type { CoachingPersona } from '@/types/run';

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

const PERSONAS: { value: CoachingPersona; label: string; desc: string }[] = [
  { value: 'hype', label: 'Hype', desc: 'High energy Peloton-style coach' },
  { value: 'calm', label: 'Calm', desc: 'Mindful zen guide' },
  { value: 'data', label: 'Data', desc: 'Analytics and strategy focused' },
  { value: 'storyteller', label: 'Storyteller', desc: 'Narrative-driven engagement' },
];

const STORY_TOPIC_OPTIONS = [
  'history', 'science', 'culture', 'sports', 'nature', 'music', 'technology', 'food',
];

const ACTIVITY_TYPE_OPTIONS = [
  'running', 'marathon_training', 'trail_running', 'cycling', 'hiking', 'walking',
];

function ProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const existingUser = useUserStore((s) => s.user);
  const fetchUser = useUserStore((s) => s.fetchUser);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<string>('intermediate');
  const [persona, setPersona] = useState<CoachingPersona>('hype');
  const [storyTopics, setStoryTopics] = useState<string[]>(['history', 'science']);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [activityTypes, setActivityTypes] = useState<string[]>(['running']);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from existing profile
  useEffect(() => {
    if (existingUser) {
      setName(existingUser.name);
      setCity(existingUser.city ?? '');
      setExperienceLevel(existingUser.experienceLevel);
      setPersona(existingUser.preferredPersona);
      setStoryTopics(existingUser.storyTopics);
      setDistanceUnit(existingUser.distanceUnit);
      setActivityTypes(existingUser.activityTypes);
    }
  }, [existingUser]);

  const toggleTopic = (topic: string) => {
    setStoryTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const toggleActivity = (activity: string) => {
    setActivityTypes((prev) => {
      if (prev.includes(activity)) {
        // Don't allow removing the last activity
        return prev.length > 1 ? prev.filter((a) => a !== activity) : prev;
      }
      return [...prev, activity];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setError('Not authenticated');
        setSaving(false);
        return;
      }

      const { error: upsertError } = await supabase.from('users').upsert({
        id: authUser.id,
        email: authUser.email!,
        name: name.trim(),
        city: city.trim() || null,
        experience_level: experienceLevel,
        preferred_persona: persona,
        story_topics: storyTopics,
        distance_unit: distanceUnit,
        activity_types: activityTypes,
      });

      if (upsertError) {
        setError(upsertError.message);
        setSaving(false);
        return;
      }

      await fetchUser();

      if (isOnboarding) {
        router.push('/');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-festival-darker px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        {!isOnboarding && (
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-festival-card border border-festival-border
                       flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-festival-text" />
          </button>
        )}
        <div>
          {isOnboarding ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-6 h-6 text-festival-orange" />
                <h1 className="text-2xl font-bold text-white">Welcome to RunFestival!</h1>
              </div>
              <p className="text-festival-muted text-sm">
                Set up your profile to get personalized coaching
              </p>
            </>
          ) : (
            <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6 max-w-md">
        {/* Name */}
        <div>
          <label className="block text-sm text-festival-text mb-2">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-xl bg-festival-card border border-festival-border
                       text-white placeholder-festival-muted/50
                       focus:outline-none focus:border-festival-orange transition-colors"
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-sm text-festival-text mb-2">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Your city"
            className="w-full px-4 py-3 rounded-xl bg-festival-card border border-festival-border
                       text-white placeholder-festival-muted/50
                       focus:outline-none focus:border-festival-orange transition-colors"
          />
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-sm text-festival-text mb-2">
            Experience Level
          </label>
          <div className="flex gap-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setExperienceLevel(level.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${
                    experienceLevel === level.value
                      ? 'bg-festival-orange text-white'
                      : 'bg-festival-card border border-festival-border text-festival-text hover:border-festival-orange/50'
                  }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        {/* Coaching Persona */}
        <div>
          <label className="block text-sm text-festival-text mb-2">
            Coaching Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PERSONAS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPersona(p.value)}
                className={`p-3 rounded-xl text-left transition-colors
                  ${
                    persona === p.value
                      ? 'bg-festival-orange/20 border-2 border-festival-orange'
                      : 'bg-festival-card border border-festival-border hover:border-festival-orange/50'
                  }`}
              >
                <div className="text-sm font-semibold text-white">{p.label}</div>
                <div className="text-xs text-festival-muted mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Distance Unit */}
        <div>
          <label className="block text-sm text-festival-text mb-2">
            Distance Unit
          </label>
          <div className="flex gap-2">
            {(['km', 'mi'] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => setDistanceUnit(unit)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${
                    distanceUnit === unit
                      ? 'bg-festival-orange text-white'
                      : 'bg-festival-card border border-festival-border text-festival-text hover:border-festival-orange/50'
                  }`}
              >
                {unit === 'km' ? 'Kilometers' : 'Miles'}
              </button>
            ))}
          </div>
        </div>

        {/* Story Topics */}
        <div>
          <label className="block text-sm text-festival-text mb-2">
            Story Topics (for coaching)
          </label>
          <div className="flex flex-wrap gap-2">
            {STORY_TOPIC_OPTIONS.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors
                  ${
                    storyTopics.includes(topic)
                      ? 'bg-festival-orange text-white'
                      : 'bg-festival-card border border-festival-border text-festival-muted hover:border-festival-orange/50'
                  }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Types */}
        <div>
          <label className="block text-sm text-festival-text mb-2">
            Activity Types
          </label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPE_OPTIONS.map((activity) => (
              <button
                key={activity}
                onClick={() => toggleActivity(activity)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors
                  ${
                    activityTypes.includes(activity)
                      ? 'bg-festival-orange text-white'
                      : 'bg-festival-card border border-festival-border text-festival-muted hover:border-festival-orange/50'
                  }`}
              >
                {activity.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-festival-orange to-festival-red
                     text-white font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     active:scale-[0.98] transition-transform
                     flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : saving ? (
            'Saving...'
          ) : isOnboarding ? (
            'Save & Start Running'
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-festival-darker" />}>
      <ProfileForm />
    </Suspense>
  );
}
