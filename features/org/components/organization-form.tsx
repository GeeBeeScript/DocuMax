"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { FormAlert } from "@/components/app/form-alert";
import { SelectField } from "@/components/app/select-field";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { Label } from "@/components/ui/label";
import { organizationCopy as copy } from "@/content/app";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateOrganizationSettings } from "../actions";

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Branding + time zone (owners/admins). The logo goes straight from the browser to the branding bucket (RLS:
 * owners/admins, `{org_id}/…`); saving stores its path.
 */
export function OrganizationForm({
  orgId,
  orgName,
  initial,
  logoUrl,
  timeZones,
}: {
  orgId: string;
  orgName: string;
  initial: { logoPath: string | null; brandColor: string; footerText: string; timezone: string };
  logoUrl: string | null;
  timeZones: readonly string[];
}) {
  const [logoPath, setLogoPath] = useState(initial.logoPath);
  const [preview, setPreview] = useState(logoUrl);
  const [brandColor, setBrandColor] = useState(initial.brandColor);
  const [footerText, setFooterText] = useState(initial.footerText);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    const ext = LOGO_TYPES[file.type];
    if (!ext) return setError(copy.logo.wrongType);
    if (file.size > MAX_LOGO_BYTES) return setError(copy.logo.tooBig);
    setUploading(true);
    const path = `${orgId}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await createSupabaseBrowserClient()
      .storage.from("branding")
      .upload(path, file, { contentType: file.type });
    setUploading(false);
    if (uploadError) return setError(uploadError.message);
    setLogoPath(path);
    setPreview(URL.createObjectURL(file));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationSettings({ logoPath, brandColor, footerText, timezone });
      if (result.ok) {
        setFieldErrors({});
        toast.success(copy.saved);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-xl flex-col gap-6 rounded-2xl border border-gray-200 bg-paper p-6"
    >
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-logo">{copy.logo.label}</Label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed / object URL preview
              <img src={preview} alt={copy.logo.alt(orgName)} className="max-h-14 max-w-36 object-contain" />
            ) : (
              <ImageUp className="size-6 text-gray-400" aria-hidden />
            )}
          </div>
          <input
            ref={fileInput}
            id="org-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <PillButton
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? copy.logo.uploading : preview ? copy.logo.replace : copy.logo.choose}
          </PillButton>
          {preview && (
            <PillButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setLogoPath(null);
                setPreview(null);
              }}
            >
              <Trash2 aria-hidden /> {copy.logo.remove}
            </PillButton>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{copy.logo.hint}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-color">{copy.color.label}</Label>
        <div className="flex items-center gap-3">
          <input
            id="org-color"
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            aria-describedby="org-color-hint"
            className="h-10 w-16 cursor-pointer rounded-lg border border-input bg-paper p-1"
          />
          <span className="font-mono text-sm uppercase">{brandColor}</span>
        </div>
        <p id="org-color-hint" className="text-xs text-muted-foreground">
          {copy.color.hint}
        </p>
      </div>

      <TextField
        id="org-footer"
        label={copy.footer.label}
        hint={copy.footer.hint}
        error={fieldErrors.footerText?.[0]}
        value={footerText}
        maxLength={200}
        onChange={(e) => setFooterText(e.target.value)}
      />

      <SelectField
        id="org-timezone"
        label={copy.timezone.label}
        value={timezone}
        error={fieldErrors.timezone?.[0]}
        onChange={(e) => setTimezone(e.target.value)}
        options={timeZones.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))}
      />
      <p className="-mt-4 text-xs text-muted-foreground">{copy.timezone.hint}</p>

      <PillButton type="submit" size="sm" className="self-start" disabled={pending || uploading}>
        {copy.save}
      </PillButton>
    </form>
  );
}
