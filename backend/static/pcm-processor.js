/**
 * AudioWorklet processor that captures PCM16 audio and sends it
 * to the main thread for WebSocket streaming.
 *
 * Buffers 2400 samples (~100ms at 24kHz) before sending to avoid
 * excessive WebSocket messages (would be ~187/sec without buffering).
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 2400; // ~100ms at 24kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const samples = input[0]; // Float32 mono channel
      for (let i = 0; i < samples.length; i++) {
        // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
        const s = Math.max(-1, Math.min(1, samples[i]));
        this.buffer.push(s < 0 ? s * 0x8000 : s * 0x7FFF);
      }

      if (this.buffer.length >= this.bufferSize) {
        const pcm16 = new Int16Array(this.buffer);
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
        this.buffer = [];
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
