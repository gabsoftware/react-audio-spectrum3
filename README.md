# React Audio Spectrum

> An audio spectrum visualizer for react.

## Getting Started

```
<audio id="audio-element"
  src="path/to/song.mp3"
  controls
>
</audio>
<AudioSpectrum
  id="audio-canvas"
  height={200}
  width={300}
  audioId={'audio-element'}
  capColor={'red'}
  capHeight={2}
  meterWidth={2}
  meterCount={512}
  meterColor={[
    {stop: 0, color: '#4CAF40'},
    {stop: 0.5, color: '#0CD7FD'},
    {stop: 1, color: '#000'}
  ]}
  gap={4}
/>
```

### you can also pass the audio element itself to the component

```
this.audioEle = new Audio('path/to/your/song.mp3)
<AudioSpectrum
  id="audio-canvas"
  height={200}
  width={300}
  audioEle={this.audioEle}
/>
```

if you use both `audioId` and `audioEle` props, the component will ignore `audioEle`.

## Props

| property   | description                    | type          | default                                                                          |
| ---------- | ------------------------------ | ------------- | -------------------------------------------------------------------------------- |
| id         | canvas id                      | number/string | a random string                                                                  |
| width      | canvas width                   | number        | 300                                                                              |
| height     | canvas height                  | number        | 200                                                                              |
| audioId    | id of the target audio element | number/string | -                                                                                |
| audioEle   | target audio element           | audio object  | -                                                                                |
| capColor   | color of caps                  | string        | #FFF                                                                             |
| capHeight  | height of caps                 | string        | 2                                                                                |
| meterWidth | width of meters                | number        | 2                                                                                |
| meterColor | color of meters                | string/array  | [{stop: 0, color: '#f00'},{stop: 0.5, color: '#0CD7FD'},{stop: 1, color: 'red'}] |
| gap        | gap between meters             | number        | 10                                                                               |
