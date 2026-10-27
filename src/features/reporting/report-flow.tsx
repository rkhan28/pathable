"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  CircleCheckIcon,
  CloudOffIcon,
  ImageUpIcon,
  LocateFixedIcon,
  RefreshCwIcon,
  ScanSearchIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TrashIcon,
} from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { HAZARD_TYPES, WINTER_HAZARDS, type AnalysisResponse, type LatLng, type ReportSubmission } from "@/api/contracts";
import { ApiError, toApiError } from "@/api/errors";
import { coordinatePlace, reverseGeocode, type Place } from "@/api/geocoding";
import { getService } from "@/api/service";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Checkbox, Field, Label, Textarea } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { announce } from "@/features/a11y/announcer";
import { usePrefersReducedMotion } from "@/features/a11y/use-reduced-motion";
import { HAZARD_ICON } from "@/features/hazards/hazard-visuals";
import { PlaceSearch } from "@/features/navigation/place-search";
import { useGeolocation } from "@/features/navigation/use-geolocation";
import { Link } from "@/i18n/navigation";
import { formatCoordinate } from "@/lib/geo";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DetectionOverlay, type DetectionDecision } from "./detection-overlay";
import { sanitizeImage, validateImage } from "./image-utils";
import { MyReports } from "./my-reports";
import { useReports } from "./report-store";

const MapView = dynamic(() => import("@/features/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-0 rounded-none" />,
});

const STEPS = ["photo", "location", "analysis", "details", "submit"] as const;
type Step = (typeof STEPS)[number];

const DetailsSchema = z.object({
  hazardType: z.enum(HAZARD_TYPES, { error: "typeRequired" }),
  severity: z.enum(["blocking", "caution"]),
  description: z.string().max(500),
  temporary: z.boolean(),
});
type Details = z.infer<typeof DetailsSchema>;

type Outcome = { kind: "sent"; id: string } | { kind: "draft" } | null;

