/**
 * The version of the wire contract this package defines.
 *
 * It is not `SCHEMA_VERSION`. That one versions the definition schema — the
 * public product contract a customer's agent writes against, which moves
 * additively and rarely. This one versions the shapes RePanel's own surfaces
 * exchange with each other: the runtime request schemas, the DTOs answered out
 * of them, and the connector frames built from both. It moves whenever one of
 * those changes in a way two builds could disagree about.
 *
 * The connector is the one place where two builds really can disagree: Cloud is
 * deployed and a connector is installed, and nothing makes them the same age.
 * So the connector states this on its way in and Cloud compares it for exact
 * equality — there is no forward compatibility to negotiate here, and a
 * connector that half-understands a frame is worse than one that is turned away
 * (DECISIONS #064).
 */
export const CONTRACTS_VERSION = "0.1.0";
