import { NextRequest, NextResponse } from 'next/server';
import { generateFakeWaveform } from '@/lib/editor/utils/waveform-generator';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, annotationId } = await request.json();

    if (!text || !voiceId || !annotationId) {
      return NextResponse.json(
        { error: 'Missing required fields: text, voiceId, annotationId' },
        { status: 400 }
      );
    }

    // TODO: Replace with real TTS API (ElevenLabs, Google Cloud, etc.)
    // For now, generate mock data for demo
    const durationMs = Math.max(text.length * 50, 2000); // ~50ms per char
    const durationSeconds = durationMs / 1000;
    const waveformPeaks = generateFakeWaveform(durationSeconds, 0, 100);

    // Create a simple WAV audio data URL with procedural content
    // This generates a sine wave that matches the waveformPeaks for visual feedback
    // In production, this would be the actual TTS-generated audio
    const sampleRate = 44100;
    const numSamples = Math.round(durationSeconds * sampleRate);
    const frequency = 440; // A4 note
    const audioBuffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const peakIndex = Math.min(Math.floor((t / durationSeconds) * waveformPeaks.length), waveformPeaks.length - 1);
      const amplitude = waveformPeaks[peakIndex] * 0.3; // Scale to 0-0.3 to avoid clipping
      audioBuffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    }

    // Convert Float32Array to WAV format
    const wavData = encodeWAV(audioBuffer, sampleRate);
    const mockAudioUrl = `data:audio/wav;base64,${btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(wavData))))}`;

    function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      const writeFloat32 = (offset: number, value: number) => {
        view.setFloat32(offset, value, true);
      };
      const writeUint32 = (offset: number, value: number) => {
        view.setUint32(offset, value, true);
      };
      const writeUint16 = (offset: number, value: number) => {
        view.setUint16(offset, value, true);
      };

      writeString(0, 'RIFF');
      writeUint32(4, 36 + samples.length * 2);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      writeUint32(16, 16);
      writeUint16(20, 1);
      writeUint16(22, 1);
      writeUint32(24, sampleRate);
      writeUint32(28, sampleRate * 2);
      writeUint16(32, 2);
      writeUint16(34, 16);
      writeString(36, 'data');
      writeUint32(40, samples.length * 2);

      let offset = 44;
      for (let i = 0; i < samples.length; i++) {
        view.setInt16(offset, Math.max(-1, Math.min(1, samples[i])) * 0x7FFF, true);
        offset += 2;
      }

      return buffer;
    }

    return NextResponse.json({
      audioUrl: mockAudioUrl,
      waveformPeaks,
      durationMs,
      transcript: text, // In production, this would be from STT
    });
  } catch (error) {
    console.error('Error generating narration:', error);
    return NextResponse.json(
      { error: 'Failed to generate narration' },
      { status: 500 }
    );
  }
}
