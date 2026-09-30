# EdgeFlags Experiments

EdgeFlags is intended to produce repeatable observations, not only implementation
milestones. This document is the catalog and recording format for those
experiments.

No experiment has been executed yet.

## Experiment lifecycle

1. State a falsifiable hypothesis.
2. Record prerequisites and the relevant deployed version.
3. Define a procedure that another person can repeat.
4. Define the expected result before running the experiment.
5. Capture observations, including unexpected behavior and limitations.
6. Record a conclusion and any resulting issue, ADR, or documentation change.

An experiment is not complete when traffic has merely been generated. Its
observations and limitations must be recorded.

## Experiment template

Create experiment records under `docs/experiments/` when the first experiment is
implemented. Use a short numeric identifier and kebab-case name.

```markdown
# EXP-NNNN: Title

- **Status:** Planned | Running | Completed | Inconclusive
- **Date:** YYYY-MM-DD
- **Related phase:** Phase N
- **Related issues:** #123

## Hypothesis

## Preconditions

## Procedure

## Expected result

## Observations

## Conclusion

## Limitations

## Follow-up
```

Do not create empty experiment files in advance. Add a record when its procedure
can be run or when planning it is itself part of an active phase.

## Planned catalog

| Experiment | Intended phase | Primary question |
| --- | --- | --- |
| Measure KV propagation delay after an update | Phase 15 | How long can remote locations observe stale values? |
| Observe stale reads across locations | Phase 15 | How does location affect read-after-write behavior? |
| Evaluate KV suitability | Phase 15 | Which feature flag use cases require stronger consistency? |
| Exhaust configured rate limits | Phase 9 or 14 | Is `429` behavior predictable and observable? |
| Rotate an API key | Phase 8 | Can credentials rotate without interrupting valid clients? |
| Inject 500 ms of latency | Phase 14 | Does the latency SLI reflect controlled degradation? |
| Inject evaluation failures | Phase 14 | Does the availability SLI reflect controlled failures? |
| Generate a traffic spike with k6 | Phase 14 | How does the service and telemetry react to a spike? |
| Destroy and recreate development infrastructure | Phase 5 | Is the environment reproducible through Terragrunt? |
| Compare local and deployed Worker behavior | Phase 4 | Do bindings and evaluation behave consistently? |
| Evaluate OpenFeature and OFREP compatibility | Phase 11 | Which interoperability boundary fits the service? |

The phase numbers indicate the earliest expected implementation point. They may
change if a prerequisite or provider limitation is discovered.

## Evidence

Useful evidence may include:

- exact commands and configuration used,
- timestamps and request identifiers,
- anonymized request or response samples,
- dashboard or trace links,
- exported measurements,
- relevant provider limits, and
- known sources of measurement error.

Never commit credentials, sensitive headers, or unredacted API keys as experiment
evidence.
