import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/session";
import { DEFAULT_STANDOUT_LABEL, getTaxonomy } from "@/services/jobs";
import { JobForm } from "../job-form";

export const metadata = { title: "New job" };

export default async function NewJobPage() {
  await requireStaff();
  const taxonomy = await getTaxonomy();
  return (
    <>
      <PageHeader title="New job" description="Jobs are saved as drafts. Publish when you're ready for applications." />
      <JobForm
        taxonomy={taxonomy}
        initial={{
          title: "",
          slug: "",
          summary: "",
          description: "",
          responsibilities: [],
          requirements: [],
          benefits: [],
          standoutPrompt: DEFAULT_STANDOUT_LABEL,
          locationId: null,
          departmentId: null,
          employmentTypeId: null,
          positionIds: [],
          questions: [],
          featured: false,
          imageUrl: null,
        }}
      />
    </>
  );
}
