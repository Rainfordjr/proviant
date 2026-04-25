import { redirect } from "next/navigation";

// Inline editing is now on the detail page — redirect there
export default async function EditMaterialRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/materials/${id}`);
}
