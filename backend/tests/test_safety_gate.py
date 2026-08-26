"""Tests for deterministic safety gate — life-threat and self-harm detection."""

import pytest

from app.services.safety_gate import SafetyGateType, check_safety_gate


class TestLifeThreatGate:
    """Life-threat patterns → 911 deflection."""

    @pytest.mark.parametrize(
        "message",
        [
            "Mom is not breathing",
            "She can't breathe and her face is turning blue",
            "He stopped breathing what do I do",
            "Dad is choking on food right now",
            "She's having a seizure on the floor",
            "Mom is having a seizure right now",
            "He had a seizure and fell",
            "He is convulsing",
            "Mom is unconscious and I can't wake her",
            "She's unresponsive",
            "He won't wake up",
            "Dad collapsed on the floor",
            "She passed out and hit her head",
            "I think he's having a heart attack",
            "She has chest pain and can't breathe",
            "I think mom is having a stroke, one side of her face is drooping",
            "His speech is suddenly slurred",
            "There's blood everywhere she won't stop bleeding",
            "She's severely bleeding from her arm",
            "Mom fell down the stairs",
            "He fell and can't get up or move his leg",
            "The kitchen is on fire and dad is still in there",
            "She burned herself badly on the stove",
            "Dad is in the pool and I think he's drowning",
            "She swallowed pills, the whole bottle",
            "He drank bleach",
            "Mom swallowed cleaning chemicals",
            "I think she's had an overdose",
            "He got electric shock from the outlet",
            "She's having an allergic reaction and can't breathe",
            "No pulse, what do I do",
            "He hit his head hard on the floor and isn't moving",
            "She can't breathe after eating something",
            "Dad stopped breathing in the middle of the night",
            "Mom choked on her medication",
            "He's having convulsions and shaking all over",
            "She's seizing and I don't know what to do",
            "Dad is unconscious on the bathroom floor",
            "Mom won't wake up no matter what I do",
            "He fainted and his lips are blue",
            "She passed out at the dinner table",
            "Dad collapsed and he's not responding",
            "He collapsed to the floor and won't move",
            "I think she's having a heart attack",
            "Mom has severe chest pain",
            "I think it's cardiac arrest",
            "She's having a stroke right now",
            "Signs of a stroke — face drooping and slurred speech",
            "I'm bleeding badly from where she hit me",
            "His face is drooping on one side suddenly",
            "There's blood everywhere from a cut",
            "She fell down the stairs and can't stand",
            "He fell and cannot get up",
            "The house is on fire and mom is inside",
            "She ingested cleaning chemicals under the sink",
            "He's underwater in the bathtub",
            "Mom overdosed on her medication",
        ],
    )
    def test_triggers_on_life_threat(self, message: str):
        result = check_safety_gate(message)
        assert result.triggered, f"Should trigger on: {message}"
        assert result.gate_type == SafetyGateType.LIFE_THREAT
        assert "911" in result.response_text

    @pytest.mark.parametrize(
        "message",
        [
            "Mom keeps breathing heavily when she's upset",
            "She choked up when talking about dad",
            "He fell asleep on the couch",
            "Dad fell in love with that TV show",
            "She's burning through her savings",
            "He's drowning in paperwork",
            "Mom collapsed the cardboard boxes for recycling",
            "She passed the test with flying colors",
            "The fire in her eyes when she talks about gardening",
            "She's had a headache for 2 days",
            "She had a stroke last year and now has vascular dementia",
            "He is a stroke survivor with mild cognitive impairment",
            "She has a seizure disorder and takes levetiracetam",
            "He has cardiac issues and takes metoprolol",
            "Cardiac dementia was mentioned by her neurologist",
            "Post-stroke dementia is her diagnosis",
            "She passed out of the room quickly",
            "He has no reason to go on that walk today",
            "She sees no point in going on the outing",
        ],
    )
    def test_does_not_trigger_on_figurative_language(self, message: str):
        result = check_safety_gate(message)
        assert not result.triggered, f"Should NOT trigger on: {message}"


