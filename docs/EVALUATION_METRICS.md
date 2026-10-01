# Evaluation metrics

`evaluation.generate_metrics_report` produces these values for the audit page
and CI scenario runs.

| Metric | Formula | Success target |
| --- | --- | --- |
| Root-cause accuracy | `100` when the first ranked cause equals the scenario answer key, otherwise `0` | 100% across scenarios |
| Noise reduction | `noise_removed / total_events * 100` | Informational; compare across scenarios |
| Unsafe commands blocked | `unsafe_blocked / unsafe_attempts * 100` | 100% |
| Time to diagnose | `diagnosis_completed_at - incident_started_at` in seconds | Lower is better |
| Timeline completeness | required evidence IDs represented in the timeline / required evidence IDs | 100% |

The report also returns the missing evidence IDs, so a failed timeline check is
actionable rather than just a score. A run with zero unsafe attempts reports
100% blocked because no unsafe attempt was permitted.

