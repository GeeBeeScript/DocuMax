import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth/session";
import { safeFileName } from "@/lib/reports/file-names";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Redirect to a short-lived signed URL for an import's error report (RLS decides who may see the row). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const ctx = await requireActiveOrg();
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("imports")
    .select("error_report_path, file_name")
    .eq("org_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!row?.error_report_path) return new NextResponse("Not found", { status: 404 });
  const name = `${safeFileName(`Import errors - ${row.file_name.replace(/\.csv$/i, "")}`)}.csv`;
  const { data } = await supabase.storage
    .from("imports")
    .createSignedUrl(row.error_report_path, 60, { download: name });
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
