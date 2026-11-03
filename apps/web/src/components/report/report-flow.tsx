"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, ImageOff, LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PlaceSearch } from "@/components/planner/place-search";
import { HazardKind, type LonLat } from "@/lib/api/contracts";
import { PathAbleError } from "@/lib/api/errors";
import { getService } from "@/lib/api/select-service";
import { announce } from "@/lib/announce";
import { preparePhoto } from "@/lib/photo";
import { useReports } from "@/stores/reports";
import type { Place } from "@/stores/trip";

const STEPS = ["photo", "location", "review", "details", "send"] as const;
type StepName = (typeof STEPS)[number];

const Details = z.object({
  kind: HazardKind,
  description: z.string().trim().max(500),
  observedOn: z.iso.date().refine((d) => d <= new Date().toISOString().slice(0, 10)),
});
type DetailsForm = z.infer<typeof Details>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportFlow() {
  const t = useTranslations();
  const [step, setStep] = useState<StepName>("photo");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const upsert = useReports((s) => s.upsert);
  const form = useForm<DetailsForm>({ resolver: zodResolver(Details), defaultValues: { kind: "obstacle", description: "", observedOn: today() } });
  const index = STEPS.indexOf(step);

  // Each step change moves focus to its heading.
  useEffect(() => headingRef.current?.focus(), [step]);
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const analysis = useQuery({
    queryKey: ["analysis", photoUrl],
    queryFn: async () => (await getService()).analyzePhoto(photo!),
    enabled: step === "review" && Boolean(photo),
  });

  const send = useMutation({
    mutationFn: async (values: DetailsForm) =>
      (await getService()).createReport({ ...values, location: place!.position as LonLat, photoId: null }),
    onSuccess: (receipt, values) => {
      upsert({ localId: receipt.id, ...values, location: place!.position, createdAt: new Date().toISOString(), serverId: receipt.id, status: receipt.status });
      setSentMessage(t("report.sent"));
      announce(t("report.sent"));
    },
    onError: (e, values) => {
      const reason = t(`errors.${e instanceof PathAbleError ? e.code : "internal"}`);
      upsert({ localId: crypto.randomUUID(), ...values, location: place!.position, createdAt: new Date().toISOString(), serverId: null, status: "draft" });
      const msg = t("report.notSent", { reason });
      setSentMessage(msg);
      announce(msg, "assertive");
    },
  });

  const go = (next: StepName) => setStep(next);

  return (
    <div className="pa-container max-w-2xl py-10">
      <p className="tabular text-sm text-ink-muted">{t("report.progress", { current: index + 1, total: STEPS.length })}</p>
      <div className="pa-progress" aria-hidden>
        <div className="pa-progress-bar" style={{ transform: `scaleX(${(index + 1) / STEPS.length})` }} />
      </div>

      {step === "photo" && (
        <section aria-labelledby="step-title">
          <h1 id="step-title" ref={headingRef} tabIndex={-1} className="pa-step-title">{t("report.photoTitle")}</h1>
          <p className="mt-2 max-w-(--measure) text-ink-muted">{t("report.photoHint")}</p>
          {photoUrl ? (
            <div className="mt-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, never optimised */}
              <img src={photoUrl} alt="" className="max-h-72 rounded-card" />
              <button type="button" className="pa-chip-button mt-3" onClick={() => { setPhoto(null); setPhotoUrl(null); }}>
                <ImageOff aria-hidden size={16} />
                {t("report.photoRemove")}
              </button>
            </div>
          ) : (
            <label className="pa-link-button mt-6 cursor-pointer">
              <Camera aria-hidden size={18} />
              {processing ? t("report.photoProcessing") : t("report.photoAdd")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setProcessing(true);
                  const clean = await preparePhoto(file);
                  setPhoto(clean);
                  setPhotoUrl(URL.createObjectURL(clean));
                  setProcessing(false);
                }}
              />
            </label>
          )}
          <StepNav onNext={() => go("location")} />
        </section>
      )}

      {step === "location" && (
        <section aria-labelledby="step-title">
          <h1 id="step-title" ref={headingRef} tabIndex={-1} className="pa-step-title">{t("report.locationTitle")}</h1>
          <div className="mt-6">
            <PlaceSearch label={t("report.locationTitle")} hideLabel value={place} onSelect={setPlace} />
          </div>
          {place && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <LocateFixed aria-hidden size={16} />
              {place.label}
            </p>
          )}
          <StepNav onBack={() => go("photo")} onNext={() => go("review")} nextDisabled={!place} />
        </section>
      )}

      {step === "review" && (
        <section aria-labelledby="step-title">
          <h1 id="step-title" ref={headingRef} tabIndex={-1} className="pa-step-title">{t("report.reviewTitle")}</h1>
          {/* With no model that passed evaluation the API returns "unavailable": say so calmly. */}
          {(!photo || analysis.data?.status === "unavailable" || analysis.isError) && (
            <p className="pa-notice mt-6">{t("report.reviewUnavailable")}</p>
          )}
          <StepNav onBack={() => go("location")} onNext={() => go("details")} />
        </section>
      )}

      {step === "details" && (
        <form
          aria-labelledby="step-title"
          noValidate
          onSubmit={form.handleSubmit(() => go("send"))}
        >
          <h1 id="step-title" ref={headingRef} tabIndex={-1} className="pa-step-title">{t("report.detailsTitle")}</h1>
          <div className="mt-6 grid gap-5">
            <div>
              <label htmlFor="kind" className="pa-field-label">{t("report.kind")}</label>
              <select id="kind" className="pa-input" {...form.register("kind")}>
                {HazardKind.options.filter((k) => k !== "steep_change").map((k) => (
                  <option key={k} value={k}>{t(`hazards.kinds.${k}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="description" className="pa-field-label">{t("report.description")}</label>
              <p id="description-hint" className="text-sm text-ink-muted">{t("report.descriptionHint")}</p>
              <textarea id="description" rows={4} maxLength={500} className="pa-input mt-2" aria-describedby="description-hint" {...form.register("description")} />
            </div>
            <div>
              <label htmlFor="observedOn" className="pa-field-label">{t("report.observedOn")}</label>
              <input id="observedOn" type="date" max={today()} className="pa-input" aria-invalid={Boolean(form.formState.errors.observedOn)} {...form.register("observedOn")} />
            </div>
          </div>
          <StepNav onBack={() => go("review")} submit />
        </form>
      )}

      {step === "send" && (
        <section aria-labelledby="step-title">
          <h1 id="step-title" ref={headingRef} tabIndex={-1} className="pa-step-title">{t("report.sendTitle")}</h1>
          <dl className="pa-evidence mt-6">
            <div><dt>{t("report.kind")}</dt><dd>{t(`hazards.kinds.${form.getValues("kind")}`)}</dd></div>
            <div><dt>{t("report.locationTitle")}</dt><dd>{place?.label}</dd></div>
            <div><dt>{t("report.observedOn")}</dt><dd className="tabular">{form.getValues("observedOn")}</dd></div>
          </dl>
          {sentMessage ? (
            <p className="pa-notice mt-6" role="status">{sentMessage}</p>
          ) : (
            <div className="mt-8 flex gap-3">
              <button type="button" className="pa-link-button" onClick={() => go("details")}>{t("common.back")}</button>
              <button type="button" className="pa-link-button is-primary" onClick={() => send.mutate(form.getValues())} disabled={send.isPending} aria-busy={send.isPending}>
                {send.isPending ? t("report.sending") : t("report.send")}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StepNav({ onBack, onNext, nextDisabled, submit }: { onBack?: () => void; onNext?: () => void; nextDisabled?: boolean; submit?: boolean }) {
  const t = useTranslations("common");
  return (
    <div className="mt-8 flex gap-3">
      {onBack && (
        <button type="button" className="pa-link-button" onClick={onBack}>
          {t("back")}
        </button>
      )}
      <button type={submit ? "submit" : "button"} className="pa-link-button is-primary" onClick={submit ? undefined : onNext} disabled={nextDisabled}>
        {t("next")}
      </button>
    </div>
  );
}
