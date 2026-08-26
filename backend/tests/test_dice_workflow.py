"""DICE_PHASES is the single source of truth for how Moment Coach's
orchestration maps onto Describe/Investigate/Create/Evaluate — these tests
just guard against the mapping silently going stale (empty phase, wrong
order) rather than checking any clinical property."""

from app.services.dice_workflow import CREATE, DESCRIBE, DICE_PHASES, EVALUATE, INVESTIGATE


def test_phases_in_dice_order():
    assert [p.code for p in DICE_PHASES] == ["D", "I", "C", "E"]
    assert DICE_PHASES == (DESCRIBE, INVESTIGATE, CREATE, EVALUATE)


def test_every_phase_has_a_summary_and_implementation_pointer():
    for phase in DICE_PHASES:
        assert phase.name
        assert phase.summary.strip()
        assert len(phase.implemented_in) > 0
        for ref in phase.implemented_in:
            assert "." in ref
