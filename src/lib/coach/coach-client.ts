import type { CoachingContext } from '@/types/coach';
import { getApiHeaders } from '@/lib/auth/demo-headers';

/**
 * Stream coaching text from Claude via our API proxy.
 * Calls the callback with each complete sentence as it arrives,
 * enabling sentence-level TTS streaming for low latency.
 */
export async function streamCoachingMessage(
  context: CoachingContext,
  onSentence: (sentence: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    console.warn('[Coach] Streaming request — trigger:', context.trigger.type, 'persona:', context.persona);
    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(context),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.warn('[Coach] API error:', response.status, errorBody.slice(0, 200));
      throw new Error(`Coach API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let collectedFullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from the Anthropic streaming format
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            if (
              event.type === 'content_block_delta' &&
              event.delta?.type === 'text_delta'
            ) {
              fullText += event.delta.text;
              collectedFullText += event.delta.text;

              // Check for complete sentence (ends with . ! ? and followed by space or is end)
              const sentenceEnd = fullText.match(
                /^(.*?[.!?])\s*/
              );
              if (sentenceEnd) {
                const sentence = sentenceEnd[1].trim();
                if (sentence.length > 0) {
                  onSentence(sentence);
                  fullText = fullText.slice(sentenceEnd[0].length);
                }
              }
            }
          } catch {
            // Skip unparseable events
          }
        }
      }
    }

    // Flush remaining text
    if (fullText.trim().length > 0) {
      onSentence(fullText.trim());
    }

    console.warn('[Coach] Stream complete — total length:', collectedFullText.length);
    onComplete(collectedFullText);
  } catch (error) {
    console.warn('[Coach] Stream error:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
