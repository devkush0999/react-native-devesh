import Constants from 'expo-constants';
import type { LLMModel } from 'react-native-executorch';
import { LocalAIEngine } from './engine.core';
import { performanceMonitor } from '../performance/monitor';

let model: LLMModel | null = null;
export const engine = new LocalAIEngine({
  async prepare(signal, onProgress) {
    if (Constants.appOwnership === 'expo') throw new Error('A development build is required.');
    const runtime = await import('react-native-executorch');
    runtime.setTelemetryEnabled(false);
    model = await runtime.download(runtime.models.llm.QWEN3_0_6B.XNNPACK_8DA4W, {
      signal,
      onProgress,
    });
  },
  async create(system) {
    if (!model) throw new Error('Download the model first.');
    const { createLLMChatSession } = await import('react-native-executorch');
    const session = await createLLMChatSession(model, {
      initialMessages: [{ role: 'system', content: system }],
      generationConfig: { temperature: 0.3, maxNewTokens: 600 },
    });
    return {
      async send(prompt, onToken) {
        const result = await session.sendMessage(prompt, onToken);
        const last = result.messages.filter((message) => message.role === 'assistant').at(-1);
        if (!last || typeof last.content !== 'string' || !last.content.trim())
          throw new Error('Empty response');
        return last.content;
      },
      stop: () => session.stop(),
      dispose: () => session.dispose(),
    };
  },
}, performanceMonitor);

performanceMonitor.setCancelAI(engine.cancel);
