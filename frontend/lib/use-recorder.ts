"use client";

import { useRef, useState, useCallback } from "react";

const CHUNK_DURATION_MS = 10_000;

export type RecorderState = "idle" | "recording" | "stopping";

export type RecordingOptions = {
  recordScreen: boolean;
  recordMic: boolean;
  micDeviceId?: string;
  systemAudioDeviceId?: string;
};

export function useRecorder(onChunk: (blob: Blob) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const start = useCallback(
    async (options: RecordingOptions = { recordScreen: true, recordMic: true }) => {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();
      const streams: MediaStream[] = [];
      let hasAudioSource = false;

      if (options.recordScreen) {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streams.push(displayStream);
        const displayAudioTracks = displayStream.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          const displaySource = audioCtx.createMediaStreamSource(new MediaStream(displayAudioTracks));
          displaySource.connect(destination);
          hasAudioSource = true;
        }
      }

      if (options.recordMic) {
        const micConstraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true };
        if (options.micDeviceId) micConstraints.deviceId = { exact: options.micDeviceId };
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints });
        streams.push(micStream);
        audioCtx.createMediaStreamSource(micStream).connect(destination);
        hasAudioSource = true;
      }

      if (options.systemAudioDeviceId) {
        const systemStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: options.systemAudioDeviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        streams.push(systemStream);
        audioCtx.createMediaStreamSource(systemStream).connect(destination);
        hasAudioSource = true;
      }

      if (!hasAudioSource) throw new Error("No audio source available.");

      const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
      let chunks: BlobPart[] = [];

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (blob.size > 0) onChunk(blob);
        chunks = [];
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start();
      setState("recording");

      intervalRef.current = setInterval(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          recorder.start();
        }
      }, CHUNK_DURATION_MS);

      mediaRecorderRef.current = recorder;
      streamsRef.current = streams;

      if (options.recordScreen && streams[0]) {
        const videoTrack = streams[0].getVideoTracks()[0];
        if (videoTrack) videoTrack.onended = () => stop();
      }
    },
    [onChunk]
  );

  const stop = useCallback(() => {
    setState("stopping");
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    for (const stream of streamsRef.current) for (const track of stream.getTracks()) track.stop();
    streamsRef.current = [];
    mediaRecorderRef.current = null;
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setState("idle");
  }, []);

  return { state, start, stop };
}
