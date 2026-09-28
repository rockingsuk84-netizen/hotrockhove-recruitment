/**
 * Job and homepage content is fully admin-configurable. Seed campaigns such as
 * the Hove launch have their own regression tests (tests/seed/), but nothing in
 * the application may require new content to match any campaign brief.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homepageSettingsSchema } from "../src/lib/settings";
import { jobInputSchema } from "../src/services/jobs";

describe("admin job content is not tied to any seed campaign", () => {
  it("accepts a job with entirely new wording, hours and questions", () => {
    const parsed = jobInputSchema.safeParse({
      title: "Events Coordinator",
      slug: "",
      summary: "Plan and run private dining events across our Brighton venues.",
      description: "A brand-new role unrelated to any existing campaign.",
      responsibilities: "Liaise with clients\nCoordinate suppliers",
      requirements: "Two years' events experience\nFull UK driving licence",
      benefits: "28 days' holiday\nPension scheme",
      standoutPrompt: "Tell us about an event you are proud of.",
      locationId: "",
      departmentId: "",
      employmentTypeId: "",
      positionIds: [],
      questions: [{ id: "right_to_work", label: "Do you have the right to work in the UK?", type: "short_text", required: true, maxLength: 200 }],
      featured: true,
      imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    });
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
    assert.deepEqual(parsed.data.requirements, ["Two years' events experience", "Full UK driving licence"]);
    assert.deepEqual(parsed.data.benefits, ["28 days' holiday", "Pension scheme"]);
  });

  it("accepts homepage copy and benefits unrelated to the Hove brief", () => {
    const parsed = homepageSettingsSchema.safeParse({
      heroEyebrow: "Now hiring in Brighton",
      heroTitle: "Your Next Chapter Starts Here",
      heroHighlight: "Chapter",
      heroText: "Different campaign, different words.",
      heroCta: "See roles",
      heroImage: "/images/hero.jpg",
      vacanciesEyebrow: "Open roles",
      vacanciesTitle: "Current openings",
      vacanciesText: "",
      whyEyebrow: "",
      whyTitle: "Why work with us",
      whyText: "",
      whyImage: "",
      benefits: [{ icon: "clock", label: "Flexible rotas" }],
      aboutTitle: "About our group",
      aboutText: "Anything the admin wants to say.",
    });
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  });
});
