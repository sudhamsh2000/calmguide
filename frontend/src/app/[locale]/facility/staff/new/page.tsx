"use client";

import { useCallback, useState } from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFacility } from "@/context/FacilityContext";
import { createStaff, FacilityApiError } from "@/lib/facility-api";
import type { StaffRole } from "@/lib/facility-api";

export default function AddStaffPage() {
  const { allowed } = useRequireRole("admin", "owner");
  if (!allowed) return null;

  const t = useTranslations("facility.staff");
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const { state } = useFacility();
  const facilityCode = state.facilityCode ?? "";

  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePin = useCallback(() => {
    const random = String(Math.floor(1000 + Math.random() * 9000));
    setPin(random);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setSubmitting(true);
      setError(null);
      try {
        await createStaff(facilityCode, {
          name: name.trim(),
          role,
          pin: pin || undefined,
          email: email || undefined,
          password: password || undefined,
          language_preference: language,
        });
        router.push(`/${locale}/facility/staff`);
      } catch (err) {
        if (err instanceof FacilityApiError) {
          setError("Could not add staff member. Please try again.");
        } else {
          setError("Connection error. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [name, role, pin, email, password, language, facilityCode, locale, router],
  );

  const isAdmin = role === "admin" || role === "owner";

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
        <div className="max-w-lg">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-primary hover:underline mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            {t("title")}
          </button>

          <h1 className="text-xl font-bold text-foreground mb-6">{t("add_title")}</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("name")} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-shell w-full h-12 px-4"
                required
                autoFocus
              />
            </div>

            {/* Role */}
            <fieldset>
              <legend className="text-sm font-medium text-foreground mb-2">{t("role")} *</legend>
              <div className="space-y-2">
                {([
                  { value: "staff", label: t("role_staff") },
                  { value: "admin", label: t("role_admin") },
                ] as const).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={role === opt.value}
                      onChange={() => setRole(opt.value)}
                      className="size-5 accent-primary"
                    />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* PIN */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("pin_label")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  placeholder="0000"
                  className="field-shell min-w-0 flex-1 h-12 px-4 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={generatePin}
                  className="outline-button h-12 rounded-xl px-3 text-sm font-medium whitespace-nowrap shrink-0"
                >
                  {t("pin_generate")}
                </button>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("email_label")}
                <span className="text-foreground-muted ml-1 text-xs font-normal">
                  ({isAdmin ? t("email_hint_admin") : t("email_hint_cna")})
                </span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-shell w-full h-12 px-4"
                required={isAdmin}
              />
            </div>

            {/* Password (for admin only) */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-shell w-full h-12 px-4"
                  required
                  minLength={8}
                />
              </div>
            )}

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("language_label")}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="field-shell select-chevron h-12 w-full px-4"
              >
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
                <option value="hi-IN">हिन्दी</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-base disabled:opacity-40 hover:bg-primary-light active:bg-primary-dark transition-colors"
            >
              {submitting ? "Adding..." : t("add_button")}
            </button>
          </form>
        </div>
</main>
  );
}
