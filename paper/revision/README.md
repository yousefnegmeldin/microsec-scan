# MicroSec-Scan revision material

Material prepared for the revision of *MicroSec-Scan and SafeFix-K8s for
Automated Analysis and Repair in Microservices and Kubernetes*
(Computers & Security). MicroSec-Scan only; nothing here concerns
SafeFix-K8s.

## Contents

| File | Addresses |
|---|---|
| `appendix-microsec-prompt.tex` | R1 comment 2 — prompt templates lack placeholders/parameters. Verbatim replacement for Appendix B with parameterized templates and a placeholder-binding table. |
| `polyglot-evaluation.tex` | R4 comment 1 and R1 comment 3 — the Node.js-only scope objection. New results subsection reporting MicroSec-Scan run against the Node.js services of Sock Shop, Online Boutique, and Train Ticket. |
| `uml-microsec.tex` | R4 — static, dynamic, and deployment UML views for MicroSec-Scan. Intended to replace implementation prose, not supplement it. |
| `errata.md` | Numeric and cross-reference defects in the current draft, independent of the review comments. |
| `raw-results/` | Raw JSON scan output backing every number in `polyglot-evaluation.tex`. |

## Reproducing the polyglot benchmark numbers

```sh
npm install

git clone --depth 1 https://github.com/microservices-demo/front-end.git sockshop-front-end
git clone --depth 1 https://github.com/GoogleCloudPlatform/microservices-demo.git online-boutique
git clone --depth 1 https://github.com/FudanSELab/train-ticket.git train-ticket

node bin/microsec-scan.js scan -p ./sockshop-front-end                        -f json -o sockshop.json
node bin/microsec-scan.js scan -p ./online-boutique/src/currencyservice       -f json -o ob-currency.json
node bin/microsec-scan.js scan -p ./online-boutique/src/paymentservice        -f json -o ob-payment.json
node bin/microsec-scan.js scan -p ./train-ticket/ts-ticket-office-service     -f json -o tt-ticketoffice.json
```

Inter-service findings are those whose `rule` appears in the
`interServiceRules` array in `src/scanner.js:173-193` (19 rules, matching
`src/rules/registry.js`).

## Results summary

| Benchmark | Node.js service | Transport | Files | V | ISV |
|---|---|---|---|---|---|
| Sock Shop | `front-end` | HTTP via `request` | 33 | 51 | 1 |
| Online Boutique | `currencyservice` | gRPC | 2 | 0 | 0 |
| Online Boutique | `paymentservice` | gRPC | 4 | 0 | 0 |
| Train Ticket | `ts-ticket-office-service` | none (DB only) | 3 | 6 | 0 |

Clones were taken at head; re-running against a later head may shift counts.

## Why the inter-service yield is low

Four distinct causes, established by inspecting each benchmark:

1. **gRPC unsupported.** Both Online Boutique services are gRPC-only and
   register no Express/Fastify/NestJS app, so no framework adapter matches
   and the egress analyzer is never reached — zero findings.
2. **Unsupported HTTP client.** `ASTEgressAnalyzer` recognizes `axios`,
   `fetch`, and `http`/`https` `.request`. Sock Shop's front-end uses the
   `request` library, so its calls to the catalogue/cart/order/user services
   are not modelled as egress edges.
3. **Interprocedural indirection.** Sock Shop route handlers do not call the
   client directly; they call `helpers.simpleHttpRequest(url, res, next)`
   (`helpers/index.js:93-98`), which wraps `request.get` in another module.
   The URL arrives through a parameter, so binding it requires cross-module
   data-flow analysis, not intraprocedural AST matching.
4. **Correct absence.** `ts-ticket-office-service` is a leaf service talking
   only to MySQL/Mongo, with no outbound service calls. Its zero
   inter-service findings is a true negative.

Causes 1–3 are limitations of the current implementation; both the
recognized-client set and the transport handlers are registry-level
extension points.
