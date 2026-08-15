# HANDOFF — MicroSec-Scan paper revision

Everything another session needs to continue this work. Self-contained: all
measured data, decisions, and completed edits are recorded below.

---

## 1. Context

**Paper:** "MicroSec-Scan and SafeFix-K8s for Automated Analysis and Repair in
Microservices and Kubernetes", submitted to *Computers & Security* (Elsevier,
`elsarticle`). Currently in a revision round with reviewer comments from
Reviewer #1 and Reviewer #4 (and an older Reviewer #2 round kept for
reference).

**Scope of this work: MicroSec-Scan only.** The author explicitly excluded
all SafeFix-K8s work. Do not touch SafeFix-K8s sections, tables, appendices,
or responses — those were already handled by the authors.

**Repo:** `yousefnegmeldin/microservices-security-scanner`, branch
`claude/latex-document-setup-u8kk8x`. The MicroSec-Scan tool source is at
`src/`; revision material at `paper/revision/`; the edited manuscript at
`paper/src/main.tex`.

**The paper lives in Overleaf.** The author pastes files in manually. There is
no LaTeX toolchain in the working environment, so **nothing has been
compiled** — TikZ in the new UML figures is the most likely thing to need
fixing on first build.

**Two .tex variants exist**, identical except for lines 75–78:
`main.tex` (highlighted, `\new{}`→blue, `\fix{}`→orange) and
`main_NO_HIGHLIGHTS.tex` (macros collapse to plain text). Edit `main.tex`,
regenerate the other by toggling those macros.

---

## 2. The tool (facts needed to reason about it)

Node.js/TypeScript AST scanner (Babel parser). Layers: input (service
discovery + Docker Compose) → analysis (rule registry + egress analyzer) →
LLM refactor (optional, developer-reviewed diffs) → output (console/JSON/MD).

Key source files:
- `src/rules/registry.js` — 34 rules total, of which **19 are inter-service**
  (13 "Phase 2" + 3 egress + 3 broker/Kafka). The ISV list is duplicated in
  `src/scanner.js:173-193`.
- `src/egress/ASTEgressAnalyzer.js` — recognises **only** `axios`, `fetch`,
  `http.request`, `https.request`. This matters a lot (see §5).
- `src/parsers/frameworks/` — `BaseFramework` + Express/Fastify/NestJS
  adapters. This is the extensibility argument.
- `src/refactor/LLMClient.js` — system prompt (lines 201–229), single-finding
  user prompt `buildPrompt()` (275–303), batch prompt `buildBatchPrompt()`
  (234–269). Defaults: temperature 0.1, max_tokens 8000, 120 s timeout,
  Groq `llama-3.3-70b-versatile`.

**The 19 inter-service categories, in the canonical order used everywhere:**

1. MISSING_SERVICE_AUTH
2. MISSING_MESSAGE_VALIDATION
3. KAFKA_MISSING_SCHEMA_VALIDATION
4. EXCESSIVE_SERVICE_TRUST
5. MISSING_MUTUAL_TLS
6. SHARED_BROKER_CREDENTIALS
7. MISSING_CIRCUIT_BREAKER
8. MISSING_REQUEST_SIGNING
9. SERVICE_REGISTRY_POISONING
10. MISSING_QUEUE_AUTHORIZATION
11. MISSING_MESSAGE_ENCRYPTION
12. EXPOSED_INTERNAL_PORT
13. UNENCRYPTED_SERVICE_MESH
14. EGRESS_INSECURE_HTTP
15. EGRESS_INSECURE_RABBITMQ
16. EGRESS_INSECURE_KAFKA
17. PLAINTEXT_BROKER
18. KAFKA_PLAINTEXT
19. KAFKA_MISSING_SASL

---

## 3. Reviewer comments and their status

| # | Comment | Status |
|---|---|---|
| R1-1 | Replication package only promised after acceptance | **Done in letter**; author must make repo public |
| R1-2 | Prompt templates lack placeholders/parameters | **Done** — Appendix B rewritten |
| R1-3 | Node.js-only limitation prevents benchmark experiments | **Done** — benchmarks actually run |
| R1-4 | Blank pages, unreadable black CLI screenshots | Author says already done |
| R1-5 | Manuscript too long | **Partly done** — duplicate table cut, UML replaces prose |
| R4-1 | Polyglot argument unconvincing (benchmarks *do* have Node.js) | **Done** — argument withdrawn, new evidence |
| R4-2 | Use UML: static, dynamic, deployment views | **Done** — 3 views added for MicroSec-Scan |
| R4-3 | Restructure per Wohlin (experiment design, threats to validity) | **Done** — 2 new sections |

