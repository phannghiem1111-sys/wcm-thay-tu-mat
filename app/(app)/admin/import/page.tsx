import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ImportForm } from "./ImportForm";
import { SheetSync } from "./SheetSync";
import { ResetForm } from "./ResetForm";
import { sheetUrl, sheetsEnabled } from "@/lib/sheets";

export default async function ImportPage() {
  const u = await requirePage(can.importExcel);
  return (<><h2>Import Excel</h2><ImportForm /><SheetSync enabled={sheetsEnabled()} url={sheetUrl()} />{can.manageUsers(u) && <ResetForm />}</>);
}
