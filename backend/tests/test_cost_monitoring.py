"""Cost monitoring tests — verify prompt sizes stay within token budgets."""

from app.services.prompt import render_coach_prompt
from tests.evaluation.labeled_conversations import LABELED_CONVERSATIONS
from tests.evaluation.run_extraction_eval import (
    compute_field_accuracy,
    run_evaluation_report,
    F1_TARGETS,
)


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English text."""
    return len(text) // 4


def test_coach_prompt_token_budget_minimal():
    """Coach prompt without dossier stays under 5000 tokens."""
    prompt = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=["sundowning", "wandering", "aggression"],
        calming_strategies=["Sinatra music", "warm milk", "photo album"],
        safety_concerns=["fall risk", "elopement"],
    )
    tokens = _estimate_tokens(prompt)
    assert tokens < 5000, f"Minimal prompt is {tokens} tokens, expected < 5000"


def test_coach_prompt_token_budget_full():
    """Coach prompt with full dossier + incidents stays under 10000 tokens."""
    prompt = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=["sundowning", "wandering", "aggression", "refusing care"],
        calming_strategies=["Sinatra music", "warm milk", "photo album", "gentle touch"],
        safety_concerns=["fall risk", "elopement", "aggression towards caregiver"],
        rag_context="Relevant guidance chunk 1.\n\n---\n\nRelevant guidance chunk 2.",
        dossier_text=(
            "Patient shows escalating nighttime wandering pattern over last 2 weeks. "
            "Sinatra music resolves wandering in 3/4 recent episodes. Physical redirection "
            "escalated to hitting on April 2 and April 15. Pain screening recommended due "
            "to 3 aggression episodes in last 7 days with no clear antecedent."
        ),
        contraindicated=[
            {
                "description": "Physical redirection during wandering",
                "behavior": "aggression_anger",
                "incident_date": "2026-04-15",
            },
            {
                "description": "Logical reasoning about time of day",
                "behavior": "confusion_disorientation",
                "incident_date": "2026-04-10",
            },
        ],
        relevant_incidents=[
            {
                "date": "2026-04-22T02:15:00",
                "behavior_category": "wandering_exit_seeking",
                "severity": "moderate",
                "antecedent": "Woke up confused at 2am, no bowel movement",
                "behavior": "Exit-seeking, tried front door then back door",
                "intervention": "Sinatra on kitchen speaker at low volume, sat nearby",
                "outcome": "resolved",
            },
            {
                "date": "2026-04-20T19:30:00",
                "behavior_category": "aggression_anger",
                "severity": "severe",
                "antecedent": "Caregiver tried to guide patient to bathroom",
                "behavior": "Pushed caregiver, verbal threats",
                "intervention": "Backed away, waited 15 minutes, tried again with warm towels",
                "outcome": "partially_resolved",
            },
            {
                "date": "2026-04-18T03:00:00",
                "behavior_category": "wandering_exit_seeking",
                "severity": "mild",
                "antecedent": None,
                "behavior": "Found patient at front door, confused",
                "intervention": "Warm milk, led back to bed",
                "outcome": "resolved",
            },
        ],
        cross_patient_strategies=[
            {"tag": "familiar_music", "helped": 12, "total": 15},
            {"tag": "warm_drink", "helped": 8, "total": 12},
        ],
    )
    tokens = _estimate_tokens(prompt)
    assert tokens < 10000, f"Full prompt is {tokens} tokens, expected < 10000"


def test_labeled_conversations_minimum_count():
    """Labeled test set has at least 10 seed conversations."""
    assert len(LABELED_CONVERSATIONS) >= 10


def test_labeled_conversations_have_required_fields():
    """Each labeled conversation has required structure."""
    for conv in LABELED_CONVERSATIONS:
        assert "id" in conv
        assert "messages" in conv
        assert "expected" in conv
        assert "behavior_category" in conv["expected"]
        assert len(conv["messages"]) >= 2


def test_evaluation_report_structure():
    """Evaluation runner produces correct report structure."""
    predictions = [
        {"behavior_category": "wandering_exit_seeking", "severity": "moderate"},
        {"behavior_category": "aggression_anger", "severity": "severe"},
    ]
    labels = [
        {"behavior_category": "wandering_exit_seeking", "severity": "moderate"},
        {"behavior_category": "aggression_anger", "severity": "moderate"},
    ]
    report = run_evaluation_report(predictions, labels)
    assert "behavior_category" in report
    assert "severity" in report
    assert report["behavior_category"]["accuracy"] == 1.0
    assert report["severity"]["accuracy"] == 0.5


def test_evaluation_accuracy_computation():
    """Accuracy computation handles missing predictions correctly."""
    predictions = [
        {"behavior_category": "wandering_exit_seeking"},
        {"behavior_category": None},
        {"behavior_category": "aggression_anger"},
    ]
    labels = [
        {"behavior_category": "wandering_exit_seeking"},
        {"behavior_category": "aggression_anger"},
        {"behavior_category": "aggression_anger"},
    ]
    result = compute_field_accuracy(predictions, labels, "behavior_category")
    assert result["correct"] == 2
    assert result["total"] == 3
    assert result["missing"] == 1
