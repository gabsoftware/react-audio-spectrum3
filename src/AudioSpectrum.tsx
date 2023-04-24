import React, { useState, useEffect, useRef, useCallback } from "react";

type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};
type NonUndefined<T> = T extends undefined ? never : T;

type MeterColor = {
    stop: number;
    color: NonUndefined<React.CSSProperties["color"]>;
};
export type TAudioSpectrumProps = {
    audioId?: string;
    audioEle?: HTMLAudioElement;
    capColor?: React.CSSProperties["color"];
    capHeight?: number;
    meterWidth: number;
    meterCount: number;
    meterColor: string | MeterColor[];
    gap: number;
    /**
     * @IntRange 0 - 1
     */
    smoothingTimeConstant?: number;
    /**
     * @IntRange 32 - 32768, must be power of 2
     */
    fftSize?: number;
    disableCap?: boolean;
    audioContext?: AudioContext
} & React.HTMLProps<HTMLCanvasElement>;

type PlayStatus = "PAUSED" | "PLAYING";

const defaultProps: WithRequiredProperty<TAudioSpectrumProps,
    'width' | 'height' | 'capColor' | 'capHeight' |
    'meterWidth' | 'meterCount' | 'meterColor' |
    'gap' | 'disableCap' |
    'smoothingTimeConstant' | 'fftSize'> = {
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
    smoothingTimeConstant: 0.8,
    fftSize: 2048,
    disableCap: false
};

function getRandomId(len: number) {
    const str = "1234567890-qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";

    return Array.from({ length: len }).reduce(
        (acc: string) => acc.concat(str[Math.floor(Math.random() * str.length)]),
        ""
    );
}

