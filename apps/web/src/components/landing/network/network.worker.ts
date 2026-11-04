import { createNetwork, type Network, type Palette, type Size } from "./renderer";

/**
 * Runs the landing's network animation off the main thread. The page hands
 * over its canvas once; after that it only sends size, theme and play/pause,
 * so scrolling, typing and taps never wait on a frame being drawn.
 */
type Message =
  | { type: "init"; canvas: OffscreenCanvas; url: string; palette: Palette; size: Size; reduced: boolean; playing: boolean }
  | { type: "resize"; size: Size }
  | { type: "palette"; palette: Palette }
  | { type: "play" }
  | { type: "pause" };

const scope = self as unknown as { onmessage: ((e: MessageEvent<Message>) => void) | null; postMessage: (m: unknown) => void };
let net: Network | null = null;
// Messages that arrive while the data is still loading; the latest of each wins.
let pending: { size?: Size; palette?: Palette; playing: boolean } = { playing: false };

scope.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    pending.playing = m.playing;
    const data = await fetch(m.url).then((r) => r.json());
    net = createNetwork(m.canvas, data, {
      palette: pending.palette ?? m.palette,
      size: pending.size ?? m.size,
      reduced: m.reduced,
      onShow: (index) => scope.postMessage({ type: "show", index }),
      onReady: () => scope.postMessage({ type: "ready" }),
    });
    if (pending.playing) net.play();
    pending = { playing: false };
    return;
  }
  if (!net) {
    if (m.type === "resize") pending.size = m.size;
    else if (m.type === "palette") pending.palette = m.palette;
    else pending.playing = m.type === "play";
    return;
  }
  if (m.type === "resize") net.resize(m.size);
  else if (m.type === "palette") net.setPalette(m.palette);
  else if (m.type === "play") net.play();
  else net.pause();
};
