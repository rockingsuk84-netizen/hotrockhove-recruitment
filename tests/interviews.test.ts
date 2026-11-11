import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatInterviewTime, interviewDetailsSchema, londonLocalToUtc, parseInterviewTime, utcToLondonLocal } from "../src/lib/interviews";

describe("UK interview times", () => {
  it("reads winter times as GMT and summer times as BST", () => {
    assert.equal(londonLocalToUtc("2026-12-01T14:30")?.toISOString(), "2026-12-01T14:30:00.000Z");
    assert.equal(londonLocalToUtc("2026-07-01T14:30")?.toISOString(), "2026-07-01T13:30:00.000Z");
  });

  it("handles the clock-change days", () => {
    // Clocks go forward at 01:00 on 29 March 2026: 01:30 doesn't exist.
    assert.equal(londonLocalToUtc("2026-03-29T01:30"), null);
    assert.equal(londonLocalToUtc("2026-03-29T02:30")?.toISOString(), "2026-03-29T01:30:00.000Z");
    // Clocks go back on 25 October 2026.
    assert.equal(londonLocalToUtc("2026-10-25T12:00")?.toISOString(), "2026-10-25T12:00:00.000Z");
  });

  it("round-trips through the input format", () => {
    for (const v of ["2026-12-01T09:05", "2026-06-15T18:45"]) assert.equal(utcToLondonLocal(londonLocalToUtc(v)!), v);
  });

  it("rejects malformed, past and far-future times", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    assert.equal(parseInterviewTime("", now).ok, false);
    assert.equal(parseInterviewTime("tomorrow", now).ok, false);
    assert.equal(parseInterviewTime("2026-11-10T10:00", now).ok, false);
    assert.equal(parseInterviewTime("2028-01-01T10:00", now).ok, false);
    assert.equal(parseInterviewTime("2026-11-18T14:30", now).ok, true);
  });

  it("formats in plain UK English", () => {
    assert.equal(formatInterviewTime(new Date("2026-11-18T14:30:00Z")), "Wednesday 18 November 2026 at 2:30pm");
    assert.equal(formatInterviewTime(new Date("2026-07-01T09:00:00Z")), "Wednesday 1 July 2026 at 10am");
  });
});

describe("interview details", () => {
  const base = { durationMinutes: "30", location: "", meetingLink: "", contactName: "", notes: "" };

  it("needs an address for in-person interviews", () => {
    assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "in_person" }).success, false);
    const ok = interviewDetailsSchema.parse({ ...base, mode: "in_person", location: "1 High St, Hove", meetingLink: "https://x.example" });
    assert.equal(ok.location, "1 High St, Hove");
    assert.equal(ok.meetingLink, null, "irrelevant fields are dropped");
  });

  it("needs an https meeting link for online interviews", () => {
    assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "online" }).success, false);
    for (const bad of ["http://meet.example/abc", "javascript:alert(1)", "meet.example/abc", "https://user:pw@meet.example"]) {
      assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "online", meetingLink: bad }).success, false, bad);
    }
    assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "online", meetingLink: "https://teams.microsoft.com/l/meetup-join/abc" }).success, true);
  });

  it("allows phone interviews without a place or link, and only listed lengths", () => {
    assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "phone" }).success, true);
    assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "phone", durationMinutes: "37" }).success, false);
    assert.equal(interviewDetailsSchema.safeParse({ ...base, mode: "video" }).success, false);
  });
});
