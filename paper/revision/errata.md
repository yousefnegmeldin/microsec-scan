# Errata to fix before resubmission (MicroSec-Scan sections only)

These are defects in the current manuscript that reviewers are likely to
catch on the next pass. They are independent of the review comments.
SafeFix-K8s sections are deliberately not covered here.

## 1. Broken cross-references — produces `??` in the PDF

The text refers to `\ref{tab:results_rabbitmq}` and `\ref{tab:results_ecommerce}`
twice:

- "The comparison presented in ... Tables~\ref{tab:results_rabbitmq}–\ref{tab:results_ecommerce} summarize the detection results."
- "Semgrep detected a limited number of ISV, as shown in Tables~\ref{tab:results_rabbitmq}–\ref{tab:results_ecommerce}."

Neither label is defined anywhere. The per-application tables were
consolidated into `tab:results_by_tool` and `tab:results_consolidated`.
Four unresolved references currently render as `??`.

**Fix:** point both at `tab:results_by_tool`.

## 2. The reported average F1-score is wrong

The abstract ("an average F1-score being 0.772") and the introduction
("an average F1-score of 0.772") do not match Table `tab:microsec_accuracy`.

With precision = 1.00, F1 = 2R/(1+R). Recomputing from the recall values
in `tab:presence_matrix`:

| Application | Recall | F1 (recomputed) | F1 in table |
|---|---|---|---|
| nodejs-microservices-rabbitmq | 10/13 = 0.769 | 0.870 → **0.87** | 0.87 ✓ |
| nodejs_microservice | 8/13 = 0.615 | 0.762 → **0.76** | 0.76 ✓ |
| Microservices in Node.js | 7/10 = 0.700 | 0.824 → **0.82** | 0.83 ✗ |
| Message-Driven E-commerce | 4/12 = 0.333 | 0.500 → **0.50** | 0.50 ✓ |
| E-commerce (in-house) | 13/14 = 0.929 | 0.963 → **0.96** | 0.96 ✓ |

Two corrections:

- Microservices in Node.js F1 is **0.82**, not 0.83 (2 × 0.70 / 1.70 = 0.8235).
- The average F1 is **0.78**, not 0.772.

The stale 0.772 is exactly the mean you get using 0.70 for
nodejs_microservice, i.e. the pre-revision value that was changed to 0.76
when its recall was revised to 0.62. The abstract and introduction were
not updated with the table.

**Fix:** 0.83 → 0.82 in `tab:microsec_accuracy`; 0.772 → 0.78 in both the
abstract and the introduction.

## 3. Inter-service category count: 18 listed, 19 claimed

`tab:presence_matrix` says "Categories present (out of 19)" and its caption
says five categories absent from all repositories were omitted, i.e.
14 shown + 5 omitted = 19. But `tab:isv_categories` lists only 18:
5 (Authentication & Authorization) + 8 (Transport) + 3 (Messaging) +
2 (Resilience) = 18.

The cause is the first Transport bullet, which merges two separate rules
into one line:

> "Mutual TLS is not enforced between services; service mesh traffic is
> transmitted without encryption"

These are two distinct registry rules — `MISSING_MUTUAL_TLS` and
`UNENCRYPTED_SERVICE_MESH` — and they appear as two separate rows
("Missing mutual TLS", "Unencrypted service mesh") in `tab:presence_matrix`.

