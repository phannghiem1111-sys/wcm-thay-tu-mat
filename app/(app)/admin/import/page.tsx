import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ImportForm } from "./ImportForm";
import { SheetSync } from "./SheetSync";
import { sheetUrl, sheetsEnabled } from "@/lib/sheets";

export default async function ImportPage() {
  await requirePage(can.importExcel);
  return (<><h2>Import Excel</h2><ImportForm /><SheetSync enabled={sheetsEnabled()} url={sheetUrl()} /></>);
}
