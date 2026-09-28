/**
 * Seed data for the initial Hove recruitment campaign.
 *
 * Authoritative source: Job_Description_Restaurant_Hove.docx, snapshot in
 * ./brief.txt. This module is used ONLY by scripts/seed.ts; the application
 * never reads it or the brief. Jobs created later in the admin dashboard are
 * fully configurable and are not required to match this campaign.
 *
 * Every description paragraph, requirement and benefit below is copied verbatim
 * from the brief. The only permitted change is UK spelling (see UK_SPELLING).
 * tests/seed/hove.test.ts is a regression test for this seed data only.
 *
 * The source gives characteristics at FOH/BOH level only, so each role receives
 * its department's characteristics plus the universal attributes. No
 * role-specific responsibilities, hours or pay details are stated in the
 * brief, so none are seeded.
 */

/** UK spellings applied to the source text (UK form → form used in the brief). */
export const UK_SPELLING: Record<string, string> = {
  unlevelled: "unleveled",
  programmes: "programs",
};

/** Description paragraphs (source: introduction + closing line of "How to apply"). */
export const DESCRIPTION = [
  "A new high-end, fast-paced dining destination is opening its doors in Hove, and we are searching for exceptional talent to shape its culture from day one. We are building a dynamic team of dedicated Front of House (FOH) and Back of House (BOH) professionals who take genuine pride in hospitality, culinary craft, and seamless service.",
  "While prior experience in premium or high-volume dining is highly valued, character and mindset come first. If you possess an exceptional work ethic, sharp intuition, and a passion for excellence, we have the tools and leadership to help you succeed.",
  "Interviews and auditions will begin shortly. Early applications are strongly encouraged.",
];

/** Source section 2: "Who You Are: Core Characteristics & Qualities". */
export const QUALITIES = {
  foh: [
    "Radiant Hospitality: A natural warm energy and genuine poise under pressure. You read the room instantly and anticipate guest needs before they ask.",
    "Grace & Velocity: The ability to move quickly and efficiently while maintaining absolute calm and elegance on the floor.",
    "Sharp Attention to Detail: Spotting an unlevelled table, a smudged glass, or a guest’s non-verbal cue is second nature to you.",
    "Storytelling & Curiosity: Enthusiasm for learning our food, wine, and cocktail programmes and articulating them to guests with confidence.",
  ],
  boh: [
    "Precision & Speed: Exceptional knife skills, acute timing, and the ability to maintain clean, meticulous station management during peak rush hours.",
    "Respect for the Craft: A deep appreciation for quality ingredients, consistent execution, and zero-compromise standards.",
    "Composure & Stamina: Cool-headed communication when the pass is hot and orders are stacking up.",
    "Ownership Culture: Taking pride in every plate that leaves your station as if your own name were on it.",
  ],
  universal: [
    "Uncompromising Reliability: Punctual, prepared, and ready to support your team every shift.",
    "High Emotional Intelligence: Constructive communication, zero-ego teamwork, and a solution-oriented mindset.",
    "Adaptability: Thriving in an environment where speed and quality must coexist effortlessly.",
  ],
};

/** Source section 3: "What We Offer". Headings are reused verbatim on the homepage. */
export const BENEFITS = [
  "Competitive Pay & Shared Gratuities: Industry-leading base wages plus a fair, transparent tip distribution.",
  "Career Growth & Progression: Clear pathways for promotion as we establish and expand our concept.",
  "Professional Development: Tailored training in fine wines, mixology, culinary techniques, and service standards.",
  "Team Culture: A respectful, inspiring, and balanced work environment that celebrates individual effort and collective success.",
  "Perks: Staff discounts, high-quality shift meals, and team social events.",
];

export type Dept = "foh" | "boh";

/**
 * The eight roles from source section 1, in source order. `sourceRole` is the
 * exact wording in the brief; `title` is its singular form for the job posting.
 *
 * `summary` is a MARKETING SUMMARY written for job cards, not source content.
 * It only restates facts from the brief (department, Hove, new high-end
 * fast-paced venue, shaping the culture from day one) and must never add
 * duties, requirements, hours, pay or benefits.
 */