export function ReportFlow() {
  const t = useTranslations("report");
  const tCommon = useTranslations("common");
  const tHaz = useTranslations("hazards");
  const tSearch = useTranslations("search");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const addReport = useReports((s) => s.add);
  const geo = useGeolocation();
  const formId = useId();

  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Photo
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Location
  const [place, setPlace] = useState<Place | null>(null);
  const [locationError, setLocationError] = useState(false);

  // Analysis
  const [decisions, setDecisions] = useState<Record<string, DetectionDecision>>({});
  const analysis = useMutation<AnalysisResponse, ApiError, Blob>({
    mutationFn: async (blob) => {
      try {
        return await (await getService()).analyzePhoto(blob);
      } catch (e) {
        throw toApiError(e);
      }
    },
    onSuccess: (data) => announce(t("analysis.detectionsTitle", { count: data.detections.length })),
  });

  // Details
  const form = useForm<Details>({
    resolver: zodResolver(DetailsSchema),
    defaultValues: { hazardType: undefined, severity: "caution", description: "", temporary: false },
  });

  const values = useWatch({ control: form.control }) as Details;
  const [outcome, setOutcome] = useState<Outcome>(null);
  const submit = useMutation<{ kind: "sent"; id: string } | { kind: "draft" }, ApiError, ReportSubmission>({
    mutationFn: async (submission) => {
      const localId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      try {
        const receipt = await (await getService()).submitReport(submission);
        addReport({ localId, createdAt, submission, receipt });
        return { kind: "sent", id: receipt.id };
      } catch (e) {
        const err = toApiError(e);
        // Not configured / offline: keep it locally and say so plainly. Never pretend it was sent.
        if (["backend_not_configured", "network", "timeout", "unavailable"].includes(err.code)) {
          addReport({ localId, createdAt, submission, receipt: null });
          return { kind: "draft" };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      setOutcome(result);
      announce(result.kind === "sent" ? t("success.title") : t("draftSaved.title"), "assertive");
    },
  });

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex, outcome]);

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setPhotoError(t(`photo.${problem}`));
      return;
    }
    setPhotoError(null);
    setProcessing(true);
    try {
      const { blob, width, height } = await sanitizeImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob), width, height });
      analysis.reset();
      setDecisions({});
    } catch {
      setPhotoError(t("photo.invalidType"));
    } finally {
      setProcessing(false);
    }
  }

  async function useCurrentLocation() {
    const loc = await geo.locate();
    if (!loc) return;
    const named = await reverseGeocode(loc, locale);
    setPlace(named ? { ...named, location: loc } : coordinatePlace(loc, tSearch("myLocation"), "current_location"));
    setLocationError(false);
  }

  const detections = useMemo(() => analysis.data?.detections ?? [], [analysis.data]);
  const accepted = detections.filter((d) => decisions[d.id] === "keep");
  const topAccepted = [...accepted].sort((a, b) => b.confidence - a.confidence)[0];

  // Pre-fill the type from the person's reviewed (kept) suggestion — never from an unreviewed one.
  useEffect(() => {
    if (topAccepted && !form.getValues("hazardType")) {
      form.setValue("hazardType", topAccepted.label);
      form.setValue("temporary", WINTER_HAZARDS.includes(topAccepted.label) || topAccepted.label === "construction");
    }
  }, [topAccepted, form]);

  function goNext() {
    if (step === "location" && !place) {
      setLocationError(true);
      return;
    }
    if (step === "details") {
      void form.handleSubmit(() => setStepIndex((i) => i + 1))();
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function doSubmit() {
    const values = form.getValues();
    if (!place || !values.hazardType) return;
    const submission: ReportSubmission = {
      hazardType: values.hazardType,
      location: place.location,
      locationLabel: place.name,
      severity: values.severity,
      description: values.description.trim(),
      observedAt: new Date().toISOString(),
      temporary: values.temporary,
      analysis: analysis.data
        ? {
            analysisId: analysis.data.analysisId,
            acceptedDetectionIds: accepted.map((d) => d.id),
            rejectedDetectionIds: detections.filter((d) => decisions[d.id] === "reject").map((d) => d.id),
            correctedByUser: Boolean(detections[0] && detections[0].label !== values.hazardType),
          }
        : null,
    };
    submit.mutate(submission);
  }

  function reset() {
    setOutcome(null);
    setStepIndex(0);
    setPhoto(null);
    setPlace(null);
    analysis.reset();
    submit.reset();
    setDecisions({});
    form.reset();
  }

  /* --------------------------------------------------------------- outcome */
  if (outcome) {
    const sent = outcome.kind === "sent";
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-14">
        <div className={cn("flex flex-col items-start gap-4 rounded-xl p-8", sent ? "bg-verified-soft" : "bg-unverified-soft")}>
          {sent ? (
            <svg viewBox="0 0 52 52" className="size-16 text-verified" aria-hidden="true">
              <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <motion.path
                d="M15 27l7 7 15-16"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          ) : (
            <CloudOffIcon className="size-14 text-unverified" aria-hidden="true" />
          )}
          <h1 ref={headingRef} tabIndex={-1} className="text-headline font-semibold outline-none">
            {sent ? t("success.title") : t("draftSaved.title")}
          </h1>
          <p className="text-lg text-fg-muted">{sent ? t("success.body") : t("draftSaved.body")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}>{t("success.another")}</Button>
          <Button asChild variant="secondary">
            <Link href="/settings#my-reports">{t("success.viewMine")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <div>
          <h1 className="font-display text-headline">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-lg text-fg-muted">{t("intro")}</p>
        </div>

        <nav aria-label={t("stepsLabel")}>
          <ol className="flex flex-wrap gap-x-1 gap-y-2">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === stepIndex ? "step" : undefined} className="flex items-center gap-1">
                <span
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
                    i === stepIndex ? "bg-primary text-primary-fg" : i < stepIndex ? "bg-verified-soft text-verified" : "bg-bg-subtle text-fg-muted",
                  )}
                >
                  {i < stepIndex ? <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
                  {t(`steps.${s}`)}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <section aria-labelledby={`${formId}-heading`} className="flex flex-col gap-6">
          <h2 id={`${formId}-heading`} ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
            {step === "photo" && t("photo.title")}
            {step === "location" && t("location.title")}
            {step === "analysis" && t("analysis.title")}
            {step === "details" && t("details.title")}
            {step === "submit" && t("review.title")}
          </h2>

          {/* ------------------------------------------------------- PHOTO */}
          {step === "photo" ? (
            <>
              <p className="-mt-3 text-fg-muted">{t("photo.body")}</p>
              {photo ? (
                <figure className="flex flex-col gap-3">
                  <img src={photo.url} alt={t("photo.preview")} className="max-h-[26rem] w-full rounded-xl border border-border object-contain bg-surface-sunken" />
                  <figcaption className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                      <RefreshCwIcon aria-hidden="true" />
                      {t("photo.replace")}
                    </Button>
                    <Button variant="ghost" onClick={() => setPhoto(null)}>
                      <TrashIcon aria-hidden="true" />
                      {t("photo.remove")}
                    </Button>
                  </figcaption>
                </figure>
              ) : (
                // Drag-and-drop is a pointer convenience; the buttons inside are the accessible path.
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void acceptFile(e.dataTransfer.files[0]);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                    dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-surface",
                  )}
                >
                  <ImageUpIcon className="size-10 text-fg-muted" aria-hidden="true" />
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button onClick={() => cameraInput.current?.click()} loading={processing} loadingLabel={t("photo.processing")}>
                      <CameraIcon aria-hidden="true" />
                      {t("photo.take")}
                    </Button>
                    <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                      {t("photo.choose")}
                    </Button>
                  </div>
                  <p className="text-sm text-fg-muted">{t("photo.drop")}</p>
                </div>
              )}
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void acceptFile(e.target.files?.[0])} />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                data-testid="report-file-input"
                onChange={(e) => void acceptFile(e.target.files?.[0])}
              />
              {photoError ? (
                <Callout tone="danger" role="alert">
                  {photoError}
                </Callout>
              ) : null}
              <p className="text-sm text-fg-muted">{t("photo.privacy")}</p>
            </>
          ) : null}

          {/* ---------------------------------------------------- LOCATION */}
          {step === "location" ? (
            <>
              <p className="-mt-3 text-fg-muted">{t("location.body")}</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={useCurrentLocation} loading={geo.loading} loadingLabel={tSearch("locating")}>
                  <LocateFixedIcon aria-hidden="true" />
                  {t("location.current")}
                </Button>
              </div>
              {geo.error ? (
                <Callout tone="warning" role="alert">
                  {geo.error === "denied" ? tSearch("locationDenied") : tSearch("locationUnavailable")}
                </Callout>
              ) : null}
              <PlaceSearch label={t("location.search")} placeholder={t("location.searchPlaceholder")} value={place} onChange={(p) => { setPlace(p); if (p) setLocationError(false); }} allowCurrentLocation={false} />
              <div className="relative h-72 overflow-hidden rounded-xl border border-border">
                <MapView
                  routes={[]}
                  selectedRouteId={null}
                  onSelectRoute={() => undefined}
                  origin={null}
                  destination={place?.location ?? null}
                  userLocation={null}
                  routeHazards={[]}
                  nearbyHazards={[]}
                  picking
                  onPick={async (loc: LatLng) => {
                    setPlace(coordinatePlace(loc, tSearch("pickedPoint")));
                    setLocationError(false);
                    const named = await reverseGeocode(loc, locale);
                    if (named) setPlace({ ...named, location: loc, kind: "coordinates" });
                  }}
                  onStatusChange={() => undefined}
                  fitPadding={{ top: 40, bottom: 40, left: 40, right: 40 }}
                />
                <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-surface-raised/95 px-3 py-2 text-sm shadow-2">{t("location.pick")}</p>
              </div>
              <p className="text-sm" role="status">
                {place ? (
                  <>
                    <span className="font-semibold">{t("location.selected")}: </span>
                    {place.name} <span className="text-fg-muted">({formatCoordinate(place.location)})</span>
                    {geo.accuracy && place.kind === "current_location" ? <span className="text-fg-muted">, {t("location.accuracy", { meters: geo.accuracy })}</span> : null}
                  </>
                ) : (
                  <span className="text-fg-muted">{t("location.none")}</span>
                )}
              </p>
              {locationError ? (
                <p className="font-semibold text-barrier" role="alert">
                  {t("location.required")}
                </p>
              ) : null}
            </>
          ) : null}

          {/* ---------------------------------------------------- ANALYSIS */}
          {step === "analysis" ? (
            !photo ? (
              <Callout tone="neutral">{t("analysis.noPhoto")}</Callout>
            ) : (
              <>
                <div className="relative overflow-hidden rounded-xl border border-border bg-surface-sunken">
                  <div className="relative mx-auto" style={{ aspectRatio: `${photo.width} / ${photo.height}`, maxHeight: "26rem" }}>
                    <img src={photo.url} alt={t("photo.preview")} className="h-full w-full object-contain" />
                    <DetectionOverlay detections={detections} decisions={decisions} />
                    {analysis.isPending ? (
                      <div className="absolute inset-0 grid place-items-center bg-fg/35 backdrop-blur-[1px]">
                        {!reduced ? (
                          <motion.span
                            aria-hidden="true"
                            className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-white/40 to-transparent"
                            initial={{ top: "-10%" }}
                            animate={{ top: "100%" }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          />
                        ) : null}
                        <span className="relative rounded-full bg-surface-raised px-4 py-2 font-semibold shadow-3" role="status">
                          {t("analysis.running")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {analysis.isIdle ? (
                  <div className="flex flex-col items-start gap-2">
                    <Button onClick={() => analysis.mutate(photo.blob)}>
                      <ScanSearchIcon aria-hidden="true" />
                      {t("analysis.run")}
                    </Button>
                    <p className="text-sm text-fg-muted">{t("analysis.disclaimer")}</p>
                  </div>
                ) : null}

                {analysis.isError ? (
                  analysis.error.code === "unavailable" || analysis.error.code === "backend_not_configured" ? (
                    <Callout tone="info" title={t("analysis.unavailableTitle")} role="status" icon={CloudOffIcon}>
                      {t("analysis.unavailableBody")}
                    </Callout>
                  ) : (
                    <Callout
                      tone="danger"
                      role="alert"
                      title={t("analysis.errorTitle")}
                      action={
                        <Button variant="secondary" size="sm" onClick={() => analysis.mutate(photo.blob)}>
                          {tCommon("retry")}
                        </Button>
                      }
                    >
                      {tErrors(analysis.error.code)}
                    </Callout>
                  )
                ) : null}

                {analysis.data ? (
                  <div className="flex flex-col gap-4">
                    {analysis.data.qualityIssues.map((q) => (
                      <Callout key={q} tone="warning">
                        {t(`analysis.quality.${q}`)}
                      </Callout>
                    ))}
                    {detections.length === 0 ? (
                      <Callout tone="neutral">{t("analysis.noDetections")}</Callout>
                    ) : (
                      <>
                        <h3 className="font-semibold">{t("analysis.detectionsTitle", { count: detections.length })}</h3>
                        <ul className="flex flex-col gap-2">
                          {detections.map((d, i) => {
                            const Icon = HAZARD_ICON[d.label];
                            const decision = decisions[d.id];
                            return (
                              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-raised p-3">
                                <span className="grid size-9 place-items-center rounded-full bg-bg-subtle font-semibold">{i + 1}</span>
                                <Icon className="size-5 text-fg-muted" aria-hidden="true" />
                                <span className="flex-1">
                                  <span className="block font-semibold">{tHaz(`types.${d.label}`)}</span>
                                  <span className="text-sm text-fg-muted">{t("analysis.confidence", { percent: `${Math.round(d.confidence * 100)}%` })}</span>
                                </span>
                                <div className="flex gap-2" role="group" aria-label={`${i + 1}. ${tHaz(`types.${d.label}`)}`}>
                                  <Button size="sm" variant={decision === "keep" ? "accent" : "secondary"} aria-pressed={decision === "keep"} onClick={() => setDecisions((s) => ({ ...s, [d.id]: "keep" }))}>
                                    <ThumbsUpIcon aria-hidden="true" />
                                    {t("analysis.keep")}
                                  </Button>
                                  <Button size="sm" variant={decision === "reject" ? "danger" : "secondary"} aria-pressed={decision === "reject"} onClick={() => setDecisions((s) => ({ ...s, [d.id]: "reject" }))}>
                                    <ThumbsDownIcon aria-hidden="true" />
                                    {t("analysis.reject")}
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    <p className="text-sm text-fg-muted">
                      {t("analysis.modelInfo", { name: analysis.data.model.name, version: analysis.data.model.version, when: formatDateTime(analysis.data.processedAt, locale) })}
                    </p>
                  </div>
                ) : null}
              </>
            )
          ) : null}

          {/* ----------------------------------------------------- DETAILS */}
          {step === "details" ? (
            <form id={`${formId}-details`} className="flex flex-col gap-7" onSubmit={(e) => e.preventDefault()} noValidate>
              <Controller
                control={form.control}
                name="hazardType"
                render={({ field, fieldState }) => (
                  <fieldset aria-describedby={fieldState.error ? `${formId}-type-error` : undefined}>
                    <legend className="font-semibold">{t("details.type")}</legend>
                    {topAccepted ? <p className="mt-1 text-sm text-fg-muted">{t("details.typeFromAi")}</p> : null}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {HAZARD_TYPES.map((type) => {
                        const Icon = HAZARD_ICON[type];
                        const checked = field.value === type;
                        return (
                          <label
                            key={type}
                            className={cn(
                              "flex min-h-14 cursor-pointer items-center gap-2.5 rounded-lg border-2 bg-surface-raised px-3 py-2 text-[0.95rem] font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                              checked ? "border-fg font-semibold shadow-2" : "border-border hover:border-border-strong",
                            )}
                          >
                            <input
                              type="radio"
                              name={field.name}
                              value={type}
                              checked={checked}
                              onChange={() => {
                                field.onChange(type);
                                if (WINTER_HAZARDS.includes(type) || type === "construction") form.setValue("temporary", true);
                              }}
                              className="sr-only"
                            />
                            <Icon className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
                            {tHaz(`types.${type}`)}
                          </label>
                        );
                      })}
                    </div>
                    {fieldState.error ? (
                      <p id={`${formId}-type-error`} className="mt-2 font-semibold text-barrier" role="alert">
                        {t("details.typeRequired")}
                      </p>
                    ) : null}
                  </fieldset>
                )}
              />
              <div className="flex flex-col gap-2">
                <span className="font-semibold" id={`${formId}-severity`}>
                  {t("details.severity")}
                </span>
                <Controller
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <Segmented
                      label={t("details.severity")}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={[
                        { value: "caution", label: tHaz("severity.caution") },
                        { value: "blocking", label: tHaz("severity.blocking") },
                      ]}
                    />
                  )}
                />
              </div>
              <Field id={`${formId}-description`} label={`${t("details.description")} (${tCommon("optional")})`} hint={t("details.descriptionHint")}>
                <Textarea maxLength={500} {...form.register("description")} />
              </Field>
              <Controller
                control={form.control}
                name="temporary"
                render={({ field }) => (
                  <div className="flex items-start gap-3">
                    <Checkbox id={`${formId}-temporary`} checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} aria-describedby={`${formId}-temporary-hint`} className="mt-0.5" />
                    <div>
                      <Label htmlFor={`${formId}-temporary`}>{t("details.temporary")}</Label>
                      <p id={`${formId}-temporary-hint`} className="text-sm text-fg-muted">
                        {t("details.temporaryHint")}
                      </p>
                    </div>
                  </div>
                )}
              />
            </form>
          ) : null}

          {/* ------------------------------------------------------ SUBMIT */}
          {step === "submit" ? (
            <>
              <dl className="grid gap-4 rounded-xl border border-border bg-surface-raised p-5 sm:grid-cols-[10rem_1fr]">
                <dt className="font-semibold">{t("review.photo")}</dt>
                <dd>{photo ? <img src={photo.url} alt={t("photo.preview")} className="h-28 rounded-md object-cover" /> : <span className="text-fg-muted">{t("review.noPhoto")}</span>}</dd>
                <dt className="font-semibold">{t("review.location")}</dt>
                <dd>
                  {place?.name} <span className="text-sm text-fg-muted">{place ? `(${formatCoordinate(place.location)})` : ""}</span>
                </dd>
                <dt className="font-semibold">{t("review.type")}</dt>
                <dd>
                  {values.hazardType ? tHaz(`types.${values.hazardType}`) : null}, {tHaz(`severity.${values.severity}`)}
                  {values.description ? <p className="mt-1 text-fg-muted">“{values.description}”</p> : null}
                </dd>
                <dt className="font-semibold">{t("review.ai")}</dt>
                <dd className="text-fg-muted">
                  {analysis.data
                    ? t("review.aiReviewed", { kept: accepted.length, rejected: detections.filter((d) => decisions[d.id] === "reject").length })
                    : t("review.aiNotUsed")}
                </dd>
              </dl>
              {submit.isError ? (
                <Callout tone="danger" role="alert">
                  {tErrors(submit.error.code)}
                </Callout>
              ) : null}
            </>
          ) : null}
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={() => setStepIndex((i) => i - 1)}>
              <ArrowLeftIcon className="rtl:rotate-180" aria-hidden="true" />
              {tCommon("back")}
            </Button>
          ) : (
            <span />
          )}
          {step === "submit" ? (
            <Button size="lg" onClick={doSubmit} loading={submit.isPending} loadingLabel={t("review.submitting")}>
              <CircleCheckIcon aria-hidden="true" />
              {t("review.submit")}
            </Button>
          ) : (
            <Button size="lg" onClick={goNext}>
              {step === "photo" && !photo ? t("photo.skip") : tCommon("continue")}
            </Button>
          )}
        </div>
      </div>

      <aside aria-labelledby="my-reports-heading" className="lg:border-s lg:border-border lg:ps-8">
        <MyReports compact />
      </aside>
    </div>
  );
}
