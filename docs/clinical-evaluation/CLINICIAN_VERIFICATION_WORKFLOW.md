# Clinician Verification Workflow

**Status:** Adopted 2026-09-30 · **Owner:** CalmGuide team · **Applies to:** every
scenario used to evaluate the Moment Coach

This document defines how CalmGuide asks clinicians to verify dementia-care
guidance. It replaces the clinician intake form, which asked clinicians to
author behaviours, actions and contributing factors. LOF rejected that approach
on 2026-09-25 because it makes the clinician a content-library author.

The principle is simple:

> **The team drafts. The source decides. The clinician verifies.**

The team writes scenarios and proposed caregiver responses **only from
Alzheimer's Association guidance**, never from its own judgment. A clinician
is asked a narrow question: *is this safe, accurate and complete for a family
caregiver?*

---

## 1. What the clinician is and is not asked to do

| The clinician **is** asked to | The clinician **is not** asked to |
| --- | --- |
| Verify that a drafted scenario is realistic | Write scenarios, behaviours or responses |
| Approve, revise or reject each proposed caregiver response | Train an AI model |
| Flag anything unsafe, inaccurate or missing | Supply content that goes into the product |
| Say which concern takes precedence when behaviours overlap | Review the whole knowledge base |

**How to describe it to a clinician (use this wording):**

> We're not asking you to train an AI model. We're asking you to review a
> small, controlled set of dementia-care guidance that the system may
> retrieve and act on, so we can test whether it behaves safely. Each batch is
> about 10 short scenarios and takes 10–20 minutes.

### Integrity condition

If we tell a clinician their input will not enter the system, it must not
enter the system. Concretely:

- A clinician's **own words** (comments, suggested rewrites) are never added to
  the RAG corpus, the coach prompt, or the few-shot examples. They are stored
  only in the review record and used as **test oracles**, meaning the expected
  answers a reply is checked against.
- A **resource link** a clinician recommends (for example a published guideline)
  may become a RAG source. It then goes through the normal source allowlist
  review in `rag/scraper/crawl.py`, and the clinician is told that it will.
- If we ever want to use a clinician's own words in the product, we ask
  separately, in writing, per item.

---

## 2. Roles

| Role | Who | Responsibility |
| --- | --- | --- |
| **Scenario author** | Team member | Drafts scenarios and proposed responses from cited Alzheimer's Association pages only |
| **Source checker** | A *different* team member | Confirms every proposed response point traces to the cited page; strikes anything that doesn't |
| **Clinician reviewer** | Geriatrician, behavioural neurologist, geriatric psychiatrist, or dementia-focused RN/NP | Verifies each scenario (§4) |
| **Coordinator** | Team lead | Sends batches, records verdicts, runs the post-review steps (§5), reports to LOF |

Reviewer coverage grows in stages:

1. **Now:** one clinician per batch.
2. **When a second reviewer is available:** they independently review 1 in 5
   scenarios (at least 2 per batch). Agreement is reported (§6).
3. **Target:** a standing advisory group of 3 to 5 people across the
   disciplines above. Any scenario rejected for safety is always seen by a
   second reviewer.

---

## 3. Batch lifecycle

```
 draft ──► source-checked ──► sent ──► reviewed ──┬─► approved ─────────► locked (test oracle)
   ▲                                              ├─► approve-with-edits ─► edited ─► locked
   │                                              └─► rejected ──┐
   └──────────────────── revise from source (max 2 rounds) ◄─────┘──► retired
```

| Step | Entry criteria | Output |
| --- | --- | --- |
| **Draft** | Scenario cites ≥1 Alzheimer's Association page | Entry in `batches/batch_NN.json` |
| **Source-checked** | Second team member traced every response point to its source | `source_checked_by` filled |
| **Sent** | 8–12 source-checked scenarios; packet rendered | `batch_NN_packet.md` sent to the reviewer |
| **Reviewed** | Reviewer returned a verdict for every scenario | `reviews/batch_NN_review.json` |
| **Locked** | Approved (or edits applied) | Scenario gets a version and becomes a test oracle for the Moment Coach validation run |

**Batch size:** about 10 scenarios. Each scenario must be readable in about a minute: a
2–3 sentence situation, 3–6 proposed response points, 1–3 things never to say.

**Cadence:** one batch per clinician per week at most. Don't send a new batch
until the last batch's review record has been processed.

---

## 4. What the clinician decides

For each scenario the clinician gives one verdict and, where needed, a reason
code.

### 4.1 Verdicts

| Verdict | Meaning | Use when |
| --- | --- | --- |
| **Approve** | Safe, accurate and complete enough for a family caregiver | No change needed |
| **Approve with edits** | Safe and substantially right; specific points need changing | Wording, emphasis, order, or one missing point |
| **Reject** | Should not be used as it stands | Any reason code below applies |

### 4.2 Reason codes (required for *Approve with edits* and *Reject*)

| Code | Reason | Severity |
| --- | --- | --- |
| **R1** | Unsafe: following this could cause harm | Critical |
| **R2** | Clinically inaccurate | Critical |
| **R3** | Missing a critical action or escalation | Critical |
| **R4** | Source misread or over-generalised | Major |
| **R5** | Scenario unrealistic or wrong for the stated stage | Major |
| **R6** | Wording would upset or confuse a caregiver or the person with dementia | Minor |
| **R7** | Out of scope for a caregiver-facing tool (belongs to a clinician) | Major |