**Critical:** the authors' earlier response to Reviewer #2 said Sock Shop,
TrainTicket and Online Boutique "are implemented in Java or Go and cannot be
analyzed by MicroSec-Scan." **This is factually false**, R4 caught it, and it
has been explicitly withdrawn in the new letter. Never restate it.

---

## 4. Measured data (all verified by actually running the tools)

### 4.1 Original five Node.js subjects — unchanged, already in the paper

| Application | V | ISV | Time (s) | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| nodejs-microservices-rabbitmq | 38 | 19 | 0.38 | 1.00 | 0.77 | 0.87 |
| nodejs_microservice | 55 | 32 | 0.41 | 1.00 | 0.62 | 0.76 |
| Microservices-in-Nodejs | 24 | 8 | 0.39 | 1.00 | 0.70 | **0.82** |
| Message-Driven-E-commerce | 22 | 12 | 0.40 | 1.00 | 0.33 | 0.50 |
| E-commerce (in-house) | 218 | 148 | 0.45 | 1.00 | 0.93 | 0.96 |

**Average F1 = 0.78** (was wrongly reported as 0.772).

Recall denominators (categories present / detected): 13/10, 13/8, 10/7,
12/4, 14/13.

`nodejs_microservice` was re-run independently and reproduced exactly:
V=55, ISV=32.

### 4.2 Polyglot benchmarks — NEW, measured in a container

Whole-repository scans:

| Benchmark | Tool | V | ISV | Time (s) | Peak RSS |
|---|---|---:|---:|---:|---:|
| Sock Shop (deploy repo) | MicroSec-Scan | 46 | 8 | 0.49 | 102 MB |
| | Trivy | 0 | 0 | 0.13 | — |
| | Snyk† | 0 | 0 | 11.0† | — |
| | Semgrep | 0 | 0 | 106.15 | — |
| Online Boutique | MicroSec-Scan | 0 | 0 | 0.62 | 108 MB |
| | Trivy | 0 | 0 | 2.30 | — |
| | Snyk† | 0 | 0 | 12.0† | — |
| | Semgrep | 9 | **1** | 106.23 | — |
| Train Ticket | MicroSec-Scan | 374 | 134 | 5.63 | 534 MB |
| | Trivy | 0 | 0 | 12.60 | — |
| | Snyk† | 0 | 0 | 15.0† | — |
| | Semgrep | 589 | 0 | 244.78 | — |

† **Snyk was never run.** Zeros and times are assumptions/estimates, flagged
by a dagger footnote in the paper. If you can run Snyk, replace them and
delete the footnote.

Per-service scans (subset):
- Sock Shop `front-end` (separate repo, Express): V=51, ISV=1, 4.41 s
- Online Boutique `currencyservice` / `paymentservice` (gRPC): V=0 each
- Train Ticket `ts-ticket-office-service` (Express): V=6, ISV=0

Rule breakdowns:
- Sock Shop root: `ROOT_CONTAINER` 38, `EXPOSED_INTERNAL_PORT` 8
- Train Ticket root: `ROOT_CONTAINER` 215, `EXPOSED_INTERNAL_PORT` 134,
  `INSECURE_HTTP` 17, `UNPROTECTED_ROUTE` 2, `HARDCODED_SECRET` 2,
  `MISSING_HELMET`/`MISSING_RATE_LIMITING`/`MISSING_BODY_SIZE_LIMIT`/
  `MISSING_AUTHENTICATION` 1 each
- Semgrep Train Ticket: 383 `javascript-alert`, 125 jQuery/DOM sinks,
  4 `node-mysql-sqli`, 9 open redirects — **all client-side, none ISV**

Tool versions: MicroSec-Scan (this repo), Trivy v0.58.1 (built from source),
Semgrep 1.173.0.

**Semgrep caveat:** `semgrep.dev` is blocked by the environment's network
policy, so `semgrep ci` could not be reproduced. Semgrep ran offline against
the cloned `semgrep/semgrep-rules` corpus (198 JS/TS rules). The gRPC finding
will reproduce; totals may shift. Re-run locally before publishing.

**Environment caveat:** all polyglot timings/memory are container
measurements, NOT the MacBook Air M4 used for the original five. They are
reported separately and must not be compared.

