import { describe, it, expect } from "vitest";
import {
  SearchResponseSchema,
  SearchHitSchema,
  ConnectionPathSchema,
  PersonProfileSchema,
  PathHopSchema,
} from "../src/api-client.js";

describe("API Client Schemas", () => {
  it("validates a valid search hit", () => {
    const hit = {
      source: "github",
      connection_linkedin_username: null,
      connection_first_name: "Sarah",
      connection_last_name: "Chen",
      connection_company: "Vercel",
      github_user_id: 12345,
      github_login: "sarahml",
      profile_headline: "Senior Engineer",
      profile_skills: ["React", "TypeScript"],
      topics: ["nextjs"],
      matched_on: "name",
    };
    expect(SearchHitSchema.parse(hit)).toEqual(hit);
  });

  it("validates a valid person profile", () => {
    const profile = {
      github_user_id: 12345,
      login: "sarahml",
      name: "Sarah Chen",
      bio: "Building things",
      company: "Vercel",
      location: "SF",
      avatar_url: "https://github.com/sarahml.png",
      followers: 100,
      following: 50,
      linkedin_username: "sarahchen",
      linkedin_headline: "Senior Engineer at Vercel",
      linkedin_skills: ["React"],
    };
    expect(PersonProfileSchema.parse(profile)).toEqual(profile);
  });

  it("validates a valid path hop", () => {
    const hop = {
      from_user_id: 1,
      to_user_id: 2,
      overlap_weight: 5,
      last_collab_at: "2024-01-01",
      edge_type: "github",
    };
    expect(PathHopSchema.parse(hop)).toEqual(hop);
  });

  it("validates a connection path", () => {
    const path = {
      from_user_id: 1,
      to_user_id: 3,
      hops: [
        {
          from_user_id: 1,
          to_user_id: 2,
          overlap_weight: 5,
          last_collab_at: null,
          edge_type: "github" as const,
        },
        {
          from_user_id: 2,
          to_user_id: 3,
          overlap_weight: 3,
          last_collab_at: "2024-06-15",
          edge_type: "linkedin" as const,
        },
      ],
      profiles: [
        {
          github_user_id: 1,
          login: "me",
          name: "Me",
          bio: null,
          company: null,
          location: null,
          avatar_url: null,
          followers: 0,
          following: 0,
          linkedin_username: null,
          linkedin_headline: null,
          linkedin_skills: [],
        },
        {
          github_user_id: 2,
          login: "alice",
          name: "Alice",
          bio: null,
          company: "ACME",
          location: null,
          avatar_url: null,
          followers: 10,
          following: 5,
          linkedin_username: "alice",
          linkedin_headline: "Engineer",
          linkedin_skills: ["Go"],
        },
        {
          github_user_id: 3,
          login: "bob",
          name: "Bob",
          bio: null,
          company: "Vercel",
          location: null,
          avatar_url: null,
          followers: 50,
          following: 20,
          linkedin_username: "bob",
          linkedin_headline: "CTO",
          linkedin_skills: ["React", "Node"],
        },
      ],
      total_hops: 2,
    };
    expect(ConnectionPathSchema.parse(path)).toEqual(path);
  });

  it("validates a full search response", () => {
    const response = {
      hits: [],
      paths: [],
      query: "test",
      offset: 0,
      limit: 25,
      total: 0,
      hasMore: false,
    };
    expect(SearchResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects invalid source in search hit", () => {
    const hit = {
      source: "twitter",
      connection_linkedin_username: null,
      connection_first_name: null,
      connection_last_name: null,
      connection_company: null,
      github_user_id: null,
      github_login: null,
      profile_headline: null,
      profile_skills: [],
      topics: [],
      matched_on: "name",
    };
    expect(() => SearchHitSchema.parse(hit)).toThrow();
  });

  it("rejects invalid edge_type in path hop", () => {
    const hop = {
      from_user_id: 1,
      to_user_id: 2,
      overlap_weight: 5,
      last_collab_at: null,
      edge_type: "twitter",
    };
    expect(() => PathHopSchema.parse(hop)).toThrow();
  });
});
