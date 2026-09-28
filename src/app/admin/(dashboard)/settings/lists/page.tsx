import { Badge, Card } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { getTaxonomy } from "@/services/jobs";
import { toggleListItem } from "../actions";
import { AddItemForm } from "./add-item-form";
import { DepartmentForm } from "./department-form";

export const metadata = { title: "Lists" };

const LISTS = [
  { key: "positions", title: "Roles / positions", hint: "Roles applicants can choose when a job covers several." },
  { key: "locations", title: "Locations", hint: "" },
  { key: "departments", title: "Departments", hint: "Departments are the public job categories. Give each a URL slug, tagline, image and icon to show it as a card on the homepage." },
  { key: "employmentTypes", title: "Employment types", hint: "" },
] as const;

export default async function ListsPage() {
  await requireAdmin();
  const taxonomy = await getTaxonomy();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {LISTS.map((list) => (
        <Card key={list.key} className="p-5">
          <h2 className="font-semibold text-stone-900">{list.title}</h2>
          {list.hint && <p className="mt-1 text-sm text-stone-600">{list.hint}</p>}
          <ul className="mt-3 divide-y divide-stone-100">
            {taxonomy[list.key].map((item) => (
              <li key={item.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                <span className={item.active ? "text-stone-900" : "text-stone-400 line-through"}>{item.name}</span>
                <span className="flex items-center gap-2">
                  {!item.active && <Badge>Hidden</Badge>}
                  <form action={toggleListItem.bind(null, list.key, item.id, !item.active)}>
                    <button type="submit" className="text-xs font-medium text-brand hover:underline">
                      {item.active ? "Hide" : "Restore"}
                    </button>
                  </form>
                </span>
                </div>
                {list.key === "departments" && "slug" in item && (
                  <DepartmentForm dept={{ id: item.id, slug: item.slug, tagline: item.tagline, imageUrl: item.imageUrl, icon: item.icon }} />
                )}
              </li>
            ))}
          </ul>
          <AddItemForm list={list.key} />
        </Card>
      ))}
    </div>
  );
}
