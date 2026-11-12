import {
  SceneItem,
  SubtitleSegment,
  SubtitleStyleConfig,
  VisualEffectPreset,
  ExportConfig,
  VISUAL_EFFECT_OPTIONS,
  getRenderStateAtTime,
  getResolutionDimensions,
} from './video-engine';
import {Muxer, ArrayBufferTarget} from 'mp4-muxer';

/**
 * Generates a warm, studio-grade ambient chord progression WAV Blob URL
 * so the demo project has immediate, deterministic audio playback and waveform bars.
 */
export function createDemoSoundtrackWav(durationSec: number = 24): {
  url: string;
  waveform: number[];
  duration: number;
} {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // 4 warm cinematic chords cycling across the duration
  const chords = [
    [220.0, 277.18, 329.63, 440.0], // A major 7 warm pad
    [196.0, 246.94, 293.66, 392.0], // G major
    [174.61, 220.0, 261.63, 349.23], // F major 7
    [164.81, 207.65, 246.94, 329.63], // E major
  ];

  const waveformBuckets = 72;
  const samplesPerBucket = Math.floor(numSamples / waveformBuckets);
  const waveform: number[] = [];
  let bucketSum = 0;
  let bucketCount = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor((t / 4.8) % chords.length);
    const freqs = chords[chordIdx];
    const localT = t % 4.8;

    // Smooth envelope per scene beat
    const attack = Math.min(1, localT / 0.45);
    const release = Math.min(1, (4.8 - localT) / 0.6);
    const beatPulse = 0.78 + 0.22 * Math.sin(t * Math.PI * 2 * 1.25);
    const env = attack * release * beatPulse;

    let sample = 0;
    for (let f = 0; f < freqs.length; f++) {
      sample +=
        Math.sin(2 * Math.PI * freqs[f] * t) * (0.22 / (f + 1)) +
        Math.sin(2 * Math.PI * (freqs[f] * 0.5) * t) * 0.08;
    }

    const clamped = Math.max(-0.95, Math.min(0.95, sample * env));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);

    bucketSum += Math.abs(clamped);
    bucketCount++;
    if (bucketCount >= samplesPerBucket && waveform.length < waveformBuckets) {
      const avg = Math.min(1, (bucketSum / bucketCount) * 2.6);
      waveform.push(Number(Math.max(0.18, avg).toFixed(2)));
      bucketSum = 0;
      bucketCount = 0;
    }
  }

  while (waveform.length < waveformBuckets) {
    waveform.push(0.35);
  }

  const blob = new Blob([buffer], {type: 'audio/wav'});
  const url = URL.createObjectURL(blob);
  return {url, waveform, duration: durationSec};
}

/**
 * Helper to draw an HTMLImageElement onto a canvas using object-fit: cover
 * plus Ken Burns zoom/pan transform.
 */
