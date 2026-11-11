import type { FormDefinition, Option } from "./definition";

const DAYS: Option[] = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

/** Fixed id so the seed can create this form once and never overwrite admin edits. */
export const AVAILABILITY_FORM_ID = "6f1d2c3a-6b0e-4c55-9a51-a7a11ab1e001";

/**
 * The venue's paper "flexibility" form, rebuilt for the web. The office-use
 * section (Offer / Hold / Reject, signed and dated) becomes the staff-only
 * review recorded in the dashboard, so applicants never see it.
 */
export const AVAILABILITY_FORM: FormDefinition = {
  title: "Availability and experience",
  intro: "Please complete this form to help us understand your flexibility and when you could start.",
  fields: [
    { id: "availability_heading", type: "heading", label: "When are you available?", help: "Tick every time you could work." },
    {
      id: "availability",
      type: "availability_grid",
      label: "Your availability",
      required: true,
      rows: DAYS,
      columns: [
        { value: "morning", label: "Morning", hint: "6am–12pm" },
        { value: "afternoon", label: "Afternoon", hint: "12pm–5pm" },
        { value: "evening", label: "Evening", hint: "5pm–12am" },
      ],
    },
    { id: "about_heading", type: "heading", label: "About you" },
    { id: "currently_employed", type: "yes_no", label: "Are you currently employed?", required: true },
    {
      id: "notice_period",
      type: "short_text",
      label: "What is your notice period?",
      help: "For example: 1 week, 2 weeks, 1 month.",
      required: true,
      maxLength: 100,
      showIf: { field: "currently_employed", equals: "yes" },
    },
    {
      id: "start_date",
      type: "choice",
      label: "When could you start?",
      required: true,
      multiple: false,
      display: "dropdown",
      options: [
        { value: "immediately", label: "Immediately" },
        { value: "one_week", label: "Within 1 week" },
        { value: "two_weeks", label: "Within 2 weeks" },
        { value: "one_month", label: "Within 1 month" },
        { value: "over_one_month", label: "More than 1 month" },
        { value: "specific_date", label: "On a specific date" },
      ],
    },
    {
      id: "start_on",
      type: "date",
      label: "Which date could you start?",
      required: true,
      showIf: { field: "start_date", equals: "specific_date" },
    },
    { id: "holidays_booked", type: "yes_no", label: "Do you have any holidays booked in the next 6 months?", required: true },
    {
      id: "holiday_dates",
      type: "short_text",
      label: "Which dates?",
      required: false,
      maxLength: 300,
      showIf: { field: "holidays_booked", equals: "yes" },
    },
    {
      id: "position",
      type: "choice",
      label: "Which team would you like to work in?",
      help: "Choose one or both.",
      required: true,
      multiple: true,
      options: [
        { value: "front_of_house", label: "Front of house" },
        { value: "kitchen_team", label: "Kitchen team" },
      ],
    },
    { id: "cv", type: "cv_upload", label: "CV" },
    {
      id: "work_history",
      type: "long_text",
      label: "Previous work history",
      help: "Your recent jobs: where, what you did and roughly when.",
      required: false,
      maxLength: 3000,
    },
    { id: "signature", type: "signature", label: "I confirm the information I have given is correct." },
  ],
  reviewOptions: ["Offer", "Hold", "Reject"],
};