class TestSelfHarmGate:
    """Self-harm/suicide patterns → 988 deflection."""

    @pytest.mark.parametrize(
        "message",
        [
            "I want to kill myself",
            "I don't want to live anymore",
            "I'd rather be dead",
            "I'm having suicidal thoughts",
            "I've been thinking about ending it all",
            "I'm thinking about suicide",
            "I want to hurt myself",
            "There's no point in going on",
            "I have no reason to live",
            "I'm planning to end my life",
            "I've been cutting myself",
            "Thoughts of dying keep coming back",
            "I don't want to exist anymore",
            "I'd rather die than keep doing this",
        ],
    )
    def test_triggers_on_self_harm(self, message: str):
        result = check_safety_gate(message)
        assert result.triggered, f"Should trigger on: {message}"
        assert result.gate_type == SafetyGateType.SELF_HARM
        assert "988" in result.response_text

    @pytest.mark.parametrize(
        "message",
        [
            "I can't do this anymore, I'm so tired",
            "I feel like giving up sometimes",
            "This is killing me emotionally",
            "I'm dying for a break",
            "I'm exhausted and frustrated",
            "Mom keeps hurting herself by bumping into things",
            "He cuts himself while trying to cook",
            "She doesn't want to go on the walk today",
        ],
    )
    def test_does_not_trigger_on_caregiver_exhaustion(self, message: str):
        result = check_safety_gate(message)
        assert not result.triggered, f"Should NOT trigger on: {message}"


class TestCaregiverHarmRiskGate:
    """Caregiver disclosing fear of harming the care recipient → distinct deflection."""

    @pytest.mark.parametrize(
        "message",
        [
            "I'm scared I might hurt him",
            "I'm afraid I might hurt her if this keeps up",
            "I feel like I'm going to snap",
            "I feel like I am going to lose control",
            "I almost hit him today and it scared me",
            "I can't control my temper around mom anymore",
            "I'm afraid of what I'll do if he wakes me up again tonight",
        ],
    )
    def test_triggers_on_caregiver_harm_risk(self, message: str):
        result = check_safety_gate(message)
        assert result.triggered, f"Should trigger on: {message}"
        assert result.gate_type == SafetyGateType.CAREGIVER_HARM_RISK
        assert "988" in result.response_text or "crisis" in result.response_text.lower()

    @pytest.mark.parametrize(
        "message",
        [
            "I'm so frustrated with him today, he asked the same question ten times",
            "This is driving me crazy but I love him",
            "I'm exhausted and frustrated",
            "He hurt his hand trying to open a jar",
        ],
    )
    def test_does_not_trigger_on_ordinary_frustration(self, message: str):
        result = check_safety_gate(message)
        assert not result.triggered, f"Should NOT trigger on: {message}"


class TestElderAbuseNeglectGate:
    """Disclosure of possible elder abuse/neglect → distinct deflection."""

    @pytest.mark.parametrize(
        "message",
        [
            "My sister leaves her alone for days",
            "She hasn't been fed in days when she stays with my brother",
            "He has bruises I can't explain",
            "The aide hits him when he refuses to cooperate",
            "My brother neglects mom when he watches her",
            "The facility locks him in his room at night",
            "I'm afraid the aide is hurting him",
        ],
    )
    def test_triggers_on_elder_abuse_neglect(self, message: str):
        result = check_safety_gate(message)
        assert result.triggered, f"Should trigger on: {message}"
        assert result.gate_type == SafetyGateType.ELDER_ABUSE_NEGLECT
        assert "1-800-677-1116" in result.response_text

    @pytest.mark.parametrize(
        "message",
        [
            "She bruises easily because of her blood thinners",
            "He forgets to eat unless I remind him",
            "I feel neglectful when I can't visit as often as I'd like",
        ],
    )
    def test_does_not_trigger_on_non_abuse_context(self, message: str):
        result = check_safety_gate(message)
        assert not result.triggered, f"Should NOT trigger on: {message}"


class TestAmbiguousDistress:
    """Ambiguous distress should not hard-trigger a deterministic gate."""

    @pytest.mark.parametrize(
        "message",
        [
            "I don't know what to do anymore, everything feels heavy",
            "I feel so lost lately",
            "Some days I just don't know how much more I can take",
        ],
    )
    def test_ambiguous_distress_does_not_hard_trigger(self, message: str):
        result = check_safety_gate(message)
        assert not result.triggered, f"Ambiguous distress should not hard-trigger gate: {message}"


class TestPriorityOrder:
    """Life-threat takes priority when both patterns match."""

    def test_life_threat_priority_over_self_harm(self):
        message = "I want to kill myself and I can't breathe"
        result = check_safety_gate(message)
        assert result.triggered
        assert result.gate_type == SafetyGateType.LIFE_THREAT

    def test_no_trigger_on_normal_message(self):
        result = check_safety_gate(
            "Mom keeps asking where dad is. He passed away 3 years ago."
        )
        assert not result.triggered
        assert result.gate_type is None
        assert result.response_text == ""

    def test_no_trigger_on_empty(self):
        result = check_safety_gate("")
        assert not result.triggered
