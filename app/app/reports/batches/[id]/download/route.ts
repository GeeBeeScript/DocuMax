import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth/session";
import { batchZipName } from "@/lib/reports/file-names";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Redirect to a short-lived signed URL for a finished batch's ZIP (RLS decides who may see the row). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const ctx = await requireActiveOrg();
  const supabase = await createSupabaseServerClient();
  const { data: batch } = await supabase
    .from("report_batches")
    .select("zip_path, status, period_start, period_end")
    .eq("org_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!batch || batch.status !== "ready" || !batch.zip_path)
    return new NextResponse("Not found", { status: 404 });
  const { data } = await supabase.storage.from("reports").createSignedUrl(batch.zip_path, 60, {
    download: batchZipName({ start: batch.period_start, end: batch.period_end }),
  });
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
