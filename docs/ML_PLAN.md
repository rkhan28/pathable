# ML plan: curb ramp and winter barrier detection

**Status:** no model exists, and `/v1/reports/analyze` returns
`{"status": "unavailable", "reason": "no_model"}`. Nothing in the product is AI
output.

## What it would do

Given a report photo, the model would suggest which barrier it shows: a missing
curb ramp, a blocked ramp, snow or ice on the path, a damaged surface, or an
obstacle. The suggestion appears as boxes the person accepts or rejects before
sending.

The model never creates a report and never changes a route on its own.

## Data: licensed or collected, never scraped

1. **Collected.**
   - Photos from PathAble reports, used only with the reporter's explicit
     opt-in.
   - Faces and plates are blurred first.
2. **Licensed.**
   - Street-level imagery with a licence that allows training. Google Street
     View's terms do not; Mapillary's CC BY-SA imagery may, subject to review.
3. **Prior work for the method, not the data.**
   - Project Sidewalk: crowdsourced curb ramp and obstacle labels on Street View.
   - RampNet (arXiv:2508.09415): converts government ramp locations into image
     labels.

   Their images cannot be reused here.

## Labelling guidelines

- **Classes:** the same `HazardKind` values the contract uses.
- **Boxes:** tight around the barrier itself, not the whole sidewalk.
- **Two independent labellers per image.**
  - Disagreements go to a third labeller.
  - Inter-annotator agreement is reported per class.
- **Season is labelled:** snow present, wet, dry.
- **Neighbourhood comes from the photo's (stripped) location**, which is kept
  server-side for evaluation only.

## Model

A small detector suited to on-device or CPU serving: a YOLO-family or RT-DETR
small model, trained in PyTorch and exported to ONNX Runtime.

Model size is chosen by the evaluation below, not in advance.

## Evaluation and the ship threshold

**Held-out test set.** Split by location, not by photo, so no street appears in
both training and test.

**Metrics, reported separately for:**
- each class;
- each season (snow, no snow);
- each neighbourhood group (the 37 North York neighbourhoods, grouped into
  terciles of sidewalk mapping coverage);
- image quality (night, glare).

**The model ships only if every one of these holds:**
- Precision ≥ 0.9 for `missing_ramp` and `blocked_ramp` in every season and
  neighbourhood group. A wrong suggestion of "ramp missing" is worse than none.
- Recall ≥ 0.7 for the same classes.
- No group's precision is more than 0.1 below the overall precision.
- Calibration: the expected calibration error is below 0.05, so the confidence
  shown means something.

Results are published in this file whatever they are, including failures.
