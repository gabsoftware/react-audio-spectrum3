import React from "react";

type MeterColor = {
  stop: number;
  color: React.CSSProperties["color"];
};

export type AudioSpectrumProps = {
  id: string;
  width: number;
  height: number;
  audioId?: string;
  audioEle?: HTMLAudioElement;
  capColor: React.CSSProperties["color"];
  capHeight: number;
  meterWidth: number;
  meterCount: number;
  meterColor: string | MeterColor[];
  gap: number;
} & React.HTMLProps<HTMLCanvasElement>;

type PlayStatus = "PAUSED" | "PLAYING";

const defaultProps = {
  width: 300,
  height: 200,
  capColor: "#FFF",
  capHeight: 2,
  meterWidth: 2,
  meterCount: 40 * (2 + 2),
  meterColor: [
    { stop: 0, color: "#f00" },
    { stop: 0.5, color: "#0CD7FD" },
    { stop: 1, color: "red" },
  ],
  gap: 10,
};

function getRandomId(len: number) {
  const str = "1234567890-qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";

  return Array.from({ length: len }).reduce(
    (acc: string) => acc.concat(str[Math.floor(Math.random() * str.length)]),
    ""
  );
}

export default function AudioSpectrum({
  width = defaultProps.width,
  height = defaultProps.height,
  capColor = defaultProps.capColor,
  capHeight = defaultProps.capHeight,
  meterWidth = defaultProps.meterWidth,
  meterCount = defaultProps.meterCount,
  meterColor = defaultProps.meterColor,
  gap = defaultProps.gap,
  id = getRandomId(50),
  audioEle: propsAudioEl,
  audioId,
  ...restProps
}: AudioSpectrumProps) {
  const animationId = React.useRef<number | null>(null);
  const canvasId = id;
  const audioContext = React.useRef<AudioContext | null>(null);
  const audioCanvas = React.useRef<HTMLCanvasElement | null>(null);
  const playStatus = React.useRef<PlayStatus | null>(null);
  const mediaEleSource = React.useRef<MediaElementAudioSourceNode | null>(null);
  const analyser = React.useRef<AnalyserNode | null>(null);
  const audioEle = React.useRef<HTMLAudioElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const prepareElements = React.useCallback(() => {
    if (!audioId && !propsAudioEl) {
      console.error("Target audio not found.");
      return;
    }
    if (audioId) {
      audioEle.current = document.getElementById(audioId) as HTMLAudioElement;
    } else if (propsAudioEl) {
      audioEle.current = propsAudioEl;
    }
    audioCanvas.current = canvasRef.current;
  }, [audioId, propsAudioEl]);

  const drawSpectrum = React.useCallback(
    (currentAnalyser: AnalyserNode) => {
      const cWidth = audioCanvas.current!.width;
      const cHeight = audioCanvas.current!.height - capHeight;
      const capYPositionArray: number[] = [];
      const ctx = audioCanvas.current!.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);

      if (Array.isArray(meterColor)) {
        const stops = meterColor;
        stops.forEach((stop) => {
          gradient.addColorStop(stop.stop, stop.color as string);
        });
      } else if (typeof meterColor === "string") {
        gradient.addColorStop(0, meterColor);
      }

      const drawMeter = () => {
        const array = new Uint8Array(currentAnalyser.frequencyBinCount);
        currentAnalyser.getByteFrequencyData(array);
        if (playStatus.current === "PAUSED") {
          array.fill(0);
          const allCapsReachBottom = !capYPositionArray.some((cap) => cap > 0);
          if (allCapsReachBottom) {
            ctx.clearRect(0, 0, cWidth, cHeight + capHeight);
            cancelAnimationFrame(animationId.current!);
            return;
          }
        }
        const step = Math.round(array.length / meterCount);
        ctx.clearRect(0, 0, cWidth, cHeight + capHeight);
        for (let i = 0; i < meterCount; i++) {
          const value = array[i * step];
          if (capYPositionArray.length < Math.round(meterCount)) {
            capYPositionArray.push(value);
          }
          ctx.fillStyle = capColor;

          if (value < capYPositionArray[i]) {
            const preValue = --capYPositionArray[i];
            const y = ((270 - preValue) * cHeight) / 270;
            ctx.fillRect(i * (meterWidth + gap), y, meterWidth, capHeight);
          } else {
            const y = ((270 - value) * cHeight) / 270;
            ctx.fillRect(i * (meterWidth + gap), y, meterWidth, capHeight);
            capYPositionArray[i] = value;
          }
          ctx.fillStyle = gradient;
          const y = ((270 - value) * cHeight) / 270 + capHeight;
          ctx.fillRect(i * (meterWidth + gap), y, meterWidth, cHeight);
        }
        animationId.current = requestAnimationFrame(drawMeter);
      };
      animationId.current = requestAnimationFrame(drawMeter);
    },
    [capColor, capHeight, gap, meterColor, meterCount, meterWidth]
  );

  const setupAudioNode = React.useCallback(
    (currentAudioEle: HTMLAudioElement) => {
      if (!currentAudioEle) {
        throw new Error("Audio element is not found");
      }
      if (!analyser.current && audioContext.current) {
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.smoothingTimeConstant = 0.8;
        analyser.current.fftSize = 2048;
      }

      if (!mediaEleSource.current && audioContext.current && analyser.current) {
        mediaEleSource.current =
          audioContext.current.createMediaElementSource(currentAudioEle);
        mediaEleSource.current.connect(analyser.current);
        mediaEleSource.current.connect(audioContext.current.destination);
      }

      return analyser;
    },
    []
  );

  const prepareAPIs = React.useCallback(() => {
    try {
      audioContext.current = new window.AudioContext(); // 1.set audioContext
    } catch (e) {
      console.error("!Your browser does not support AudioContext");
      console.error(e);
    }
  }, []);
  const initAudioEvents = React.useCallback(() => {
    if (audioEle.current) {
      audioEle.current.onpause = () => {
        playStatus.current = "PAUSED";
      };
      audioEle.current.onplay = () => {
        playStatus.current = "PLAYING";
        prepareAPIs();
        const currentAnalyser = setupAudioNode(audioEle.current!);
        drawSpectrum(currentAnalyser.current!);
      };
    }
  }, [drawSpectrum, prepareAPIs, setupAudioNode]);

  React.useEffect(() => {
    prepareElements();
    initAudioEvents();
  }, [prepareElements, initAudioEvents]);

  return (
    <canvas
      ref={canvasRef}
      id={canvasId}
      width={width}
      height={height}
      {...restProps}
    />
  );
}
