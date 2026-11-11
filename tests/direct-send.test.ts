import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directRecipientSchema } from "../src/services/forms";

describe("sending a form to someone who hasn't applied", () => {
  it("normalises the email and allows a blank phone", () => {
    const r = directRecipientSchema.parse({ fullName: "  Test Person ", email: " Test.Person@Example.COM ", phone: "" });
    assert.equal(r.email, "test.person@example.com");
    assert.equal(r.fullName, "Test Person");
  });

  it("rejects a bad email, a missing name or a bad phone number", () => {
    assert.equal(directRecipientSchema.safeParse({ fullName: "Test Person", email: "not-an-email", phone: "" }).success, false);
    assert.equal(directRecipientSchema.safeParse({ fullName: "", email: "a@example.com", phone: "" }).success, false);
    assert.equal(directRecipientSchema.safeParse({ fullName: "Test Person", email: "a@example.com", phone: "123" }).success, false);
    assert.equal(directRecipientSchema.safeParse({ fullName: "Test Person", email: "a@example.com", phone: "07700 900123" }).success, true);
  });
});