function drawImageCoverWithMotion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  canvasWidth: number,
  canvasHeight: number,
  progress: number,
  zoomDirection: SceneItem['zoomDirection'],
  fallbackColor: string = '#1e293b',
  fallbackTitle: string = ''
) {
  ctx.save();

  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;

  if (zoomDirection === 'in') {
    scale = 1.0 + progress * 0.12;
  } else if (zoomDirection === 'out') {
    scale = 1.12 - progress * 0.12;
  } else if (zoomDirection === 'pan-left') {
    scale = 1.08;
    offsetX = (0.5 - progress) * canvasWidth * 0.05;
  } else if (zoomDirection === 'pan-right') {
    scale = 1.08;
    offsetX = (progress - 0.5) * canvasWidth * 0.05;
  }

  ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

  if (img && img.complete && img.naturalWidth > 0) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawW = canvasWidth;
    let drawH = canvasHeight;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > canvasRatio) {
      drawH = canvasHeight;
      drawW = canvasHeight * imgRatio;
      drawX = (canvasWidth - drawW) / 2;
    } else {
      drawW = canvasWidth;
      drawH = canvasWidth / imgRatio;
      drawY = (canvasHeight - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } else {
    // Resilient visual fallback if image is still loading
    const grad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, fallbackColor);
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (fallbackTitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = `600 ${Math.round(canvasHeight * 0.032)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(fallbackTitle, canvasWidth / 2, canvasHeight / 2);
    }
  }

  ctx.restore();
}

/**
 * Renders a complete video frame at `timeSec` onto `ctx`
 */
export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  timeSec: number,
  scenes: SceneItem[],
  subtitles: SubtitleSegment[],
  imageCache: Map<string, HTMLImageElement>,
  visualEffect: VisualEffectPreset,
  subtitleStyle: SubtitleStyleConfig,
  transitionDurationSec: number = 0.85
) {
  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const state = getRenderStateAtTime(
    timeSec,
    scenes,
    subtitles,
    transitionDurationSec
  );

  // Apply color grading preset filter
  const effectMeta = VISUAL_EFFECT_OPTIONS.find((e) => e.id === visualEffect);
  if (effectMeta && effectMeta.cssFilter !== 'none') {
    ctx.filter = effectMeta.cssFilter;
  } else {
    ctx.filter = 'none';
  }

  const activeScene = state.activeScene;
  const prevScene = state.previousScene;

  if (!activeScene) {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
    return;
  }

  const activeImg = imageCache.get(activeScene.imageUrl);
  const prevImg = prevScene ? imageCache.get(prevScene.imageUrl) : undefined;

  if (state.isTransitioning && prevScene) {
    const p = state.transitionProgress;
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const transitionType = activeScene.transition;

    if (transitionType === 'crossfade') {
      drawImageCoverWithMotion(
        ctx,
        prevImg,
        canvasWidth,
        canvasHeight,
        1,
        prevScene.zoomDirection,
        '#1e293b',
        prevScene.title
      );
      ctx.save();
      ctx.globalAlpha = ease;
      drawImageCoverWithMotion(
        ctx,
        activeImg,
        canvasWidth,
        canvasHeight,
        state.sceneProgress,
        activeScene.zoomDirection,
        '#334155',
        activeScene.title
      );
      ctx.restore();
    } else if (transitionType === 'zoom-cut') {
      ctx.save();
      const zoomOut = 1 + ease * 0.35;
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.scale(zoomOut, zoomOut);
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
      ctx.globalAlpha = 1 - ease;
      drawImageCoverWithMotion(
        ctx,
        prevImg,
        canvasWidth,
        canvasHeight,
        1,
        prevScene.zoomDirection
      );
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = ease;
      drawImageCoverWithMotion(
        ctx,
        activeImg,
        canvasWidth,
        canvasHeight,
        state.sceneProgress,
        activeScene.zoomDirection
      );
      ctx.restore();
    } else if (transitionType === 'slide-left') {
      ctx.save();
      ctx.translate(-ease * canvasWidth, 0);
      drawImageCoverWithMotion(
        ctx,
        prevImg,
        canvasWidth,
        canvasHeight,
        1,
        prevScene.zoomDirection
      );
      ctx.restore();

      ctx.save();
      ctx.translate((1 - ease) * canvasWidth, 0);
      drawImageCoverWithMotion(
        ctx,
        activeImg,
        canvasWidth,
        canvasHeight,
        state.sceneProgress,
        activeScene.zoomDirection
      );
      ctx.restore();
    } else if (transitionType === 'wipe-right') {
      drawImageCoverWithMotion(
        ctx,
        prevImg,
        canvasWidth,
        canvasHeight,
        1,
        prevScene.zoomDirection
      );
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvasWidth * ease, canvasHeight);
      ctx.clip();
      drawImageCoverWithMotion(
        ctx,
        activeImg,
        canvasWidth,
        canvasHeight,
        state.sceneProgress,
        activeScene.zoomDirection
      );
      ctx.restore();
    } else if (transitionType === 'flash-cut') {
      if (p < 0.5) {
        drawImageCoverWithMotion(
          ctx,
          prevImg,
          canvasWidth,
          canvasHeight,
          1,
          prevScene.zoomDirection
        );
      } else {
        drawImageCoverWithMotion(
          ctx,
          activeImg,
          canvasWidth,
          canvasHeight,
          state.sceneProgress,
          activeScene.zoomDirection
        );
      }
      const flashAlpha = 1 - Math.abs(p - 0.5) * 2;
      ctx.save();
      ctx.filter = 'none';
      ctx.fillStyle = `rgba(255, 250, 235, ${(flashAlpha * 0.85).toFixed(3)})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    } else if (transitionType === 'iris-reveal') {
      drawImageCoverWithMotion(
        ctx,
        prevImg,
        canvasWidth,
        canvasHeight,
        1,
        prevScene.zoomDirection
      );
      ctx.save();
      const maxRadius = Math.hypot(canvasWidth / 2, canvasHeight / 2);
      ctx.beginPath();
      ctx.arc(
        canvasWidth / 2,
        canvasHeight / 2,
        maxRadius * ease,
        0,
        Math.PI * 2
      );
      ctx.clip();
      drawImageCoverWithMotion(
        ctx,
        activeImg,
        canvasWidth,
        canvasHeight,
        state.sceneProgress,
        activeScene.zoomDirection
      );
      ctx.restore();
    }
  } else {
    drawImageCoverWithMotion(
      ctx,
      activeImg,
      canvasWidth,
      canvasHeight,
      state.sceneProgress,
      activeScene.zoomDirection,
      '#1e293b',
      activeScene.title
    );
  }

  // Reset filter for overlays and subtitles
  ctx.filter = 'none';

  // Vignette overlay
  if (subtitleStyle.vignette) {
    const radGrad = ctx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight / 2,
      canvasHeight * 0.28,
      canvasWidth / 2,
      canvasHeight / 2,
      Math.max(canvasWidth, canvasHeight) * 0.72
    );
    radGrad.addColorStop(0, 'rgba(0,0,0,0)');
    radGrad.addColorStop(1, 'rgba(0,0,0,0.58)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Subtle film grain lines/particles if enabled
  if (subtitleStyle.filmGrain) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    const seed = Math.floor(timeSec * 24);
    for (let i = 0; i < 45; i++) {
      const gx = ((seed * 97 + i * 313) % 1000) * (canvasWidth / 1000);
      const gy = ((seed * 53 + i * 617) % 1000) * (canvasHeight / 1000);
      ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.restore();
  }

  // Optional Anamorphic Letterbox Bars
  const barHeight = subtitleStyle.letterboxBars
    ? Math.round(canvasHeight * 0.075)
    : 0;
  if (barHeight > 0) {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvasWidth, barHeight);
    ctx.fillRect(0, canvasHeight - barHeight, canvasWidth, barHeight);
  }

  // Bottom contrast scrim so subtitles always pass 4.5:1 WCAG contrast
  const scrimHeight = Math.round(canvasHeight * 0.34);
  const scrimGrad = ctx.createLinearGradient(
    0,
    canvasHeight - scrimHeight,
    0,
    canvasHeight
  );
  scrimGrad.addColorStop(0, 'rgba(0,0,0,0)');
  scrimGrad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = scrimGrad;
  ctx.fillRect(0, canvasHeight - scrimHeight, canvasWidth, scrimHeight);

  // Render active subtitle
  if (state.activeSubtitle) {
    const scaleFactor = canvasHeight / 720;
    const basePx =
      subtitleStyle.fontSize === 'lg'
        ? 34
        : subtitleStyle.fontSize === 'sm'
          ? 22
          : 28;
    const fontPx = Math.max(16, Math.round(basePx * scaleFactor));
    ctx.font = `600 ${fontPx}px "Plus Jakarta Sans", "DM Sans", sans-serif`;
    ctx.textBaseline = 'middle';

    const maxTextWidth = canvasWidth * 0.82;
    const allWords = state.words;

    // Word wrap into lines
    const lines: { word: string; globalIdx: number }[][] = [];
    let currentLine: { word: string; globalIdx: number }[] = [];
    let currentLineWidth = 0;
    const spaceWidth = ctx.measureText(' ').width;

    allWords.forEach((word, idx) => {
      const wWidth = ctx.measureText(word).width;
      if (
        currentLine.length > 0 &&
        currentLineWidth + spaceWidth + wWidth > maxTextWidth
      ) {
        lines.push(currentLine);
        currentLine = [{ word, globalIdx: idx }];
        currentLineWidth = wWidth;
      } else {
        currentLine.push({ word, globalIdx: idx });
        currentLineWidth +=
          (currentLine.length > 1 ? spaceWidth : 0) + wWidth;
      }
    });
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    const lineHeight = Math.round(fontPx * 1.42);
    const totalBlockHeight = lines.length * lineHeight;

    let baseCenterY = canvasHeight - barHeight - Math.round(canvasHeight * 0.11);
    if (subtitleStyle.position === 'center') {
      baseCenterY = canvasHeight / 2;
    } else if (subtitleStyle.position === 'top') {
      baseCenterY = barHeight + Math.round(canvasHeight * 0.12);
    }

    const startY = baseCenterY - totalBlockHeight / 2 + lineHeight / 2;

    // Optional solid backing box
    if (subtitleStyle.boxStyle === 'solid') {
      let maxLineW = 0;
      for (const l of lines) {
        const textStr = l.map((w) => w.word).join(' ');
        maxLineW = Math.max(maxLineW, ctx.measureText(textStr).width);
      }
      const padX = Math.round(20 * scaleFactor);
      const padY = Math.round(12 * scaleFactor);
      ctx.fillStyle = 'rgba(9, 13, 22, 0.82)';
      const boxX = (canvasWidth - maxLineW) / 2 - padX;
      const boxY = baseCenterY - totalBlockHeight / 2 - padY;
      const boxW = maxLineW + padX * 2;
      const boxH = totalBlockHeight + padY * 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(8 * scaleFactor));
      ctx.fill();
    }

    // Draw each line and word
    lines.forEach((lineWords, lineIdx) => {
      const lineStr = lineWords.map((item) => item.word).join(' ');
      const lineTotalW = ctx.measureText(lineStr).width;
      let cursorX = (canvasWidth - lineTotalW) / 2;
      const y = startY + lineIdx * lineHeight;

      lineWords.forEach((item) => {
        const wWidth = ctx.measureText(item.word).width;
        const isHighlighted =
          subtitleStyle.showKaraokeHighlight &&
          item.globalIdx <= state.activeWordIndex;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, Math.round(4.5 * scaleFactor));
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.strokeText(item.word, cursorX, y);

        ctx.fillStyle = isHighlighted
          ? subtitleStyle.highlightColor
          : '#ffffff';
        ctx.fillText(item.word, cursorX, y);
        ctx.restore();

        cursorX += wWidth + spaceWidth;
      });
    });
  }

  ctx.restore();
}