The 19 figure is the correct one; verified against `src/rules/registry.js`,
which defines exactly 19 inter-service rules (13 under "Inter-Service
Security Rules (Phase 2)", 3 egress, 3 broker/Kafka), matching the
`interServiceRules` array in `src/scanner.js:173-193`.

**Fix:** split that bullet into two so the Transport category lists 9 and
the table totals 19.

## 4. Two tables carry identical data

`tab:results_by_tool` (grouped by tool) and `tab:results_consolidated`
(grouped by application) contain the same 20 data rows, differing only in
row ordering. Both are referenced from the same paragraph.

**Fix:** delete `tab:results_consolidated` and keep the tool-grouped
version. This also answers Reviewer #1's length comment at zero cost to
content.

## 5. Appendix B system prompt is paraphrased, not verbatim

The appendix omits text present in `src/refactor/LLMClient.js:201-229`:

- Rule 3 drops the parenthetical "(e.g., keep RABBITMQ_URI as RABBITMQ_URI)".
- The closing line is given as "Output ONLY the fixed code block in markdown
  format." but the implementation continues "without explanations. Use
  ```javascript for JavaScript/TypeScript code."
- The prompt actually used for multi-finding files (`buildBatchPrompt`) is
  not shown at all, and it carries its own instruction list.

Since the point of the appendix is reproducibility, the text should match
the implementation exactly. `appendix-microsec-prompt.tex` in this
directory is a verbatim, parameterized replacement.

## 5b. Reconciliation against the ground-truth spreadsheet

Checked against the ground-truth sheet
(`19CfaqIhIrAjdJqYoauEfdCH54IoB7_lawJtUdbxY2-4`).

**Confirmed correct.** The presence matrix `tab:presence_matrix` reproduces
the sheet exactly: all 14 category rows, all five "present" counts
(14/13/13/12/10) and all five detected counts (13/10/8/4/7). The 19 rule
rows also confirm item 3 above: 19 is the right number, and Table
`tab:isv_categories` is the artifact that is wrong.

**Confirms item 2.** The sheet records F1 = 0.8325 for
Microservices-in-Nodejs. The correct value for P = 1.00, R = 0.70 is
0.8235 — the sheet has a digit transposition, which the paper inherited as
0.83. The sheet also records the old nodejs_microservice F1 of 0.70, which
is precisely the value that produces the stale 0.772 average.

**New — the sheet records a false positive.** The nodejs_microservice
summary block reads P = 0.875, R = 0.5833, F1 = 0.70, i.e. 7 correct of 8
detected against 12 present. The presence matrix for the same application
shows 8 detected of which all 8 are marked present, giving P = 1.00,
R = 8/13 = 0.62, F1 = 0.76 — the values the paper now reports. The summary
block is stale, but it is the only record of a false positive anywhere,
and the manuscript argues at length that precision is necessarily 1.00
("no false positives were observed"). If this sheet ships in the
replication package, that block must be corrected or removed first.

**New — Semgrep ISV numbers do not match the paper.**

| Application | Paper | Sheet |
|---|---|---|
| nodejs-microservices-rabbitmq | 5 | 5 ✓ |
| Message-Driven E-commerce | 5 | 5 ✓ |
| nodejs_microservice | 0 | 25 |
| Microservices-in-Nodejs | 1 | 13 |
| E-commerce (in-house) | 0 | 32 |

The paper's Semgrep ISV column mixes two metrics: 5 and 5 come from the
sheet's summary blocks (instance counts), while 0, 1 and 0 come from the
sheet's Semgrep columns in the presence matrix (category level, almost all
zero). The claim "In comparison, Semgrep detected only 5 ISV findings"
about the in-house system is not supported by either reading. Choose one
metric, apply it uniformly to all five applications, and restate the
surrounding prose.

**New — e-commerce totals disagree.** The sheet gives MicroSec-Scan
V = 227, ISV = 166 for the in-house e-commerce system; the paper reports
218 and 148. These figures appear four times in the text.

**Gaps in the sheet.** Timing is recorded only for
nodejs-microservices-rabbitmq (0.38 / 0.09 / 12 / 120); the per-application
times the paper reports for the other four applications are not in the
sheet and need their source added to the replication package. The sheet's
average-runtime block says 0.415 s for MicroSec-Scan, while the paper's
five per-application values average 0.406 s. Semgrep's minimum recorded
memory is 1394 MB, not the 1390 MB stated as the lower bound.

## 6. Section roadmap in the introduction is stale

The introduction states: "Section III presents the system model and
implementation, which defines the system and threat model and clarifies the
assumptions used throughout the work", and describes five sections.

The manuscript actually has six numbered sections (I Introduction,
II Related Work, III Framework Architecture, IV System Implementation,
V Results and Discussion, VI Conclusion), architecture and implementation
having been split, and there is no threat model or assumptions subsection
anywhere.

**Fix:** rewrite the roadmap paragraph. Note that Reviewer #4's
restructuring request (a dedicated experimental-design section and a
threats-to-validity section) will change the section list again, so do
this edit last.

## 7. Figure 1 differs from its own copy in the graphical abstract

The graphical abstract and `fig:framework_architecture` are the same TikZ
picture duplicated verbatim, except that the MicroSec-Scan "Analysis" box
reads "Rule Checking Layer" in the graphical abstract and "Rule Checking
Layer | LLM Refactor Layer" in Figure 1. The latter is also internally
inconsistent, since the refactor layer is drawn as its own separate box
directly beneath.

**Fix:** move the shared picture into one file, `\input` it in both places,
and drop "| LLM Refactor Layer" from the Analysis box.

## 8. Minor preamble and consistency items

- `\usepackage{tikz}` appears three times; `\usetikzlibrary` twice with
  overlapping library lists.
- `\renewcommand{\thetable}{\Roman{table}}` appears twice.
- `\fix{}` (orange) is still live in the SafeFix provider paragraph; if
  colour markup is meant to be dropped for camera-ready, add a single
  toggle: `\newcommand{\new}[1]{#1}\newcommand{\fix}[1]{#1}`.
- Appendix ordering is inverted relative to the narrative: Appendix A is
  SafeFix-K8s (Phase 2), Appendix B is MicroSec-Scan (Phase 1).
