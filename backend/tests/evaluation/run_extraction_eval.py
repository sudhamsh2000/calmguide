"""Run extraction against labeled test set and compute per-field F1 scores.

Usage:
    python -m tests.evaluation.run_extraction_eval [--live]

Without --live, uses mocked LLM responses (for CI).
With --live, calls the actual LLM provider (requires API key).

F1 targets (from spec Section 4.7):
  - behavior_category: >= 0.80
  - antecedent: >= 0.65
  - intervention: >= 0.70
  - outcome: >= 0.75
"""

import asyncio
import json
import sys
from collections import defaultdict

from tests.evaluation.labeled_conversations import LABELED_CONVERSATIONS

F1_TARGETS = {
    "behavior_category": 0.80,
    "antecedent_category": 0.65,
    "intervention_outcome": 0.75,
    "severity": 0.70,
}


def compute_field_accuracy(predictions: list[dict], labels: list[dict], field: str) -> dict:
    correct = 0
    total = 0
    missing = 0

    for pred, label in zip(predictions, labels, strict=True):
        expected = label.get(field)
        if expected is None:
            continue
        total += 1
        predicted = pred.get(field)
        if predicted is None:
            missing += 1
            continue
        if predicted == expected:
            correct += 1

    accuracy = correct / total if total > 0 else 0.0
    return {
        "field": field,
        "correct": correct,
        "total": total,
        "missing": missing,
        "accuracy": accuracy,
    }


def run_evaluation_report(predictions: list[dict], labels: list[dict]) -> dict:
    results = {}
    for field in F1_TARGETS:
        metrics = compute_field_accuracy(predictions, labels, field)
        metrics["target"] = F1_TARGETS[field]
        metrics["passes"] = metrics["accuracy"] >= F1_TARGETS[field]
        results[field] = metrics
    return results


def print_report(results: dict) -> None:
    print("\n" + "=" * 60)
    print("EXTRACTION EVALUATION REPORT")
    print("=" * 60)
    for field, metrics in results.items():
        status = "PASS" if metrics["passes"] else "FAIL"
        print(
            f"  {field:25s}  accuracy={metrics['accuracy']:.2f}  "
            f"target={metrics['target']:.2f}  "
            f"({metrics['correct']}/{metrics['total']})  [{status}]"
        )
    print("=" * 60)

    all_pass = all(m["passes"] for m in results.values())
    print(f"\nOverall: {'ALL TARGETS MET' if all_pass else 'SOME TARGETS MISSED'}")


if __name__ == "__main__":
    print(f"Labeled conversations available: {len(LABELED_CONVERSATIONS)}")
    print("Run with --live to evaluate against actual LLM extraction.")
    print(
        "This script provides the framework; populate labeled_conversations.py with 50+ examples."
    )
