"""Tests for the lightweight (non-ML) heuristic second-layer safety classifier."""

import pytest

from app.services.safety_classifier import SafetyRiskCategory, classify_message


class TestLifeThreatParaphrases:
    @pytest.mark.parametrize(
        "message",
        [
            "he wont wake up",
            "he just stopped breathing a minute ago",
            "i think mom might be having a hart attak",
            "she is turning kind of blue around the lips",
        ],
    )
    def test_flags_life_threat_paraphrase(self, message: str):
        result = classify_message(message)
        assert result.flagged
        assert result.category == SafetyRiskCategory.LIFE_THREAT


class TestCaregiverAndAbuseParaphrases:
    def test_flags_caregiver_harm_risk_paraphrase(self):
        result = classify_message("im scared that i might hurt him if he keeps yelling")
        assert result.flagged
        assert result.category == SafetyRiskCategory.CAREGIVER_HARM_RISK

    def test_flags_elder_abuse_paraphrase(self):
        result = classify_message("my sister leaves her alone for days at a time")
        assert result.flagged
        assert result.category == SafetyRiskCategory.ELDER_ABUSE_NEGLECT


class TestNoFalsePositives:
    @pytest.mark.parametrize(
        "message",
        [
            "mom keeps asking where dad is, he passed away 3 years ago",
            "he wont eat his dinner tonight",
            "im so tired today",
            "she had a great day at the park",
            "",
        ],
    )
    def test_does_not_flag_ordinary_messages(self, message: str):
        result = classify_message(message)
        assert not result.flagged
        assert result.category is None


class TestResultShape:
    def test_flagged_result_includes_confidence_and_matches(self):
        result = classify_message("he wont wake up")
        assert result.flagged
        assert 0.0 < result.confidence <= 1.0
        assert result.matched_concepts