const AudioSpectrum = ( props: TAudioSpectrumProps ) => {

    const {
        width      = defaultProps.width,
        height     = defaultProps.height,
        capColor   = defaultProps.capColor,
        capHeight  = defaultProps.capHeight,
        meterWidth = defaultProps.meterWidth,
        meterCount = defaultProps.meterCount,
        meterColor = defaultProps.meterColor,
        fftSize    = defaultProps.fftSize,
        smoothingTimeConstant = defaultProps.smoothingTimeConstant,
        disableCap = defaultProps.disableCap,
        gap        = defaultProps.gap,
        id         = getRandomId(50),
        audioEle,
        audioId,
        audioContext,
        ...restProps
    } = props;

    const canvasId        = id;
    const analyser        = useRef<AnalyserNode | null>(null);
    const audioEleRef     = useRef<HTMLAudioElement | null>(null);
    const canvasRef       = useRef<HTMLCanvasElement | null>(null);
    const playStatus      = useRef<PlayStatus | null>(null);
    const animationId     = useRef<number | null>(null);
    const audioCanvas     = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaEleSource  = useRef<MediaElementAudioSourceNode | null>(null);

    const prepareElements = useCallback(() => {
        if (!audioId && !audioEle) {
            console.error("Target audio not found.");
            return;
        }
        if (audioId) {
            audioEleRef.current = document.getElementById(audioId) as HTMLAudioElement | null;
        }
        else if (audioEle) {
            audioEleRef.current = audioEle;
        }
        audioCanvas.current = canvasRef.current;
    }, [audioId, audioEle]);

    const drawSpectrum = useCallback( (currentAnalyser: AnalyserNode) => {

        if( ! audioCanvas.current ) {
            console.error("Canvas not found.");
            return;
        }

        const cWidth = audioCanvas.current.width;
        const cHeight = audioCanvas.current.height - capHeight;
        const capYPositionArray: number[] = [];
        const ctx = audioCanvas.current.getContext("2d");

        if( ! ctx ) {
            console.error("Canvas 2D context not found.");
            return;
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);

        // Detection of color as array or color as string
        if (Array.isArray(meterColor)) {
            const stops = meterColor;
            stops.forEach((stop) => {
                gradient.addColorStop(stop.stop, stop.color);
            });
        }
        else if (typeof meterColor === "string") {
            gradient.addColorStop(0, meterColor);
        }

        const drawMeter = () => {
            /*
              frequencyBinCount is an unsigned integer half that of the fftSize.
              This generally equates to the number of data values you will have
              to play with for the visualization.
      
              DO NOT LOG THIS OR MANIPULATE. IT WILL CAUSE THE BROWSER TO CRASH
            */
            const array = new Uint8Array(currentAnalyser.frequencyBinCount);
            /*
              getByteFrequencyData() copies the current frequency data into a
              Uint8Array (unsigned byte array) passed into it.
              - Frequency data is integer scale of 0 to 255. -
              
              Each item in the array represents the decibel value for a specific frequency.
              The frequencies are spread linearly from 0 to 1/2 of the sample rate.
      
              For example, for 48000 sample rate, the last item of the array
              will represent the decibel value for 24000 Hz.
      
              If the array has fewer elements than the `frequencyBinCount`, excess
              elements are dropped. If it has more elements than needed,
              excess elements are ignored.
            */
            currentAnalyser.getByteFrequencyData(array);

            if (playStatus.current === "PAUSED") {
                array.fill(0);
                const allCapsReachBottom = !capYPositionArray.some((cap) => cap > 0);
                if (allCapsReachBottom && typeof animationId.current === "number" ) {
                    ctx.clearRect(0, 0, cWidth, cHeight + capHeight);
                    cancelAnimationFrame(animationId.current);
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
                    if (disableCap) {
                        ctx.fillRect(i * (meterWidth + gap), y, meterWidth, 0);
                    }
                    else {
                        ctx.fillRect(i * (meterWidth + gap), y, meterWidth, capHeight);
                    }
                } else {
                    const y = ((270 - value) * cHeight) / 270;
                    if (disableCap) {
                        ctx.fillRect(i * (meterWidth + gap), y, meterWidth, 0);
                        capYPositionArray[i] = 0;
                    }
                    else {
                        ctx.fillRect(i * (meterWidth + gap), y, meterWidth, capHeight);
                        capYPositionArray[i] = value;
                    }
                }
                ctx.fillStyle = gradient;
                const y = ((270 - value) * cHeight) / 270 + capHeight;
                ctx.fillRect(i * (meterWidth + gap), y, meterWidth, cHeight);
            }
            animationId.current = requestAnimationFrame(drawMeter);
        };
        animationId.current = requestAnimationFrame(drawMeter);
    }, [capColor, capHeight, disableCap, gap, meterColor, meterCount, meterWidth] );

    const setupAudioNode = useCallback( (currentAudioEle: HTMLAudioElement) => {
        if (!currentAudioEle) {
            throw new Error("Audio element is not found");
        }
        if (!analyser.current && audioContextRef.current) {
            analyser.current = audioContextRef.current.createAnalyser();

            /*
              Smoothing time constant is, essentially, an average
              between the current buffer and the last buffer the AnalyserNode processed,
              and results in a much smoother set of value changes over time.
              
              Minimum = 0
              Maximum = 1
              (For panic inducing bounce, try 0.1)
            */
            analyser.current.smoothingTimeConstant = smoothingTimeConstant;
            /*
              1,024 samples (1k) is a pretty common frame size for an audio FFT.
              At a sample rate of 44.1 kHz, 1,024 samples is about 0.022 second of sound.
      
              Minimum = 32
              Maximum = 32768
      
              1024 and 2048 Seem to be a good sweet spot for
              general smoothness but active Audiospectrum bounce.
            */
            analyser.current.fftSize = fftSize;
        }

        if (!mediaEleSource.current && audioContextRef.current && analyser.current) {
            mediaEleSource.current =
                audioContextRef.current.createMediaElementSource(currentAudioEle);
            mediaEleSource.current.connect(analyser.current);
            mediaEleSource.current.connect(audioContextRef.current.destination);
        }

        return analyser;
    }, [fftSize, smoothingTimeConstant] );

    const prepareAPIs = useCallback(() => {
        try {
            audioContextRef.current = audioContext || new window.AudioContext();
        }
        catch (e) {
            console.error("Your browser does not support AudioContext");
            console.error(e);
        }
    }, [audioContext]);

    // Retain old value to compare
    const [meterColorState, setMeterColorState] = useState(meterColor);

    const initAudioEvents = useCallback( () => {
        if (audioEleRef.current ) {
            audioEleRef.current.onpause = () => {
                playStatus.current = "PAUSED";
            };
            audioEleRef.current.onplay = () => {
                playStatus.current = "PLAYING";
                prepareAPIs();
                if( audioEleRef.current ) {
                    const currentAnalyser = setupAudioNode(audioEleRef.current);
                    if( currentAnalyser.current ) {
                        drawSpectrum(currentAnalyser.current);
                    }
                }
            };
        }
    }, [drawSpectrum, prepareAPIs, setupAudioNode] );

    useEffect(() => {
        // State keeps track of old color, won't update from original color unless user changes.
        if (meterColor !== meterColorState) {
            setMeterColorState(meterColor);
        }
        prepareElements();
        initAudioEvents();
    }, [
        prepareElements,
        initAudioEvents,
        meterColor,
        meterColorState
    ]);

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

export default AudioSpectrum;