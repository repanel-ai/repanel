/**
 * What jsdom does not implement.
 *
 * `<dialog>` is how a modal is built here — the browser owns the top layer, the
 * backdrop, the focus trap and the escape key, and none of that is worth
 * writing again. jsdom has the element but not `showModal`/`close`, so a spec
 * that opens one would fail on the environment rather than on the component.
 *
 * The stand-in does the two things a spec can observe: the `open` attribute,
 * and the `close` event that a caller's own `.close()` fires.
 */
const dialog = globalThis.HTMLDialogElement?.prototype;

if (dialog && typeof dialog.showModal !== "function") {
  dialog.showModal = function showModal(this: HTMLDialogElement): void {
    this.open = true;
  };
  dialog.show = function show(this: HTMLDialogElement): void {
    this.open = true;
  };
  dialog.close = function close(this: HTMLDialogElement, returnValue?: string): void {
    if (!this.open) return;
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}

/**
 * The floating panel under a combobox is positioned by Radix, which watches the
 * anchor with a `ResizeObserver`. jsdom has no such thing, so a spec that opens
 * one would fail on the environment rather than on the component. Nothing here
 * measures anything: no spec asserts where the panel landed, only what is in it.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