export type Role = { sourceRole: string; title: string; slug: string; dept: Dept; image: string; featured: boolean; summary: string };

const ROLE_LIST: Omit<Role, "summary">[] = [
  { sourceRole: "Supervisors", title: "Supervisor", slug: "supervisor-hove", dept: "foh", image: "/images/supervisor.jpg", featured: false },
  { sourceRole: "Head Waiters/Waitresses", title: "Head Waiter/Waitress", slug: "head-waiter-waitress-hove", dept: "foh", image: "/images/head-waiter.jpg", featured: true },
  { sourceRole: "Bartenders", title: "Bartender", slug: "bartender-hove", dept: "foh", image: "/images/bartender.jpg", featured: true },
  { sourceRole: "Hosts", title: "Host", slug: "host-hove", dept: "foh", image: "/images/host.jpg", featured: false },
  { sourceRole: "Floor Servers", title: "Floor Server", slug: "floor-server-hove", dept: "foh", image: "/images/floor-server.jpg", featured: false },
  { sourceRole: "Commis Chef", title: "Commis Chef", slug: "commis-chef-hove", dept: "boh", image: "/images/commis-chef.jpg", featured: true },
  { sourceRole: "Kitchen Porters", title: "Kitchen Porter", slug: "kitchen-porter-hove", dept: "boh", image: "/images/kitchen-porter.jpg", featured: false },
  { sourceRole: "Prep Cooks", title: "Prep Cook", slug: "prep-cook-hove", dept: "boh", image: "/images/prep-cook.jpg", featured: false },
];

export const ROLES: Role[] = ROLE_LIST.map((r) => ({
  ...r,
  summary: `Join our ${r.dept === "foh" ? "Front of House" : "Back of House"} team as a ${r.title} at Hove’s new high-end, fast-paced dining destination and help shape its culture from day one.`,
}));

/**
 * Category cards. Taglines are marketing copy from the approved homepage design
 * brief (not the job description) and describe the department, not a role.
 */
export const DEPARTMENTS = {
  foh: { name: "Front of House", slug: "front-of-house", imageUrl: "/images/foh.jpg", icon: "cloche", tagline: "Create memorable experiences for every guest." },
  boh: { name: "Back of House", slug: "back-of-house", imageUrl: "/images/boh.jpg", icon: "chef-hat", tagline: "Bring great food to life with skill and precision." },
} as const;

export const STANDOUT_PROMPT = "What single quality makes you stand out in a high-pressure environment?";

/**
 * Homepage copy for this campaign, written to the `homepage` setting on first
 * seed (never overwriting admin edits). Fields not set here use the app defaults.
 * Hero and section text come from the approved homepage design brief; the
 * benefits and About content come from the job description.
 */
export const HOMEPAGE = {
  heroText:
    "Join our team at Hove's next landmark restaurant. We're looking for exceptional talent to help shape our culture from day one.",
  vacanciesText:
    "We're hiring for both Front of House and Back of House roles. Explore our current vacancies and take the next step in your hospitality career.",
  // Follows "What We Offer"; labels are its headings verbatim.
  whyText:
    "Competitive pay and shared gratuities, clear pathways for career growth and progression, professional development, a respectful team culture and staff perks.",
  benefits: [
    { icon: "pay", label: "Competitive Pay & Shared Gratuities" },
    { icon: "growth", label: "Career Growth & Progression" },
    { icon: "training", label: "Professional Development" },
    { icon: "team", label: "Team Culture" },
    { icon: "perks", label: "Perks" },
  ],
  // The brief's heading, introduction and role list.
  aboutTitle: "Hove’s Next Landmark Restaurant",
  aboutText: [
    DESCRIPTION[0],
    DESCRIPTION[1],
    "The roles we are hiring for\nFront of House: Supervisors, Head Waiters/Waitresses, Bartenders, Hosts, and Floor Servers.\nBack of House: Commis Chef, Kitchen Porters, and Prep Cooks.",
  ].join("\n\n"),
};
