import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  await requirePage(can.importExcel);
  return (<><h2>Import Excel</h2><ImportForm /></>);
}