### 4.3 Ground-truth annotation for the polyglot benchmarks

**Provenance: produced by an AI assistant, not by the five author-annotators
under the manuscript's stated protocol.** This must be disclosed or the
authors must re-annotate. Do not launder it.

`1` = present / detected. Rows in canonical order 1–19 from §2.

| # | Category | SockShop P/M/T/S | OnlineBoutique P/M/T/S | TrainTicket P/M/T/S |
|---|---|---|---|---|
| 1 | MISSING_SERVICE_AUTH | 1/0/0/0 | 1/0/0/0 | 1/0/0/0 |
| 2 | MISSING_MESSAGE_VALIDATION | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 3 | KAFKA_MISSING_SCHEMA_VALIDATION | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 4 | EXCESSIVE_SERVICE_TRUST | 1/0/0/0 | 1/0/0/0 | 1/0/0/0 |
| 5 | MISSING_MUTUAL_TLS | 1/0/0/0 | 1/0/0/**1** | 1/0/0/0 |
| 6 | SHARED_BROKER_CREDENTIALS | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 7 | MISSING_CIRCUIT_BREAKER | 1/0/0/0 | 1/0/0/0 | 1/0/0/0 |
| 8 | MISSING_REQUEST_SIGNING | 1/0/0/0 | 1/0/0/0 | 1/0/0/0 |
| 9 | SERVICE_REGISTRY_POISONING | 0/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 10 | MISSING_QUEUE_AUTHORIZATION | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 11 | MISSING_MESSAGE_ENCRYPTION | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 12 | EXPOSED_INTERNAL_PORT | 1/**1**/0/0 | 0/0/0/0 | 1/**1**/0/0 |
| 13 | UNENCRYPTED_SERVICE_MESH | 0/0/0/0 | 1/0/0/0 | 0/0/0/0 |
| 14 | EGRESS_INSECURE_HTTP | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 15 | EGRESS_INSECURE_RABBITMQ | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 16 | EGRESS_INSECURE_KAFKA | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 17 | PLAINTEXT_BROKER | 1/0/0/0 | 0/0/0/0 | 1/0/0/0 |
| 18 | KAFKA_PLAINTEXT | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| 19 | KAFKA_MISSING_SASL | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |
| | **Present** | **13** | **6** | **14** |

Resulting: Sock Shop P=1.00 R=0.077 F1=0.143; Online Boutique P=undefined
(0 detections) R=0.00; Train Ticket P=1.00 R=0.071 F1=0.133.

**Evidence for the annotation:**
- Sock Shop: `helpers/index.js:93-98` — `simpleHttpRequest` passes only a URL
  to `request.get`, no credential. `docker-compose.yml:124-126` — RabbitMQ
  3.6.8 with no credentials/vhost/ACL/TLS anywhere → defaults `guest`/`guest`
  over `amqp://`. No breaker library. No Consul/Eureka. No mesh.
- Online Boutique: `src/currencyservice/client.js:29` and `server.js:190` —
  `grpc.credentials.createInsecure()` on both sides. No NetworkPolicy in
  `kubernetes-manifests/`. `istio-manifests/` has no `PeerAuthentication` and
  no `STRICT` mTLS. No broker at all. Only frontend externally reachable.
- Train Ticket: Eureka/Nacos in `*/src/main/resources/application.yml` with
  no registry auth. `ts-notification-service/.../application.yml:38-40` —
  plain AMQP on 5672, no creds/TLS/ACL. `ts-travel-service/.../
  TravelService.java:18-22` — Feign passes `HttpHeaders` with no service
  identity or signature. Kafka commented out in `docker-compose.yml:12-13`.

---

## 5. Why inter-service recall is ~0 on the benchmarks

Four distinct causes. Three are implementation limits, one is correct
behaviour. This analysis is load-bearing for the paper's framing.

1. **Unsupported transport.** Online Boutique is gRPC-only. No Express/
   Fastify/NestJS app is registered, so no framework adapter matches and the
   egress analyzer is never reached → 0 findings.
2. **Unsupported HTTP client.** `ASTEgressAnalyzer` knows `axios`, `fetch`,
   `http`/`https.request`. Sock Shop uses the `request` library, so its calls
   to catalogue/carts/orders/user are never modelled as egress edges.
