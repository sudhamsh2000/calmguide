"""Observation-window semantics for care changes.

A medication or care change makes prior behaviour a poor predictor of current
behaviour, so for the length of the declared observation window everything
recorded *before* the change is held out of pattern computation rather than
blended with it. Shared by the dossier and by insights so the two derived
nodes cannot drift apart on what counts as learnable history.
"""

from datetime import date, timedelta


def pre_change_cutoff(care_changes: list, today: date) -> date | None:
    """Return the date before which data is excluded, or None if nothing is.

    When several observation windows are open at once the latest change wins:
    an event that invalidates history also invalidates everything the earlier
    events left standing.
    """
    cutoff: date | None = None
    for event in care_changes:
        window_end = event.change_date + timedelta(days=event.observation_window_days)
        if today > window_end:
            continue
        if cutoff is None or event.change_date > cutoff:
            cutoff = event.change_date
    return cutoff


def is_excluded(observed_on: date, cutoff: date | None) -> bool:
    """True when `observed_on` predates an open observation window."""
    return cutoff is not None and observed_on < cutoff