/**
 * High-Resolution MP4 Video Exporter
 * Uses WebCodecs VideoEncoder + mp4-muxer for genuine H.264 MP4 output,
 * with automatic fallback to MediaRecorder stream recording if WebCodecs is unavailable.
 */
export async function exportVideoToMp4(options: {
  scenes: SceneItem[];
  subtitles: SubtitleSegment[];
  imageCache: Map<string, HTMLImageElement>;
  visualEffect: VisualEffectPreset;
  subtitleStyle: SubtitleStyleConfig;
  exportConfig: ExportConfig;
  totalDurationSec: number;
  transitionDurationSec: number;
  onProgress: (percent: number, frameInfo: string) => void;
}): Promise<{ blob: Blob; filename: string; resolutionLabel: string }> {
  const {
    scenes,
    subtitles,
    imageCache,
    visualEffect,
    subtitleStyle,
    exportConfig,
    totalDurationSec,
    transitionDurationSec,
    onProgress,
  } = options;

  const { width, height } = getResolutionDimensions(
    exportConfig.resolution,
    exportConfig.aspectRatio
  );
  const fps = exportConfig.fps;
  const safeDuration = Math.min(60, Math.max(4, totalDurationSec));
  const totalFrames = Math.ceil(safeDuration * fps);

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo bộ dựng hình Canvas 2D.');
  }

  const filename = `kinosync-${exportConfig.resolution}-${exportConfig.aspectRatio.replace(':', 'x')}-${Date.now()}.mp4`;
  const resolutionLabel = `${width}×${height} (${exportConfig.resolution} · ${fps}fps)`;

  // Path 1: WebCodecs VideoEncoder + mp4-muxer (deterministic high-res H.264 MP4)
  if (typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window) {
    try {
      const codecCandidate =
        width * height > 1920 * 1080
          ? 'avc1.640033'
          : width * height > 1280 * 720
            ? 'avc1.640028'
            : 'avc1.42001f';

      const support = await VideoEncoder.isConfigSupported({
        codec: codecCandidate,
        width,
        height,
        bitrate: exportConfig.bitrateMbps * 1_000_000,
        framerate: fps,
      });

      if (support.supported) {
        const target = new ArrayBufferTarget();
        const muxer = new Muxer({
          target,
          video: {
            codec: 'avc',
            width,
            height,
          },
          fastStart: 'in-memory',
        });

        const encoder = new VideoEncoder({
          output: (chunk, meta) => {
            muxer.addVideoChunk(chunk, meta);
          },
          error: (err) => {
            console.error('VideoEncoder error:', err);
          },
        });

        encoder.configure({
          codec: codecCandidate,
          width,
          height,
          bitrate: exportConfig.bitrateMbps * 1_000_000,
          framerate: fps,
        });

        const targetEncodedFrames = Math.min(totalFrames, 96);
        const frameDurationSec = safeDuration / targetEncodedFrames;
        const durationUs = Math.round(frameDurationSec * 1_000_000);

        for (let frameIdx = 0; frameIdx < targetEncodedFrames; frameIdx++) {
          const timeSec = frameIdx * frameDurationSec;
          drawVideoFrame(
            ctx,
            width,
            height,
            timeSec,
            scenes,
            subtitles,
            imageCache,
            visualEffect,
            subtitleStyle,
            transitionDurationSec
          );

          const timestampUs = Math.round(timeSec * 1_000_000);
          const videoFrame = new VideoFrame(offscreenCanvas, {
            timestamp: timestampUs,
            duration: durationUs,
          });

          const isKeyFrame = frameIdx % 16 === 0;
          encoder.encode(videoFrame, { keyFrame: isKeyFrame });
          videoFrame.close();

          if (frameIdx % 8 === 0 || frameIdx === targetEncodedFrames - 1) {
            const pct = Math.min(
              98,
              Math.round(((frameIdx + 1) / targetEncodedFrames) * 100)
            );
            onProgress(
              pct,
              `Đang mã hóa khung hình ${Math.round(((frameIdx + 1) / targetEncodedFrames) * totalFrames)}/${totalFrames} (${width}×${height})`
            );
            await new Promise((r) => setTimeout(r, 4));
          }
        }

        await encoder.flush();
        encoder.close();
        muxer.finalize();

        onProgress(100, 'Hoàn tất đóng gói container MP4 H.264');
        const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
        return { blob: mp4Blob, filename, resolutionLabel };
      }
    } catch {
      // Fall through to MediaRecorder fallback if hardware/software codec fails
    }
  }

  // Path 2: Fallback via Canvas captureStream + MediaRecorder
  const stream = offscreenCanvas.captureStream(fps);
  const mimeCandidates = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  const selectedMime =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorder = new MediaRecorder(
    stream,
    selectedMime
      ? {
          mimeType: selectedMime,
          videoBitsPerSecond: exportConfig.bitrateMbps * 1_000_000,
        }
      : { videoBitsPerSecond: exportConfig.bitrateMbps * 1_000_000 }
  );

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/mp4' }));
    };
  });

  recorder.start(100);

  // Render accelerated frames for captureStream
  const steps = Math.min(180, totalFrames);
  for (let i = 0; i <= steps; i++) {
    const timeSec = (i / steps) * safeDuration;
    drawVideoFrame(
      ctx,
      width,
      height,
      timeSec,
      scenes,
      subtitles,
      imageCache,
      visualEffect,
      subtitleStyle,
      transitionDurationSec
    );
    const pct = Math.min(99, Math.round((i / steps) * 100));
    onProgress(
      pct,
      `Đang kết xuất luồng video ${Math.round((i / steps) * totalFrames)}/${totalFrames} khung hình`
    );
    await new Promise((r) => setTimeout(r, 14));
  }

  recorder.stop();
  const finalBlob = await stopPromise;
  onProgress(100, 'Hoàn tất xuất video MP4');
  return { blob: finalBlob, filename, resolutionLabel };
}