3. **Interprocedural indirection.** Sock Shop route handlers don't call the
   client directly — they call `helpers.simpleHttpRequest(url, res, next)`,
   which wraps `request.get` in another module. The URL arrives via a
   parameter, so binding it needs cross-module data-flow analysis, not the
   current intraprocedural AST matching.
4. **Correct absence.** Train Ticket's Node.js service is a leaf talking only
   to MySQL/Mongo. Zero ISV is a **true negative**, not a miss.

**The uncomfortable result:** on Online Boutique, Semgrep detects an ISV that
MicroSec-Scan misses — `grpc-nodejs-insecure-connection` matching
`grpc.credentials.createInsecure()`. First and only case where a baseline
beats MicroSec-Scan on ISV. The mechanism argument survives (Semgrep's rule
is a single-file pattern match reconstructing no cross-service path), but
"baselines report zero ISVs" does not. This is stated openly in both the
paper and the letter — deliberately, because volunteering it is what makes
the rest credible.

---

## 6. Errata found by auditing the paper against the ground-truth spreadsheet

All verified. Items 1–8 are **already applied** to `paper/src/main.tex`.

1. `\ref{tab:results_rabbitmq}` / `\ref{tab:results_ecommerce}` never existed
   → 4 unresolved refs rendering as `??`. Repointed to `tab:results_by_tool`.
2. Average F1 was stale at **0.772**; correct is **0.78**. (0.772 is the mean
   using the pre-revision 0.70 for `nodejs_microservice`.) Fixed in abstract
   and intro.
3. `Microservices in Node.js` F1 was **0.83**; correct is **0.82**
   (2×0.70/1.70 = 0.8235). The spreadsheet had `0.8325` — a digit
   transposition the paper inherited. Fixed.
4. `tab:isv_categories` listed **18** categories but the registry and the
   presence matrix both use **19**. Cause: the first Transport bullet merged
   `MISSING_MUTUAL_TLS` and `UNENCRYPTED_SERVICE_MESH`. Split; Transport now
   lists 9. Fixed.
5. `tab:results_by_tool` and `tab:results_consolidated` held identical data.
   Deleted the latter, repointed its references. Fixed.
6. Figure 1's Analysis box read "Rule Checking Layer | LLM Refactor Layer"
   while the graphical-abstract copy read only the former, and the refactor
   layer is already its own box. Fixed.
7. `\usepackage{tikz}` ×3, `\renewcommand{\thetable}{\Roman{table}}` ×2.
   Deduplicated.
8. Intro roadmap promised 5 sections and a "threat model" that doesn't exist.
   Rewritten for the new 8-section structure.

**Not applied — needs author action:**

9. **The spreadsheet's `nodejs_microservice` summary block (cells
   J52/K52/L52) records P=0.875, R=0.5833, F1=0.70.** This contradicts the
   presence matrix (P=1.00, R=0.6154, F1=0.7619) and is the *only* record of
   a false positive anywhere. It is stale. It must be deleted or corrected
   before the replication package is published, because it would otherwise
   sit directly beneath the paper's "no false positives were observed" claim.
10. **Semgrep ISV column mixes units.** Paper says 5 / 0 / 1 / 5 / 0 across
    the five apps; the spreadsheet summary says 5 / 25 / 13 / 5 / 32. The
    paper took 5 and 5 from instance counts and 0/1/0 from category counts.
    Pick one unit, apply uniformly, restate "Semgrep detected only 5 ISV
    findings."
11. **E-commerce totals disagree:** spreadsheet 227/166 vs paper 218/148.
    Appears 4× in the text. Requires the in-house app to resolve.

---

## 7. Author decisions already made (do not relitigate)

- **Precision stays 1.00.** Legitimate: the presence matrix supports it
  everywhere MicroSec-Scan detected anything. Requires only deleting the
  stale block (§6.9). **Exception:** Online Boutique has 0 detections, so
  precision there is 0/0 = *undefined*, reported as `---`, not 1.00.
- **Sock Shop category 12 = present.** The disputed call was settled as
  present: publishing Prometheus/Grafana/Elasticsearch/Kibana to host ports
  in the monitoring/logging Compose files is an exposed-internal-port
  finding. Makes MicroSec-Scan's detection a TP → precision 1.00, present
  rises 12→13. The alternative reading (core compose exposes only
  `edge-router`) is recorded but not adopted.
- **Snyk entered as 0 findings with estimated times** (11/12/15 s),
  extrapolated from its measured 11–13 s range, with a dagger footnote
  stating neither is a measurement. The author requested this explicitly
  after being told the concern.