A critical code (R1–R3) always means **Reject**, even if the fix looks small.

### 4.3 The four questions on every scenario

1. Is this situation realistic for the stated stage?
2. Is each proposed response point safe and accurate? (Tick or cross each.)
3. Is anything missing that a caregiver **must** do or watch for?
4. Is anything listed that a caregiver should **never** be told?

Some scenarios carry an extra **clinician question**. These are points where
the source and CalmGuide's own rules pull in different directions, or where
LOF has asked for a judgement (for example precedence when several behaviours
occur at once). The answer is recorded as an adjudication (§5.3).

---

## 5. What happens after a verdict

### 5.1 Approved

1. The scenario is locked: `status: "locked"` and `version` incremented.
2. Its **must include** and **must not say** lists become test oracles in the
   Moment Coach validation run (`backend/tests/evaluation/run_coach_validation.py`,
   scored by the framework in
   [`EVALUATION_FRAMEWORK.md`](EVALUATION_FRAMEWORK.md)).
3. Nothing enters the RAG corpus or the prompt as a result.

### 5.2 Approved with edits

1. The author applies the edits **as written by the clinician** to the review
   record. Where an edit changes the substance of the guidance (not just wording), the author must be
   able to point to a source for it: the cited page, or a resource the clinician
   named. Otherwise the edit is kept only as a test note.
2. The source checker confirms the edit.
3. The scenario is locked. It is not re-sent unless the edit was substantive
   **and** unsourced, in which case it goes back as a *revise* item in the next
   batch.

### 5.3 Rejected

1. **Contain first.** Within one working day the coordinator checks whether the
   rejected guidance also appears in the coach prompt
   (`backend/app/prompts/coach_system.jinja2`, `domain_knowledge.jinja2`), the
   few-shot examples, or a RAG chunk the coach can retrieve.
   - If it does **and** the code is R1, R2 or R3: open an issue labelled
     `clinical-safety`, remove or correct it in the product, and add a
     regression case, all before the next deploy.
   - If it does and the code is R4–R7: open an issue; fix within the sprint.
2. **Revise only from source.** The author re-drafts from the cited page (or a
   better Alzheimer's Association page). The team does not substitute its own
   judgment for the rejected point.
3. **Source disagreement.** If the clinician disagrees with the Alzheimer's
   Association guidance itself, we do not "fix" the source. Record it as an
   adjudication with the clinician's reasoning, send it to a second reviewer,
   and until the disagreement is resolved, exclude the point from both the test oracle and the product.
4. **Round limit.** A scenario gets at most two revision rounds. If it's still
   rejected after that, it is retired and the reason logged.

### 5.4 Adjudications

Clinician questions (§4.3) and source disagreements are recorded in the review
file under `adjudications`, with the clinician's answer, the date and a
decision (`adopt`, `keep current`, `needs second opinion`). An adopted
adjudication that changes coach behaviour is implemented like any other
product change, with a regression case.

---

## 6. Records and reporting

**Where things live**

| File | Contents |
| --- | --- |
| `docs/clinical-evaluation/batches/batch_NN.json` | Machine-readable scenarios (source of truth) |
| `docs/clinical-evaluation/batches/batch_NN_packet.md` | Clinician-facing packet rendered from the JSON |
| `docs/clinical-evaluation/reviews/batch_NN_review.json` | Verdicts, reason codes, edits, adjudications |

**Review record shape**

```json
{
  "batch": "batch_01",
  "reviewer": { "id": "CLN-01", "discipline": "geriatric psychiatry" },
  "sent": "2026-10-01",
  "returned": "2026-10-03",
  "minutes_spent": 18,
  "items": [
    {
      "scenario_id": "B01-03",
      "verdict": "approve_with_edits",
      "reason_codes": ["R6"],
      "point_checks": { "1": true, "2": true, "3": false },
      "missing": "…",
      "never_say": "…",
      "edits": "…"
    }
  ],
  "adjudications": [
    { "question_id": "B01-02-Q1", "answer": "…", "decision": "needs second opinion" }
  ]
}
```

Reviewers are identified by an opaque ID in the repository. Names and contact
details are kept out of git.

**Reported to LOF each week**

- Scenarios drafted / sent / approved / edited / rejected / retired
- Rejections by reason code, and any R1–R3 containment actions taken
- Median review time per batch (target ≤ 20 minutes)
- Inter-reviewer agreement once a second reviewer exists (percent agreement on
  verdict; Cohen's κ once there are ≥ 30 double-reviewed scenarios)

---

## 7. Batch 01

Batch 01 is drafted and is ready for source-checking:
[`batches/batch_01_packet.md`](batches/batch_01_packet.md). It covers
repetition, sundowning, exit-seeking, a missing person, aggression during care,
hallucinations, accusations of theft, bathing refusal, a new incontinence
episode, and one **multiple-behaviour** scenario that asks the clinician which
concern takes precedence, which is LOF's open architectural question.

It also raises two places where Alzheimer's Association guidance and
CalmGuide's current prompt rules differ, for the clinician to adjudicate:

- The sundowning page advises gently reminding an upset person of the time.
  CalmGuide's prompt forbids correcting the person's reality.
- The hallucinations page advises answering honestly ("I know you see
  something, but I don't see it"). CalmGuide's prompt tells the caregiver not
  to deny what the person perceives, and is silent on whether to say they
  can't see it.
