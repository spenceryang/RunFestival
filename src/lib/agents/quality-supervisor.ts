/**
 * Coach Quality Supervisor — reviews coaching messages for quality.
 * Uses Opus 4.6 to evaluate every Nth message. Runs async (non-blocking).
 * Stores quality scores and feedback for future prompt improvement.
 */

export interface QualityReview {
  score: number; // 1-5
  feedback: string;
  issues: string[];
}

export interface QualityReviewInput {
  coachingMessage: string;
  triggerType: string;
  persona: string;
  runContext: {
    distanceKm: number;
    paceFormatted: string;
    elapsedMinutes: number;
  };
  previousTopics: string[];
}

/**
 * Submits a coaching message for async quality review.
 * Non-blocking — fires and stores result for future use.
 */
export async function reviewCoachingMessage(
  input: QualityReviewInput
): Promise<QualityReview | null> {
  try {
    const response = await fetch('/api/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.review as QualityReview;
  } catch {
    return null;
  }
}

/**
 * Determines if this message should be reviewed (every 3rd message).
 */
export function shouldReview(messageIndex: number): boolean {
  return messageIndex > 0 && messageIndex % 3 === 0;
}

/**
 * Formats quality feedback for inclusion in future coaching prompts.
 */
export function formatQualityFeedback(reviews: QualityReview[]): string | null {
  if (reviews.length === 0) return null;

  const recent = reviews.slice(-3);
  const avgScore = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;

  const lines: string[] = [];

  if (avgScore < 3) {
    lines.push('Recent coaching quality needs improvement:');
  } else if (avgScore >= 4) {
    lines.push('Recent coaching has been strong. Continue this approach:');
  }

  // Collect unique feedback points
  const allIssues = recent.flatMap((r) => r.issues);
  const uniqueIssues = Array.from(new Set(allIssues)).slice(0, 3);

  if (uniqueIssues.length > 0) {
    lines.push(...uniqueIssues.map((issue) => `- ${issue}`));
  }

  const recentFeedback = recent[recent.length - 1]?.feedback;
  if (recentFeedback) {
    lines.push(`Latest note: ${recentFeedback}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
