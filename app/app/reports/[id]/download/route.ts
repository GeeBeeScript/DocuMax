import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Redirect to a short-lived signed URL for a ready report (RLS decides who may see the row). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const ctx = await requireActiveOrg();
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from("reports")
    .select("storage_path, file_name, status")
    .eq("org_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!report || report.status !== "ready" || !report.storage_path) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { data } = await supabase.storage
    .from("reports")
    .createSignedUrl(report.storage_path, 60, { download: report.file_name });
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
