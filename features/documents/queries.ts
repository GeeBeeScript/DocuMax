import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentStatus } from "@/lib/documents/status";

export interface DocumentRow {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  entityName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentRow {
  orgId: string;
  error: string | null;
  pageCount: number | null;
  attempts: number;
  uploaderName: string | null;
  /** Short-lived (5 min) signed URL to the original file. */
  fileUrl: string | null;
}

const SIGNED_URL_SECONDS = 300;

/** Most recent documents (RLS: members of the org). Uploads that never finished are left out. */
export async function listDocuments(orgId: string, limit = 100): Promise<DocumentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, mime_type, size_bytes, status, created_at, updated_at, entity:entities(name)")
    .eq("org_id", orgId)
    .neq("status", "uploading")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    fileName: d.file_name,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    status: d.status,
    entityName: d.entity?.name ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

/** One document + a signed URL, created only after the RLS-checked row lookup (docs/MULTI_TENANCY.md). */
export async function getDocument(orgId: string, id: string): Promise<DocumentDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: d, error } = await supabase
    .from("documents")
    .select("*, entity:entities(name), uploader:profiles(full_name, email)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!d) return null;

  const signed = await supabase.storage.from("documents").createSignedUrl(d.storage_path, SIGNED_URL_SECONDS);
  return {
    id: d.id,
    orgId: d.org_id,
    fileName: d.file_name,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    status: d.status,
    entityName: d.entity?.name ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    error: d.error,
    pageCount: d.page_count,
    attempts: d.attempts,
    uploaderName: d.uploader?.full_name ?? d.uploader?.email ?? null,
    fileUrl: signed.data?.signedUrl ?? null,
  };
}

export interface DocumentPageText {
  pageNo: number;
  text: string;
  source: "text_layer" | "ocr";
  ocrConfidence: number | null;
}

/** Extracted text per page (RLS: members of the org). */
export async function listDocumentPages(orgId: string, documentId: string): Promise<DocumentPageText[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("document_pages")
    .select("page_no, text, source, ocr_confidence")
    .eq("org_id", orgId)
    .eq("document_id", documentId)
    .order("page_no");
  if (error) throw error;
  return data.map((p) => ({
    pageNo: p.page_no,
    text: p.text,
    source: p.source,
    ocrConfidence: p.ocr_confidence === null ? null : Number(p.ocr_confidence),
  }));
}
