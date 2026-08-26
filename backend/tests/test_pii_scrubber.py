from app.services.pii_scrubber import scrub_third_party_pii


def test_scrub_names():
    text = "My sister Karen came to visit and Mom got confused"
    result = scrub_third_party_pii(text, patient_name="Mom")
    assert "Karen" not in result
    assert "Mom" in result
    assert "[family member]" in result


def test_scrub_locations():
    text = "She came from Portland and Dad was upset"
    result = scrub_third_party_pii(text, patient_name="Dad")
    assert "Portland" not in result
    assert "Dad" in result


def test_scrub_doctors():
    text = "Dr. Patel changed the medication for Margaret"
    result = scrub_third_party_pii(text, patient_name="Margaret")
    assert "Patel" not in result
    assert "Margaret" in result


def test_preserve_patient_name():
    text = "Margaret keeps trying to leave the house at night"
    result = scrub_third_party_pii(text, patient_name="Margaret")
    assert "Margaret" in result


def test_no_pii_unchanged():
    text = "Patient was agitated during evening medication"
    result = scrub_third_party_pii(text, patient_name="Mom")
    assert result == text


def test_preserve_generic_labels():
    text = "My husband was yelling at his mother again"
    result = scrub_third_party_pii(text, patient_name="Dad")
    assert "husband" in result.lower()
    assert "mother" in result.lower()
