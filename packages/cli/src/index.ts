/**
 * The RePanel CLI as a library: the assembler, and the attribution that lets a
 * problem in the composed definition be reported in the file that wrote it.
 * `repanel dev` and `repanel deploy` assemble through exactly this surface.
 */
export {
  assembleDefinition,
  DEFINITION_DIRECTORY,
  type AssembledDefinition,
} from "./assemble/assemble.js";
export { AssemblyError } from "./assemble/errors.js";
export { locate, type DefinitionSource, type SourceLocation } from "./assemble/sources.js";