---

## 8. What is already applied to `paper/src/main.tex`

Section structure is now:

```
I    Introduction
II   Related Work
III  Framework Architecture
IV   System Implementation      <- 3 new UML figures at end of Phase 1
V    Experimental Design         <- NEW
VI   Results and Discussion      <- new polyglot subsection before SafeFix results
VII  Threats to Validity         <- NEW
VIII Conclusion and Future Work
Appendix A  SafeFix-K8s prompts (untouched)
Appendix B  MicroSec-Scan prompts (REPLACED)
```

Applied edits:
- All 8 mechanical errata from §6.
- **Appendix B replaced** with parameterised templates: fixed system message
  verbatim, two user-message templates with `{{PLACEHOLDER}}` markers, an
  11-row placeholder-binding table, decoding parameters, and two
  `{{FIX_GUIDANCE}}` instantiations.
- **Three UML figures** inserted (`fig:microsec_static`,
  `fig:microsec_dynamic`, `fig:microsec_deployment`).
- **Polyglot subsection** inserted (`sec:polyglot_eval`) with
  `tab:polyglot_results` and `tab:polyglot_baselines`.
- **Experimental Design** section: goal, RQ1–RQ4 with hypotheses, subject
  selection criteria, metrics (incl. category-vs-instance definition),
  annotation protocol, execution environment.
- **Threats to Validity** section: internal / external / construct /
  conclusion. Absorbs the old scattered limitations paragraph, which was
  deleted from its original location.
- `cas-refs.bib` gained `sockshop`, `onlineboutique`, `trainticket`,
  `microsecscan_repo`.

Verification done: environments balanced, 0 broken refs, no stale `0.772`,
brace balance identical to the original (+2 is pre-existing, from braces
inside `lstlisting`). **Never compiled.**

---

## 9. Remaining work

**Blocking on the author:**
1. Make the GitHub repo public (the letter cites it as the replication
   package). Optionally mint a Zenodo DOI for an immutable snapshot.
2. Delete/correct the stale spreadsheet block (§6.9).
3. Resolve the Semgrep unit mismatch (§6.10) and the e-commerce totals
   (§6.11).

**Blocking on a machine with the toolchain:**
4. Compile in Overleaf; fix any TikZ errors in the three new figures.
5. Re-run Semgrep with `semgrep ci` (registry was blocked here).
6. Re-run Snyk to replace the estimates.
7. Re-measure polyglot timings on the M4 if they are to sit beside the
   original five.

**Optional but high value:**
8. **Implement gRPC egress support and add `request`/`got`/`superagent` to
   the recognised client set**, plus a bounded interprocedural pass for
   helper wrappers. This would plausibly turn Sock Shop and Online Boutique
   into real detections, convert the polyglot section from "here is our
   limit" into "we extended coverage, here is the new result", and remove
   the awkwardness of Semgrep outscoring the tool. Both are registry-level
   extension points, so the change is contained.

---

## 10. Integrity constraints — carry these forward

- Do not restate that the benchmarks are "Java or Go" — it is false.
- Do not present the §4.3 annotation as author-produced.
- Do not report Online Boutique precision as 1.00; it is undefined.
- Do not mix category-level and instance-level ISV counts in one column.
- Snyk numbers and timings are assumptions, not measurements; the dagger
  footnote must survive any rewrite.
- The Semgrep-beats-us result on Online Boutique should stay in the paper.
  It is the single most credibility-building sentence in the revision.

---

## 11. File map

| Path | Contents |
|---|---|
| `paper/src/main.tex` | Fully revised manuscript (highlighted variant) |
| `paper/src/main_NO_HIGHLIGHTS.tex` | Same, macros collapsed to plain text |
| `paper/src/cas-refs.bib` | Bibliography incl. 4 new entries |
| `paper/revision/response-to-reviewers.md` | Full response letter |
| `paper/revision/polyglot-evaluation.tex` | Polyglot subsection (standalone) |
| `paper/revision/uml-microsec.tex` | 3 UML figures (standalone) |
| `paper/revision/appendix-microsec-prompt.tex` | Appendix B (standalone) |
| `paper/revision/polyglot-ground-truth.md` | Annotation + evidence + metrics |
| `paper/revision/errata.md` | Full errata analysis with derivations |
| `paper/revision/raw-results/*.json` | Raw scanner output for every number |
