# Response to Reviewers

Covers the MicroSec-Scan comments. SafeFix-K8s responses already drafted by
the authors are unchanged.

---

## Reviewer #1

### Comment 1 — Replication package only promised after acceptance

We agree, and this is now resolved rather than deferred. The complete
replication package is public and citable at the time of review:

- The MicroSec-Scan implementation, including the full rule registry and
  the LLM refactor layer.
- The ground-truth annotation for all evaluation subjects, at the
  inter-service category level.
- The raw JSON output of every scanner run reported in the paper, for
  MicroSec-Scan and for each baseline.
- Exact commands and pinned tool versions for reproducing every table.

The package is cited in the paper as \cite{microsecscan_repo}:

    https://github.com/yousefnegmeldin/microservices-security-scanner

*(Optional hardening: linking the repository to Zenodo and tagging a release
mints a permanent DOI, which gives reviewers an immutable snapshot rather
than a branch that can move during review. The GitHub URL alone satisfies
the comment; the DOI is a strict improvement if time permits.)*

### Comment 2 — Prompt templates are not really templates

Addressed for both tools. Appendix B has been rewritten so that the
MicroSec-Scan prompts are presented as genuine parameterised templates
rather than one rendered instance, matching what was already done for
SafeFix-K8s in Appendix A.

The appendix now gives: the fixed system message, verbatim; two user
message templates (one instantiated per finding, one per file for the batch
path), with every variable shown as an explicit `{{PLACEHOLDER}}`; a table
binding each placeholder to the exact field it is populated from
(`finding.rule`, `finding.severity`, `context.filePath`,
`context.startLine`, `getFixGuidance(rule)`, and so on); and the decoding
parameters held constant across providers (temperature 0.1, 8000-token cap,
120-second timeout).

Because every placeholder is bound to a field of the emitted findings file,
any model call reported in the paper can be reconstructed from the scan
output and the analysed source file alone.

### Comment 3 — The Node.js-only limitation, and the reference benchmarks

We accept this criticism, and we withdraw the argument made in our previous
response. Our earlier statement that Sock Shop, TrainTicket and Online
Boutique "are implemented in Java or Go and cannot be analyzed by
MicroSec-Scan" was incorrect. The reviewer is right that these are polyglot
systems containing Node.js services as first-class implementations. We
verified this directly: Sock Shop's `front-end` is an Express service,
Online Boutique's `currencyservice` and `paymentservice` are Node.js, and
TrainTicket's `ts-ticket-office-service` is an Express service.

Rather than restate a scope argument, we ran the tool on all three
benchmarks and added the results to the paper as a new evaluation
subsection. Two clarifications frame that evaluation.

First, MicroSec-Scan's inter-service rules are *caller-side*: each rule
binds its variables from the abstract syntax tree of the service that
originates a call, so the implementation language of the callee is
irrelevant. The tool therefore applies to the Node.js services *within* any
polyglot system; it does not require that every service be Node.js. This
corrects the framing of our earlier response.

Second, the results are reported in full, including where they are
unfavourable. MicroSec-Scan runs on all three benchmarks and reports
actionable findings on two of them, but its inter-service recall on these
subjects is low (0.08, 0.00 and 0.07). We traced this to four causes, three
of which are implementation limitations rather than properties of
design-time analysis:

1. **Unsupported transport.** Online Boutique communicates exclusively over
   gRPC, which the current egress analyser does not model, so no framework
   adapter matches and no findings are produced.
2. **Unsupported HTTP client.** The analyser recognises `axios`, `fetch`
   and the Node.js `http`/`https` request APIs. Sock Shop's front-end
   issues its inter-service calls through the `request` library, so those
   calls are not modelled as egress edges.
3. **Interprocedural indirection.** Sock Shop's route handlers call a
   project-local helper, `helpers.simpleHttpRequest(url, res, next)`, which
   wraps the client in another module. Binding the destination URL at the
   call site requires cross-module data-flow analysis rather than the
   intraprocedural AST matching the current rules perform.
4. **Correct absence.** TrainTicket's Node.js service is a leaf service
   communicating only with MySQL and MongoDB. Its zero inter-service
   findings is a true negative.

