# Architecture and data flow

```text
logs / tickets / deploys / chat
             │
             ▼
      parser + event contract ──► queue
                                      │
                                      ▼
       noise filter → correlation → root-cause ranking
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
           fixed-code guardrail                  timeline scribe
                    │                                   │
                    └──────────► append-only store ◄────┘
                                      │
                                      ▼
                              dashboard / WebSocket
```

The production boundary is deliberately one-way: collectors send data in, but the dashboard never connects back to a project. Agent output is schema-validated and evidence IDs must resolve to ingested events. The fixed-code guardrail evaluates every suggested diagnostic before it reaches the UI. Approval writes an audit entry; it does not create a command or callback.

For the standalone MVP, these components are represented by clear browser states and local sample data. The `guardrails` module supplies the production-oriented policy logic and its adversarial test set.
