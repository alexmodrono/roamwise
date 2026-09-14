// Vite bundles module workers and returns their emitted asset URL in both viewers.
declare module '*?worker&url' {
  const url: string;
  export default url;
}

declare module 'maplibre-gl/dist/maplibre-gl.css';