We also report a result that runs against our own earlier claims: on Online
Boutique, Semgrep detects an inter-service vulnerability that MicroSec-Scan
does not, matching `grpc.credentials.createInsecure()` through its gRPC
rule. We state this explicitly in the paper. Our architectural argument is
unaffected — the Semgrep rule is a single-file pattern match that
reconstructs no cross-service path — but the claim that the baselines
report no inter-service findings does not survive, and we have corrected
it.

The limitation is now stated prominently rather than minimised: it appears
in the abstract's scope statement, in the new Threats to Validity section
under external validity, and as the first item of future work. We have also
made the extension path concrete, since the recognised-client set and the
transport handlers are registry-level extension points behind a common
adapter interface, shown explicitly in the new component diagram.

### Comment 4 — Blank pages and unreadable CLI screenshots

Addressed. The near-blank pages have been eliminated by re-flowing floats,
and every black-background CLI screenshot has been replaced with typeset
listings that remain legible in print and in greyscale.

### Comment 5 — Manuscript length

Addressed on both halves of the paper. For SafeFix-K8s, implementation
paragraphs were condensed and replaced by diagrams. For MicroSec-Scan, we
have removed a duplicated results table that presented the same twenty data
rows twice, and replaced implementation prose with the new UML views
described under Reviewer #4's second comment, so the diagrams substitute for
text rather than adding to it.

---

## Reviewer #4

### Comment 1 — The polyglot argument is unconvincing

We accept both points and have withdrawn the earlier argument. Please see
our response to Reviewer #1's third comment, which describes the new
evaluation on Sock Shop, Online Boutique and TrainTicket, the caller-side
property that makes the tool applicable to Node.js services inside polyglot
systems, and the four causes of the low inter-service recall we measured
there.

On the second point specifically: we agree that a system in which every
service is written in Node.js is not a representative microservice
deployment, and we no longer claim otherwise. The paper now positions
MicroSec-Scan as applying to the Node.js subset of a polyglot deployment,
with the boundary of that applicability measured and stated rather than
asserted.

### Comment 2 — Use UML diagrams to describe the architecture and reduce text

Addressed for both tools. In addition to the two SafeFix-K8s diagrams, the
MicroSec-Scan implementation section now carries the three views requested:

- **Static (component) view.** Modules and their dependencies, with the
  concrete framework adapters shown realising a common `BaseFramework`
  interface and an explicit extension point for further language and
  framework adapters.
- **Dynamic (sequence) view.** A scan followed by an optional refactor,
  showing that no suggested fix reaches disk without returning to the
  developer for review.
- **Deployment view.** The analyser running on a developer workstation or
  CI runner with no cluster or agent, and the optional refactor stage as
  the only component that contacts an external inference provider.

In each case the surrounding prose was deleted rather than kept alongside
the figure, which also serves Reviewer #1's comment on length.

### Comment 3 — Restructure scattered information into the expected sections

Addressed following Wohlin et al. Two sections have been added and the
scattered material moved into them.

**Experimental Design**, placed before the results, now carries the goal
definition, explicitly stated research questions and hypotheses, the
subject selection criteria for both the Node.js applications and the
Kubernetes manifests (previously embedded in the implementation section),
the metric definitions including the distinction between category-level and
instance-level counting, the execution environment, and the annotation
protocol with how disagreements were resolved.

**Threats to Validity**, placed after the results, now covers internal
validity (the annotators are the tool authors, and the protocol used to
constrain that), external validity (language coverage, the number of
subjects, and the polyglot results above), construct validity (what the
reported metrics do and do not measure, and the ground-truth provenance),
and conclusion validity (sample size, absence of statistical testing, and
the non-determinism of the LLM-assisted stage).

---

## Corrections made on our own initiative

While preparing this revision we audited the reported figures against our
ground-truth data and corrected the following:

- The average F1-score reported in the abstract and introduction was stale
  at 0.772; it is 0.78. One per-application F1 was also mis-transcribed as
  0.83 where the correct value is 0.82.
- The inter-service category table listed 18 categories where the rule
  registry and the evaluation both use 19; one table entry merged two
  distinct rules and has been split.
- Four cross-references pointed at table labels that no longer exist and
  rendered as unresolved references.
- A duplicated results table has been removed.
