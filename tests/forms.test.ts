import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answerRows,
  confirmInputName,
  formDefinitionSchema,
  formatAnswer,
  gridInputName,
  inputName,
  parseAnswers,
  type FormDefinition,
} from "../src/lib/forms/definition";
import { AVAILABILITY_FORM } from "../src/lib/forms/templates";

/** Build FormData-like input from a plain object (arrays become repeated fields). */
function fd(values: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  return f;
}

const complete = {
  [gridInputName("availability", "mon")]: ["afternoon", "evening"],
  [gridInputName("availability", "sun")]: "afternoon",
  [inputName("currently_employed")]: "no",
  [inputName("start_date")]: "Immediately",
  [inputName("holidays_booked")]: "no",
  [inputName("position")]: ["front_of_house", "kitchen_team"],
  [inputName("work_history")]: "Waiter, 2 years",
  [inputName("signature")]: "Test Applicant",
  [confirmInputName("signature")]: "yes",
};

describe("availability form definition", () => {
  it("is a valid form definition", () => {
    const parsed = formDefinitionSchema.safeParse(AVAILABILITY_FORM);
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  });

  it("keeps the office-use outcome staff-only", () => {
    assert.deepEqual(AVAILABILITY_FORM.reviewOptions, ["Offer", "Hold", "Reject"]);
    assert.ok(!AVAILABILITY_FORM.fields.some((f) => /offer|reject/i.test(f.label)));
  });
});

describe("parseAnswers", () => {
  it("accepts a complete submission and stores the grid by day", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd(complete), { cvOnFile: true });
    assert.ok(r.ok);
    assert.deepEqual(r.answers.availability, { mon: ["afternoon", "evening"], sun: ["afternoon"] });
    assert.deepEqual(r.answers.position, ["front_of_house", "kitchen_team"]);
    assert.equal(r.answers.signature, "Test Applicant");
    assert.equal(r.cvRequired, false);
  });

  it("requires a CV only when none is on file", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd(complete), { cvOnFile: false });
    assert.ok(r.ok);
    assert.equal(r.cvRequired, true);
  });

  it("asks for a notice period only when currently employed", () => {
    const employed = parseAnswers(AVAILABILITY_FORM, fd({ ...complete, [inputName("currently_employed")]: "yes" }), { cvOnFile: true });
    assert.ok(!employed.ok);
    assert.ok(inputName("notice_period") in employed.errors);

    const withNotice = parseAnswers(
      AVAILABILITY_FORM,
      fd({ ...complete, [inputName("currently_employed")]: "yes", [inputName("notice_period")]: "2 weeks" }),
      { cvOnFile: true },
    );
    assert.ok(withNotice.ok);
    assert.equal(withNotice.answers.notice_period, "2 weeks");
  });

  it("drops answers to questions hidden by a condition", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd({ ...complete, [inputName("notice_period")]: "sneaky" }), { cvOnFile: true });
    assert.ok(r.ok);
    assert.equal(r.answers.notice_period, undefined);
  });

  it("ignores option values that aren't in the definition", () => {
    const r = parseAnswers(
      AVAILABILITY_FORM,
      fd({ ...complete, [gridInputName("availability", "mon")]: ["night", "evening"], [gridInputName("availability", "xyz")]: "morning" }),
      { cvOnFile: true },
    );
    assert.ok(r.ok);
    assert.deepEqual(r.answers.availability, { mon: ["evening"], sun: ["afternoon"] });
  });

  it("reports every missing required answer", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd({}), { cvOnFile: true });
    assert.ok(!r.ok);
    for (const id of ["availability", "currently_employed", "start_date", "holidays_booked", "position", "signature"]) {
      assert.ok(inputName(id) in r.errors, id);
    }
    assert.ok(!(inputName("work_history") in r.errors), "work history is optional");
  });

  it("needs the declaration ticked as well as a typed name", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd({ ...complete, [confirmInputName("signature")]: "" }), { cvOnFile: true });
    assert.ok(!r.ok);
    assert.ok(confirmInputName("signature") in r.errors);
  });

  it("enforces text length limits", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd({ ...complete, [inputName("start_date")]: "x".repeat(101) }), { cvOnFile: true });
    assert.ok(!r.ok);
  });
});

describe("display", () => {
  it("formats answers with labels, in form order", () => {
    const r = parseAnswers(AVAILABILITY_FORM, fd(complete), { cvOnFile: true });
    assert.ok(r.ok);
    const rows = answerRows(AVAILABILITY_FORM, r.answers);
    const byId = Object.fromEntries(rows.map((x) => [x.field.id, x.text]));
    assert.equal(byId.availability, "Monday: Afternoon, Evening\nSunday: Afternoon");
    assert.equal(byId.position, "Front of house, Kitchen team");
    assert.equal(byId.currently_employed, "No");
    assert.equal(byId.signature, "Signed: Test Applicant");
    assert.ok(!("notice_period" in byId), "hidden question is not shown");
    assert.ok(!("cv" in byId) && !("availability_heading" in byId));
  });

  it("formats dates in UK style", () => {
    assert.equal(formatAnswer({ id: "d", type: "date", label: "Start", required: true }, "2026-12-01"), "1 December 2026");
  });
});

describe("definition schema", () => {
  const base: FormDefinition = { title: "Test", intro: "", reviewOptions: [], fields: [] };

  it("rejects duplicate ids and conditions on later fields", () => {
    const dup = { ...base, fields: [{ id: "a", type: "yes_no", label: "A", required: true }, { id: "a", type: "yes_no", label: "B", required: true }] };
    assert.equal(formDefinitionSchema.safeParse(dup).success, false);
    const forward = {
      ...base,
      fields: [
        { id: "a", type: "short_text", label: "A", required: true, maxLength: 10, showIf: { field: "b", equals: "yes" } },
        { id: "b", type: "yes_no", label: "B", required: true },
      ],
    };
    assert.equal(formDefinitionSchema.safeParse(forward).success, false);
  });

  it("allows at most one CV upload", () => {
    const two = { ...base, fields: [{ id: "a", type: "cv_upload", label: "CV" }, { id: "b", type: "cv_upload", label: "CV" }] };
    assert.equal(formDefinitionSchema.safeParse(two).success, false);
  });
});
