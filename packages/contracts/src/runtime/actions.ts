/**
 * What running an action came to.
 *
 * Only a success has a body. Every failure is the error envelope, so a caller
 * has one thing to branch on rather than two — and a `dbUpdate` that matched no
 * row, an endpoint that refused, and an endpoint that never answered are all
 * told apart by the envelope's `code`.
 *
 * The label is the definition's own, echoed back so the acknowledgement an
 * operator reads is worded the way the button they pressed was.
 */
export interface ActionResultDto {
  ok: true;
  label: string;
}
