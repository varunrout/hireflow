import { describe, it, expect } from "vitest";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  CandidateProfileSchema,
  WorkExperienceSchema,
  JobPostingSchema,
  ApplicationSchema,
  ApplicationStatusSchema,
  ResumeVersionSchema,
} from "../index";

describe("Auth schemas", () => {
  it("validates a valid register request", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "test@example.com",
      password: "SecurePass1",
      full_name: "Jane Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects weak password", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "test@example.com",
      password: "weak",
      full_name: "Jane Doe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "not-an-email",
      password: "SecurePass1",
      full_name: "Jane Doe",
    });
    expect(result.success).toBe(false);
  });
});

describe("Profile schemas", () => {
  it("validates a full candidate profile", () => {
    const result = CandidateProfileSchema.safeParse({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      headline: "Senior Software Engineer",
      work_experiences: [],
      education: [],
      projects: [],
      certifications: [],
      skills: [],
    });
    expect(result.success).toBe(true);
  });

  it("validates work experience with valid dates", () => {
    const result = WorkExperienceSchema.safeParse({
      company: "Acme Corp",
      title: "Engineer",
      start_date: "2020-01",
      is_current: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects work experience with invalid date format", () => {
    const result = WorkExperienceSchema.safeParse({
      company: "Acme Corp",
      title: "Engineer",
      start_date: "01/2020",
      is_current: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("Job schemas", () => {
  it("validates a job posting", () => {
    const result = JobPostingSchema.safeParse({
      title: "Senior Software Engineer",
      company: "TechCorp",
      description: "We are looking for a senior engineer...",
      source: "linkedin",
    });
    expect(result.success).toBe(true);
  });
});

describe("Application schemas", () => {
  it("validates application status transitions", () => {
    const statuses = [
      "saved", "applied", "screening", "phone_interview",
      "technical_interview", "onsite_interview", "offer",
      "rejected", "withdrawn", "accepted"
    ];
    statuses.forEach((status) => {
      const result = ApplicationStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid application status", () => {
    const result = ApplicationStatusSchema.safeParse("ghosted");
    expect(result.success).toBe(false);
  });
});

describe("Resume schemas", () => {
  it("validates a resume version", () => {
    const result = ResumeVersionSchema.safeParse({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      profile_id: "550e8400-e29b-41d4-a716-446655440001",
      name: "My ATS Resume",
      format: "ats",
      sections: [{ type: "summary", visible: true }],
    });
    expect(result.success).toBe(true);
  });
});
