/**
 * @noticed/cli — Public API
 *
 * Exports the API client, types, and MCP server for programmatic use.
 */

export {
  NoticedApiClient,
  createClientFromEnv,
  type ClientConfig,
  type SearchResponse,
  type SearchHit,
  type ConnectionPath,
  type PathHop,
  type PersonProfile,
  SearchResponseSchema,
  SearchHitSchema,
  ConnectionPathSchema,
  PathHopSchema,
  PersonProfileSchema,
} from "./api-client.js";

export { startMcpServer } from "./mcp-server.js";

export { VERSION } from "./version.js";
