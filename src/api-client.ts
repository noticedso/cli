/**
 * API client for the noticed search API.
 * All CLI and MCP commands go through this client.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas (source of truth for both CLI output and MCP tool results)
// ---------------------------------------------------------------------------

export const PersonProfileSchema = z.object({
  github_user_id: z.number(),
  login: z.string().nullable(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  avatar_url: z.string().nullable(),
  followers: z.number(),
  following: z.number(),
  linkedin_username: z.string().nullable(),
  linkedin_headline: z.string().nullable(),
  linkedin_skills: z.array(z.string()),
});
export type PersonProfile = z.infer<typeof PersonProfileSchema>;

export const PathHopSchema = z.object({
  from_user_id: z.number(),
  to_user_id: z.number(),
  overlap_weight: z.number(),
  last_collab_at: z.string().nullable(),
  edge_type: z.enum(["github", "linkedin"]),
});
export type PathHop = z.infer<typeof PathHopSchema>;

export const ConnectionPathSchema = z.object({
  from_user_id: z.number(),
  to_user_id: z.number(),
  hops: z.array(PathHopSchema),
  profiles: z.array(PersonProfileSchema),
  total_hops: z.number(),
});
export type ConnectionPath = z.infer<typeof ConnectionPathSchema>;

export const SearchHitSchema = z.object({
  source: z.enum(["linkedin", "github"]),
  connection_linkedin_username: z.string().nullable(),
  connection_first_name: z.string().nullable(),
  connection_last_name: z.string().nullable(),
  connection_company: z.string().nullable(),
  github_user_id: z.number().nullable(),
  github_login: z.string().nullable(),
  profile_headline: z.string().nullable(),
  profile_skills: z.array(z.string()),
  topics: z.array(z.string()),
  matched_on: z.string(),
  relevance_score: z.number().optional(),
  github_followers: z.number().optional(),
  github_public_repos: z.number().optional(),
  linkedin_connections_count: z.number().optional(),
  linkedin_follower_count: z.number().optional(),
  linkedin_experiences: z
    .array(z.object({ company: z.string(), title: z.string() }))
    .optional(),
  linkedin_educations: z
    .array(z.object({ school: z.string(), degree: z.string() }))
    .optional(),
  tags: z
    .array(
      z.object({
        tag: z.string(),
        category: z.string(),
        confidence: z.number(),
      }),
    )
    .optional(),
  ai_tools: z.array(z.string()).optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  languages: z.array(z.string()).optional(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchResponseSchema = z.object({
  hits: z.array(SearchHitSchema),
  paths: z.array(ConnectionPathSchema),
  query: z.string(),
  offset: z.number(),
  limit: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class NoticedApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  private async fetch(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `API error ${res.status}: ${res.statusText}${body ? ` — ${body}` : ""}`,
      );
    }

    return res.json();
  }

  /**
   * Search the owner's network for people matching a query.
   */
  async search(query: string, options?: {
    limit?: number;
    offset?: number;
    paths?: boolean;
    sort?: string;
    source?: string;
  }): Promise<SearchResponse> {
    const raw = await this.fetch("/api/search", {
      q: query,
      limit: String(options?.limit ?? 25),
      offset: String(options?.offset ?? 0),
      paths: options?.paths === false ? "false" : "true",
      sort: options?.sort ?? "",
      source: options?.source ?? "",
    });
    return SearchResponseSchema.parse(raw);
  }

  async hydrate(hits: SearchHit[]): Promise<SearchHit[]> {
    const url = new URL(`${this.baseUrl}/api/search/hydrate`);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ hits }),
    });
    if (!res.ok) return hits; // fallback to unhyrated
    const data = (await res.json()) as { hits: unknown[] };
    return z.array(SearchHitSchema).parse(data.hits);
  }
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function createClientFromEnv(): NoticedApiClient {
  const baseUrl = process.env["NOTICED_API_URL"] ?? process.env["NOTICED_BASE_URL"];
  const apiKey = process.env["NOTICED_API_KEY"];

  if (!baseUrl) {
    throw new Error(
      "Missing NOTICED_API_URL or NOTICED_BASE_URL environment variable.\n" +
        "Set it to the URL of your noticed instance (e.g. https://noticed.so).",
    );
  }
  if (!apiKey) {
    throw new Error(
      "Missing NOTICED_API_KEY environment variable.\n" +
        "Create an API key in your noticed dashboard.",
    );
  }

  return new NoticedApiClient({ baseUrl, apiKey });
}
