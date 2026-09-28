/**
 * SEED-DATA REGRESSION TEST for the initial Hove campaign.
 *
 * Checks only the seed module (scripts/seed-data/hove/content.ts) against its
 * authoritative source brief (scripts/seed-data/hove/brief.txt). It is not a
 * rule for job content in general: jobs created or edited in the admin
 * dashboard are free-form (see tests/job-content-configurable.test.ts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { BENEFITS, DEPARTMENTS, DESCRIPTION, HOMEPAGE, QUALITIES, ROLES, UK_SPELLING } from "../../scripts/seed-data/hove/content";

const sourceLines = readFileSync(path.join(__dirname, "..", "..", "scripts", "seed-data", "hove", "brief.txt"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

/** Undo the permitted UK-spelling changes so text can be compared with the brief. */
function toSource(text: string) {
  return Object.entries(UK_SPELLING).reduce((s, [uk, us]) => s.replaceAll(uk, us), text);
}

function assertVerbatim(text: string) {
  assert.ok(sourceLines.includes(toSource(text)), `Not found verbatim in the brief:\n  ${text}`);
}

describe("seeded Hove vacancies match the source brief", () => {
  it("uses exactly the eight roles, in source order, per department", () => {
    for (const [dept, label] of [["foh", "Front of House"], ["boh", "Back of House"]] as const) {
      const line = sourceLines.find((l) => l.startsWith(`${label}: `) && !l.includes("(")) ?? "";
      const expected = line
        .slice(label.length + 2)
        .replace(/\.$/, "")
        .split(/,\s*(?:and\s+)?/)
        .map((r) => r.trim());
      assert.deepEqual(
        ROLES.filter((r) => r.dept === dept).map((r) => r.sourceRole),
        expected,
      );
    }
    assert.equal(ROLES.length, 8);
  });

  it("titles are the singular form of each source role", () => {
    const singular: Record<string, string> = {
      Supervisors: "Supervisor",
      "Head Waiters/Waitresses": "Head Waiter/Waitress",
      Bartenders: "Bartender",
      Hosts: "Host",
      "Floor Servers": "Floor Server",
      "Commis Chef": "Commis Chef",
      "Kitchen Porters": "Kitchen Porter",
      "Prep Cooks": "Prep Cook",
    };
    for (const r of ROLES) assert.equal(r.title, singular[r.sourceRole]);
  });

  it("description paragraphs are verbatim", () => DESCRIPTION.forEach(assertVerbatim));

  it("FOH, BOH and universal characteristics are verbatim", () => {
    [...QUALITIES.foh, ...QUALITIES.boh, ...QUALITIES.universal].forEach(assertVerbatim);
  });

  it("characteristics are assigned by department only (FOH/BOH + universal)", () => {
    const foh = new Set(QUALITIES.foh);
    const boh = new Set(QUALITIES.boh);
    // The brief lists FOH characteristics before the BOH ones and before the universal attributes.
    const fohIndex = sourceLines.indexOf("Front of House (FOH)");
    const bohIndex = sourceLines.indexOf("Back of House (BOH)");
    const allIndex = sourceLines.indexOf("Universal Attributes (Everyone)");
    const section = (from: number, to: number) => sourceLines.slice(from + 1, to);
    assert.deepEqual(QUALITIES.foh.map(toSource), section(fohIndex, bohIndex));
    assert.deepEqual(QUALITIES.boh.map(toSource), section(bohIndex, allIndex));
    assert.equal([...foh].some((q) => boh.has(q)), false);
  });

  it("benefits are verbatim and complete", () => {
    BENEFITS.forEach(assertVerbatim);
    const offerIndex = sourceLines.indexOf("3. What We Offer");
    assert.deepEqual(BENEFITS, sourceLines.slice(offerIndex + 1, offerIndex + 1 + BENEFITS.length));
  });

  it("marketing summaries only restate facts from the brief", () => {
    const facts = ["high-end, fast-paced dining destination", "shape its culture from day one", "Hove"];
    for (const fact of facts) assert.ok(sourceLines.some((l) => l.includes(fact)), `fact missing from brief: ${fact}`);
    for (const r of ROLES) {
      const dept = DEPARTMENTS[r.dept].name;
      assert.equal(
        r.summary,
        `Join our ${dept} team as a ${r.title} at Hove’s new high-end, fast-paced dining destination and help shape its culture from day one.`,
      );
    }
  });
});

describe("seeded Hove homepage copy matches the brief", () => {
  it("benefit labels are the 'What We Offer' headings verbatim, in order", () => {
    assert.deepEqual(
      HOMEPAGE.benefits.map((b) => b.label),
      BENEFITS.map((b) => b.split(":")[0]),
    );
  });

  it("About page uses the brief's heading, introduction and role list", () => {
    assert.ok(sourceLines.some((l) => l.startsWith(HOMEPAGE.aboutTitle)), "About title is the brief's heading");
    for (const line of HOMEPAGE.aboutText.split(/\n+/)) {
      if (line === "The roles we are hiring for") continue; // section label; source: "1. The Roles We Are Hiring For"
      assertVerbatim(line);
    }
  });
});
