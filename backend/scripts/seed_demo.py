"""
Seed script for CalmGuide demo environment.

All names, scenarios, and clinical details are fictional composites
created for demonstration purposes. They do not represent any real individual.

Usage:
    cd backend
    python scripts/seed_demo.py

Requires:
    - Database running and migrated (alembic upgrade head)
    - CONVERSATION_ENCRYPTION_KEY set in .env
    - JWT_SECRET_KEY set in .env (for staff auth)

Creates:
    B2C:
    - 2 family caregiver patient profiles with access codes
    - 8-10 incidents per B2C profile
    - Behavioral dossiers

    B2B:
    - 1 facility: "Sunrise Gardens Memory Care"
    - 10 staff members (1 owner/DON, 2 admin/LPN, 7 staff/CNA)
    - 6 patient profiles linked to the facility
    - 24 behavioral incidents across patients
    - Staff-patient assignments
    - Behavioral dossiers for all patients

Prints all access codes and PINs at the end.
"""

import asyncio
import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.db import get_engine, get_session_factory
from app.models.base import Base
from app.models.behavioral_dossier import BehavioralDossier
from app.models.care_change_event import CareChangeEvent
from app.models.conversation import Conversation
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.auth import hash_access_code
from app.services.crypto import encrypt, validate_encryption_key
from app.services.facility_auth import hash_pin, hash_password

validate_encryption_key()

NOW = datetime.now(timezone.utc)


def days_ago(d: int, hour: int = 12, minute: int = 0) -> datetime:
    return (NOW - timedelta(days=d)).replace(hour=hour, minute=minute, second=0, microsecond=0)


def time_slot_from_hour(hour: int) -> str:
    if hour < 6:
        return "overnight"
    if hour < 12:
        return "morning"
    if hour < 18:
        return "afternoon"
    return "evening"


# ─── B2C PATIENT PROFILES ───────────────────────────────────────────────

B2C_PROFILES = [
    {
        "access_code": "DEMO1FAM",
        "disease_stage": "middle",
        "behavioral_patterns": [
            "Sundowning with agitation between 4-7pm",
            "Wandering at night, especially 1-3am",
            "Resists bathing and evening medication",
            "Repetitive questioning about deceased spouse",
        ],
        "calming_strategies": [
            "Frank Sinatra music on kitchen speaker",
            "Warm milk with honey",
            "Photo album of family vacations",
            "Walking together in the backyard",
        ],
        "safety_concerns": [
            "Elopement risk — tries front door at night",
            "Fall risk on stairs",
            "Leaves stove on after cooking attempts",
        ],
    },
    {
        "access_code": "DEMO2FAM",
        "disease_stage": "early",
        "behavioral_patterns": [
            "Anxiety about forgetting appointments",
            "Misplacing items and accusing family of stealing",
            "Withdrawal from social activities",
            "Repetitive questions about the day's schedule",
        ],
        "calming_strategies": [
            "Written daily schedule on whiteboard",
            "Gardening together",
            "Listening to NPR radio",
            "Sorting coins or buttons (organizing task)",
        ],
        "safety_concerns": [
            "Still driving — family monitoring",
            "Forgets to take morning medication",
            "May leave house without phone",
        ],
    },
    # ─── COMPREHENSIVE B2C PROFILE ──────────────────────────────────────
    # Helen Chen — 14+ months of longitudinal data covering all features:
    # stage transition (early→middle), care changes, all incident categories,
    # delirium spike, pain indicators, conversations, dossier, feedback
    {
        "access_code": "HELENCH3",
        "disease_stage": "middle",
        "previous_stage": "early",
        "stage_changed_at": NOW - timedelta(days=120),
        "behavioral_patterns": [
            "Sundowning with agitation 5-8pm — worsened after stage transition",
            "Nighttime wandering 1-4am, checks front door and kitchen",
            "Refuses morning shower but accepts evening sponge bath",
            "Repetitive questioning about her mother (deceased 30 years)",
            "Paranoid ideation — accuses daughter of hiding car keys",
            "Visual misperceptions in dim lighting (coats on hooks = intruders)",
            "Exit-seeking behavior peaks after phone calls with siblings",
            "Resists new caregivers — takes 2-3 visits to accept",
        ],
        "calming_strategies": [
            "Cantonese opera on the tablet (specific playlist: 'Helen's Favorites')",
            "Folding laundry — especially towels and napkins",
            "Looking at family dim sum photos on the iPad",
            "Walking in the garden, especially near the rose bushes",
            "Warm jasmine tea with two sugars",
            "Brushing her hair — finds it soothing",
            "Sorting mahjong tiles by suit (no game, just sorting)",
            "Daughter Michelle's voice on phone speaker — most effective in crisis",
        ],
        "safety_concerns": [
            "Fall risk — unsteady gait, especially after waking",
            "Elopement risk — tried to leave twice in last 6 months",
            "Leaves gas stove on — knobs removed, electric kettle only",
            "Hides medications in tissue box — check morning/evening",
            "Allergic to lavender — do NOT use lavender-scented products",
            "Chokes on thin liquids — use nectar-thick consistency",
            "Bilingual — reverts to Cantonese when distressed or confused",
        ],
    },
]

# ─── B2B FACILITY ────────────────────────────────────────────────────────

FACILITY = {
    "name": "Sunrise Gardens Memory Care",
    "facility_code": "SRSGARDN",
}

# ─── B2B STAFF ───────────────────────────────────────────────────────────

STAFF = [
    {"name": "Patricia Donnelly", "role": "owner", "pin": "7734", "email": "trish.donnelly@demo.calmguide.app", "password": "DemoOwner2026!", "shift": "day", "lang": "en-US"},
    {"name": "James Okafor", "role": "admin", "pin": "4521", "email": "james.okafor@demo.calmguide.app", "password": "DemoAdmin2026!", "shift": "day", "lang": "en-US"},
    {"name": "Priya Nair", "role": "admin", "pin": "3309", "email": "priya.nair@demo.calmguide.app", "password": "DemoAdmin2026!", "shift": "evening", "lang": "en-US"},
    {"name": "Linda Reyes", "role": "staff", "pin": "1111", "shift": "day", "lang": "en-US"},
    {"name": "Marie-Claire Beaumont", "role": "staff", "pin": "2222", "shift": "day", "lang": "en-US"},
    {"name": "Aisha Thompson", "role": "staff", "pin": "3333", "shift": "day", "lang": "en-US"},
    {"name": "Gabriela Moreno", "role": "staff", "pin": "4444", "shift": "evening", "lang": "es-ES"},
    {"name": "Blessing Adeyemi", "role": "staff", "pin": "5555", "shift": "evening", "lang": "en-US"},
    {"name": "Rosalie Toussaint", "role": "staff", "pin": "6666", "shift": "night", "lang": "en-US"},
    {"name": "Kevin Park", "role": "staff", "pin": "7777", "shift": "night", "lang": "en-US"},
]

# ─── B2B PATIENT PROFILES ────────────────────────────────────────────────

B2B_PROFILES = [
    {
        "access_code": "PEGSULLY",
        "room": "104",
        "disease_stage": "early",
        "behavioral_patterns": ["Sundowning with increased confusion after 4pm", "Repetitive questioning about her late husband", "Misplacing items and accusing staff of theft", "Anxious pacing before mealtimes"],
        "calming_strategies": ["Play 1960s folk music (Joan Baez, Peter Paul and Mary)", "Offer photo album of school pictures", "Redirect with sorting task — colored buttons or paperclips", "Warm herbal tea with honey"],
        "safety_concerns": ["Hides food in dresser drawers — choking and hygiene risk", "Occasionally tries to leave building to 'go teach class'", "Refuses evening medications when sundowning"],
    },
    {
        "access_code": "BOBYCHEN",
        "room": "112",
        "disease_stage": "middle",
        "behavioral_patterns": ["Physical resistance during personal care, especially bathing", "Nighttime wakefulness with calling out between 1-4am", "Verbal aggression toward male staff members", "Shadowing — follows specific CNA constantly"],
        "calming_strategies": ["Female staff provide personal care", "Play classical Chinese erhu music during bathing", "Offer warm washcloth for hands before full bath", "Allow him to hold his engineering slide rule during transitions"],
        "safety_concerns": ["Has struck staff during bathing — requires two-person assist", "Fall risk when getting out of bed at night", "Pulls at catheter tubing", "Does not respond to English commands when agitated — use simple Mandarin phrases"],
    },
    {
        "access_code": "DOTWASHN",
        "room": "108",
        "disease_stage": "late",
        "behavioral_patterns": ["Vocalizations — repetitive calling out 'help me' throughout the day", "Resistance to repositioning and transfers", "Grimacing and guarding during diaper changes suggesting pain", "Brief periods of lucidity followed by deep confusion"],
        "calming_strategies": ["Gospel music — especially Amazing Grace and How Great Thou Art", "Gentle hand massage with lavender lotion", "Soft speaking close to right ear — better hearing on that side", "Daughter Yvonne's voice on recorded message for acute agitation"],
        "safety_concerns": ["Aspiration pneumonia risk — thickened liquids only", "Skin breakdown — must reposition every 2 hours", "Non-verbal pain indicators must be monitored — PAINAD scale", "Contracture risk in left hand — range of motion exercises"],
    },
    {
        "access_code": "FRNKKOWL",
        "unit": "East Wing",
        "room": "115",
        "bed": None,
        "disease_stage": "middle",
        "behavioral_patterns": ["Exit-seeking behavior — tries doors repeatedly after 3pm", "Paranoid ideation — believes staff are stealing his belongings", "Refuses to eat food he has not seen prepared", "PTSD-related startle responses to loud noises and alarms"],
        "calming_strategies": ["Walk with him to the door, acknowledge his concern, redirect to snack area", "Male staff have better rapport for redirection", "Let him watch food being plated in the kitchen", "Speak in calm low tones — never approach from behind"],
        "safety_concerns": ["Elopement risk — door alarm on room and exits", "Has pushed staff when startled — approach from front always", "Hoards sharp utensils in nightstand — check daily", "History of combative episodes when cornered physically"],
    },
    {
        "access_code": "MARGUTRZ",
        "unit": None,
        "room": "103",
        "bed": "A",
        "disease_stage": "early",
        "behavioral_patterns": ["Repetitive organizing and cleaning behaviors", "Confabulation — tells detailed but fictional stories about running the restaurant", "Becomes agitated when routine changes", "Mild hoarding of napkins and plastic utensils from dining room"],
        "calming_strategies": ["Give her towels to fold or silverware to sort", "Engage in Spanish conversation about cooking", "Maintain strict daily schedule posted in room in Spanish", "Allow her to help set tables before meals"],
        "safety_concerns": ["Wanders into kitchen area — hot surfaces and sharp objects", "May eat non-food items she is organizing", "Family visits only on weekends — increased agitation on Mondays", "Bilingual — reverts to Spanish-only when distressed"],
    },
    {
        "access_code": "HARYJOHN",
        "room": "120",
        "disease_stage": "middle",
        "behavioral_patterns": ["Visual hallucinations — sees children playing in his room, usually benign", "Fluctuating cognition — very lucid some mornings then deeply confused by afternoon", "REM sleep behavior disorder — acts out dreams, falls from bed", "Parkinsonian gait with freezing episodes"],
        "calming_strategies": ["Do not contradict hallucinations — ask what the children are doing", "Schedule important conversations and decisions for morning hours", "Bed alarm and low bed with floor mat at night", "Count 1-2-3 to help initiate movement during freezing"],
        "safety_concerns": ["HIGH FALL RISK — Lewy body Parkinsonism plus sleep disorder", "Sensitive to antipsychotic medications — NEVER give haloperidol", "Fluctuating consciousness could mask acute medical events", "Orthostatic hypotension — stand slowly with assist"],
    },
]

# ─── INCIDENTS ───────────────────────────────────────────────────────────

def build_incidents(profile_id: str, staff_ids: dict, facility_id: str) -> list[dict]:
    """Build incidents for B2B profiles. staff_ids maps name→id."""
    linda = staff_ids.get("Linda Reyes")
    aisha = staff_ids.get("Aisha Thompson")
    gabriela = staff_ids.get("Gabriela Moreno")
    kevin = staff_ids.get("Kevin Park")
    rosalie = staff_ids.get("Rosalie Toussaint")
    blessing = staff_ids.get("Blessing Adeyemi")

    return []  # Incidents are built per-profile below


# ─── HELEN CHEN: 14+ MONTHS LONGITUDINAL DATA ──────────────────────────
# Covers all behavior categories, severity levels, outcomes, time slots,
# stage transition (early→middle at ~120 days ago), delirium spike,
# pain indicators, care changes, and dossier computation triggers.

B2C_INCIDENT_DATA = {
    "HELENCH3": [
        # ── Month 14-12 (early stage, mild incidents) ──
        {"days": 420, "hour": 15, "cat": "confusion_disorientation", "sev": "mild",
         "ante": "Returned from grocery store, couldn't find car in parking lot", "ante_cat": "transition",
         "desc": "Stood in parking lot confused for 10 minutes. Found car with help from passerby.",
         "inter": "Daughter picked her up. Decided to accompany her on errands going forward.",
         "outcome": "resolved", "loc": "community", "dur": "minutes", "role": "adult_child", "recall": "high"},
        {"days": 400, "hour": 10, "cat": "repetitive_behavior", "sev": "mild",
         "ante": "Morning routine — no identifiable trigger", "ante_cat": "unknown",
         "desc": "Asked about mother's visit 8 times in one hour. Became tearful when told mother passed away.",
         "inter": "Stopped giving factual answer. Said 'Mom sends her love.' Redirected to photo album.",
         "outcome": "resolved", "loc": "living_room", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 380, "hour": 19, "cat": "confusion_disorientation", "sev": "mild",
         "ante": "Evening after family dinner", "ante_cat": "social",
         "desc": "Did not recognize son-in-law who visits weekly. Called him 'the repairman.'",
         "inter": "Son-in-law introduced himself casually. Helen accepted. No distress.",
         "outcome": "resolved", "loc": "dining_room", "dur": "minutes", "role": "other_family"},

        # ── Month 11-10 (early stage, increasing frequency) ──
        {"days": 350, "hour": 17, "cat": "aggression_anger", "sev": "mild",
         "ante": "Daughter tried to take car keys", "ante_cat": "social",
         "desc": "Accused daughter of stealing keys. Yelling: 'You want to trap me here!' Slammed door.",
         "inter": "Gave space for 20 minutes. Offered jasmine tea. Discussed outing plan for tomorrow.",
         "outcome": "partially_resolved", "loc": "kitchen", "dur": "minutes", "role": "adult_child"},
        {"days": 330, "hour": 2, "cat": "wandering_exit_seeking", "sev": "moderate",
         "ante": "Woke up disoriented at 2am", "ante_cat": "physical_state",
         "desc": "Found at front door trying to unlock deadbolt. Said she needed to open the restaurant.",
         "inter": "Walked with her to kitchen. Made jasmine tea. Played Cantonese opera. Back to bed in 30 min.",
         "outcome": "resolved", "loc": "front_door", "dur": "minutes", "role": "adult_child"},
        {"days": 310, "hour": 8, "cat": "refusing_care", "sev": "mild",
         "ante": "Morning shower time", "ante_cat": "task_demand",
         "desc": "Refused shower. Said 'I already bathed.' Had not bathed in 3 days.",
         "inter": "Offered sponge bath instead. Accepted evening sponge bath with warm water.",
         "outcome": "resolved", "loc": "bathroom", "dur": "minutes", "role": "adult_child"},

        # ── Month 9-8 (late early stage, paranoia emerging) ──
        {"days": 280, "hour": 14, "cat": "aggression_anger", "sev": "moderate",
         "ante": "New home aide visited for first time", "ante_cat": "social",
         "desc": "Refused to let aide into house. Yelling in Cantonese. Locked bathroom door.",
         "inter": "Daughter introduced aide as 'my friend from church.' Helen suspicious but allowed entry after 30 min.",
         "outcome": "partially_resolved", "loc": "front_door", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 260, "hour": 21, "cat": "hallucinations", "sev": "mild",
         "ante": "Dim lighting in hallway at night", "ante_cat": "environmental",
         "desc": "Saw coats on hooks as people standing in hallway. Became frightened, called out for daughter.",
         "inter": "Turned on bright lights. 'See? Just our coats.' Removed coats from hallway hooks.",
         "outcome": "resolved", "loc": "hallway", "dur": "minutes", "role": "adult_child"},
        {"days": 240, "hour": 18, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "Sundowning period", "ante_cat": "physical_state",
         "desc": "Insisted on leaving to 'pick up children from school.' Very agitated, tried to find car keys.",
         "inter": "Walked in garden near roses. Offered towels to fold. Played Cantonese opera. Calmed in 20 min.",
         "outcome": "resolved", "loc": "living_room", "dur": "minutes", "role": "adult_child"},

        # ── Month 7-6 (transition period: early→middle) ──
        {"days": 210, "hour": 6, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "Woke early, bathroom was dark", "ante_cat": "environmental",
         "desc": "Could not find bathroom in own home. Urinated in closet. Very distressed afterwards.",
         "inter": "Night lights installed in hallway and bathroom. Reassured her. No blame.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes", "role": "adult_child"},
        {"days": 195, "hour": 12, "cat": "refusing_care", "sev": "moderate",
         "ante": "Lunch medication time", "ante_cat": "task_demand",
         "desc": "Hid lunchtime medications in tissue box. Found 5 days of pills hidden. Refused to take them.",
         "inter": "Doctor switched to liquid form. Michelle gives meds in applesauce. Watching her swallow.",
         "outcome": "resolved", "loc": "kitchen", "dur": "minutes", "role": "adult_child",
         "source": "manual", "verified": True},
        {"days": 180, "hour": 3, "cat": "wandering_exit_seeking", "sev": "severe",
         "ante": "Nighttime confusion — possibly UTI", "ante_cat": "physical_state",
         "desc": "Left house through back door at 3am. Found by neighbor walking on sidewalk in pajamas, disoriented.",
         "inter": "Neighbor called Michelle. Door alarm installed next day. Doctor visit revealed UTI.",
         "outcome": "escalated", "loc": "outside", "dur": "about_an_hour", "role": "adult_child",
         "source": "manual", "verified": True},

        # ── Month 5 (stage changed to middle: day 120) ──
        {"days": 150, "hour": 17, "cat": "aggression_anger", "sev": "severe",
         "ante": "Sibling called to discuss moving Helen to memory care", "ante_cat": "social",
         "desc": "Overheard phone call. Became very agitated. Threw remote control at wall. Screaming in Cantonese.",
         "inter": "Michelle hung up phone. Sat quietly nearby. Offered jasmine tea. Helen cried for 20 min then calmed.",
         "outcome": "resolved", "loc": "living_room", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 140, "hour": 19, "cat": "confusion_disorientation", "sev": "severe",
         "ante": "Daylight saving time change", "ante_cat": "environmental",
         "desc": "Complete disorientation — did not recognize own home. Packed suitcase to 'go home to Hong Kong.'",
         "inter": "Family photos, jasmine tea, Cantonese opera. Took 90 minutes to settle. Very distressed.",
         "outcome": "partially_resolved", "loc": "bedroom", "dur": "longer", "role": "adult_child"},

        # ── Month 4 (middle stage, new patterns) ──
        {"days": 110, "hour": 14, "cat": "repetitive_behavior", "sev": "moderate",
         "ante": "Afternoon — no structured activity", "ante_cat": "unknown",
         "desc": "Sorted and re-sorted mahjong tiles for 3 hours. Would not stop for snack or bathroom.",
         "inter": "Let her continue. Brought snack to table. She ate while sorting. Bathroom break with gentle prompt.",
         "outcome": "resolved", "loc": "living_room", "dur": "longer", "role": "paid_aide"},
        {"days": 100, "hour": 22, "cat": "sleep_problems", "sev": "moderate",
         "ante": "Evening — restless, could not settle for bed", "ante_cat": "physical_state",
         "desc": "Up and down from bed 7 times between 9pm and midnight. Checking kitchen, windows, doors.",
         "inter": "Walked with her doing 'house check.' Locked doors together. Hair brushing, jasmine tea. Asleep by 12:30.",
         "outcome": "resolved", "loc": "bedroom", "dur": "longer", "role": "adult_child"},
        {"days": 90, "hour": 11, "cat": "refusing_care", "sev": "moderate",
         "ante": "New paid aide trying to help with dressing", "ante_cat": "social",
         "desc": "Refused new aide completely. Pushed aide's hands away. 'Only Michelle helps me.'",
         "inter": "Michelle dressed her while aide observed. Took 3 visits for Helen to accept aide for dressing.",
         "outcome": "escalated", "loc": "bedroom", "dur": "minutes", "role": "paid_aide"},

        # ── Month 3 (settling into middle stage) ──
        {"days": 75, "hour": 7, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "Woke after vivid dream", "ante_cat": "physical_state",
         "desc": "Believed she was late for dim sum with husband (deceased 8 years). Got fully dressed at 6am.",
         "inter": "Made dim sum at home. Looked at photos of husband. Helen peaceful for rest of morning.",
         "outcome": "resolved", "loc": "kitchen", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 60, "hour": 16, "cat": "aggression_anger", "sev": "moderate",
         "ante": "Daughter took away scissors (safety concern)", "ante_cat": "task_demand",
         "desc": "Accused Michelle of treating her like a child. Verbal aggression, threw newspaper.",
         "inter": "Gave space. Returned with jasmine tea and dim sum photos. Redirected to towel folding.",
         "outcome": "resolved", "loc": "living_room", "dur": "minutes", "role": "adult_child"},
        {"days": 45, "hour": 20, "cat": "hallucinations", "sev": "moderate",
         "ante": "Evening, low lighting", "ante_cat": "environmental",
         "desc": "Insisted there were people in the garden looking through the window. Frightened, would not go near windows.",
         "inter": "Closed curtains. Turned on all lights. Sat with her watching Cantonese drama on iPad.",
         "outcome": "resolved", "loc": "living_room", "dur": "minutes", "role": "adult_child"},

        # ── Month 2 (recent — triggering frequency trends) ──
        {"days": 30, "hour": 18, "cat": "wandering_exit_seeking", "sev": "moderate",
         "ante": "Sibling phone call about holiday plans", "ante_cat": "social",
         "desc": "After call, tried front door repeatedly. Door alarm triggered. Agitated for 45 minutes.",
         "inter": "Garden walk with roses. Cantonese opera. Jasmine tea. Towel folding. Calmed gradually.",
         "outcome": "resolved", "loc": "front_door", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 25, "hour": 8, "cat": "refusing_care", "sev": "mild",
         "ante": "Morning medication time", "ante_cat": "task_demand",
         "desc": "Spat out liquid medication. Said it tasted bad.",
         "inter": "Mixed with apple juice. Accepted. Note: medication in apple juice works better than applesauce.",
         "outcome": "resolved", "loc": "kitchen", "dur": "seconds", "role": "adult_child"},
        {"days": 20, "hour": 15, "cat": "repetitive_behavior", "sev": "mild",
         "ante": "After lunch, no activity planned", "ante_cat": "unknown",
         "desc": "Asked 'Where is mama?' 30+ times. Tearful each time told mother passed.",
         "inter": "Therapeutic fib: 'Mama called, she loves you.' Redirected with mahjong tiles. Settled.",
         "outcome": "resolved", "loc": "living_room", "dur": "about_an_hour", "role": "paid_aide"},

        # ── Last 2 weeks (delirium spike + pain indicators) ──
        {"days": 12, "hour": 3, "cat": "confusion_disorientation", "sev": "severe",
         "ante": "Sudden onset — possible UTI again", "ante_cat": "physical_state",
         "desc": "SUDDEN severe confusion — did not recognize daughter. Screaming in Cantonese. Hitting at caregivers.",
         "inter": "Called 911 guidance line. Doctor next morning found UTI. Antibiotics started.",
         "outcome": "escalated", "loc": "bedroom", "dur": "longer", "role": "adult_child",
         "source": "manual", "verified": True},
        {"days": 10, "hour": 9, "cat": "aggression_anger", "sev": "severe",
         "ante": "During morning care — still on antibiotics for UTI", "ante_cat": "task_demand",
         "desc": "Severe agitation during dressing. Swung at aide. Grimacing, guarding right hip. Crying.",
         "inter": "Stopped dressing. PAINAD assessment. Called doctor — ordered X-ray. Hip bruise from fall 2 days prior.",
         "outcome": "escalated", "loc": "bedroom", "dur": "about_an_hour", "role": "paid_aide"},
        {"days": 8, "hour": 17, "cat": "aggression_anger", "sev": "moderate",
         "ante": "Sundowning + residual UTI discomfort", "ante_cat": "physical_state",
         "desc": "Verbally aggressive toward aide during evening routine. Threw cup of tea.",
         "inter": "Aide retreated. Michelle called on speaker. Helen calmed hearing daughter's voice in 10 min.",
         "outcome": "resolved", "loc": "kitchen", "dur": "minutes", "role": "paid_aide"},
        {"days": 6, "hour": 2, "cat": "wandering_exit_seeking", "sev": "moderate",
         "ante": "Nighttime — still recovering from UTI", "ante_cat": "physical_state",
         "desc": "Door alarm at 2am. Found at back door, very confused. Unsteady on feet.",
         "inter": "Walked back to bed. Jasmine tea. Cantonese opera on low volume. Fell asleep.",
         "outcome": "resolved", "loc": "back_door", "dur": "minutes", "role": "adult_child"},
        {"days": 5, "hour": 11, "cat": "refusing_care", "sev": "moderate",
         "ante": "New medication for UTI — unfamiliar pill", "ante_cat": "task_demand",
         "desc": "Refused antibiotic. 'You're poisoning me.' Pushed pill cup across table.",
         "inter": "Crushed antibiotic in apple juice. Helen drank it. Monitoring medication compliance.",
         "outcome": "resolved", "loc": "kitchen", "dur": "minutes", "role": "adult_child"},

        # ── Last 7 days (current week — spike for delirium detection) ──
        {"days": 4, "hour": 16, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "Afternoon sundowning — recovering from UTI", "ante_cat": "physical_state",
         "desc": "Did not recognize house. Packed bag. 'I need to go home.' Very anxious.",
         "inter": "Garden walk. Showed her room with familiar items. Dim sum photos. Settled in 30 min.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes", "role": "adult_child"},
        {"days": 3, "hour": 7, "cat": "aggression_anger", "sev": "mild",
         "ante": "Morning routine — aide helping with breakfast", "ante_cat": "task_demand",
         "desc": "Refused breakfast from aide. 'I don't know you.' Mild verbal aggression.",
         "inter": "Aide waited. Offered jasmine tea first. Helen accepted tea, then ate breakfast.",
         "outcome": "resolved", "loc": "kitchen", "dur": "minutes", "role": "paid_aide"},
        {"days": 2, "hour": 22, "cat": "sleep_problems", "sev": "moderate",
         "ante": "Evening — restless, possible residual pain", "ante_cat": "physical_state",
         "desc": "Could not settle. Up 5 times. Checking doors and windows. Grimacing when walking.",
         "inter": "Tylenol for hip pain. Hair brushing. Jasmine tea. Cantonese opera. Asleep by 11:30pm.",
         "outcome": "resolved", "loc": "bedroom", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 1, "hour": 6, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "Woke very early, disoriented", "ante_cat": "physical_state",
         "desc": "Thought she was in her childhood home in Hong Kong. Speaking only Cantonese. Anxious.",
         "inter": "Daughter spoke Cantonese. Made congee. Showed family photos. Helen oriented within 40 min.",
         "outcome": "resolved", "loc": "bedroom", "dur": "about_an_hour", "role": "adult_child"},
        {"days": 0, "hour": 14, "cat": "repetitive_behavior", "sev": "mild",
         "ante": "After lunch — aide on break", "ante_cat": "unknown",
         "desc": "Asking 'Where is Michelle?' every 2-3 minutes for 45 minutes.",
         "inter": "Called Michelle on speaker. Short conversation. Gave mahjong tiles. Settled.",
         "outcome": "resolved", "loc": "living_room", "dur": "about_an_hour", "role": "paid_aide"},
    ],
}

# Helen Chen's dossier + care change events are added in Phase 4 below

def build_b2c_incidents(profile_id: str) -> list[dict]:
    """Build incidents for B2C profiles (no staff attribution)."""
    return [
        {
            "profile_id": profile_id,
            "source": "auto_extracted",
            "incident_time": days_ago(1, 2, 15),
            "time_slot": "overnight",
            "behavior_category": "wandering_exit_seeking",
            "severity": "moderate",
            "antecedent_description": encrypt("Patient woke up confused, found at front door at 2am"),
            "antecedent_category": "physical_state",
            "behavior_description": encrypt("Tried to leave through front door, very confused about where she was"),
            "intervention_description": encrypt("Played Sinatra music on phone, offered warm milk, walked her back to bed"),
            "intervention_outcome": "resolved",
            "location": "front_door",
            "caregiver_role": "spouse",
            "extraction_confidence": 0.89,
            "verified_by_caregiver": True,
        },
        {
            "profile_id": profile_id,
            "source": "manual",
            "incident_time": days_ago(3, 18, 30),
            "time_slot": "evening",
            "behavior_category": "refusing_care",
            "severity": "mild",
            "antecedent_description": encrypt("Evening medication time during sundowning period"),
            "antecedent_category": "task_demand",
            "behavior_description": encrypt("Refused evening medications, pushed pill cup away"),
            "intervention_description": encrypt("Waited 30 minutes, offered medication with applesauce, accepted"),
            "intervention_outcome": "resolved",
            "location": "bedroom",
            "caregiver_role": "spouse",
        },
        {
            "profile_id": profile_id,
            "source": "auto_extracted",
            "incident_time": days_ago(5, 16, 45),
            "time_slot": "afternoon",
            "behavior_category": "confusion_disorientation",
            "severity": "moderate",
            "antecedent_description": encrypt("Shift change noise triggered confusion"),
            "antecedent_category": "transition",
            "behavior_description": encrypt("Insisted she needed to leave to pick up children from school"),
            "intervention_description": encrypt("Walked with her, showed photo album, redirected to favorite TV show"),
            "intervention_outcome": "resolved",
            "location": "common_area",
            "caregiver_role": "adult_child",
            "extraction_confidence": 0.85,
        },
        {
            "profile_id": profile_id,
            "source": "manual",
            "incident_time": days_ago(7, 7, 0),
            "time_slot": "morning",
            "behavior_category": "aggression_anger",
            "severity": "moderate",
            "antecedent_description": encrypt("Woke disoriented after poor sleep"),
            "antecedent_category": "physical_state",
            "behavior_description": encrypt("Accused caregiver of stealing wedding ring, yelling"),
            "intervention_description": encrypt("Found ring in soap dish, showed it to her"),
            "intervention_outcome": "partially_resolved",
            "location": "bedroom",
            "caregiver_role": "spouse",
        },
    ]


# Per-profile B2B incidents
INCIDENT_DATA = {
    "PEGSULLY": [
        {"days": 3, "hour": 16, "min": 45, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "Shift change noise and commotion in hallway", "ante_cat": "transition",
         "desc": "Became confused during shift change, insisted she needed to go grade papers. Pulled coats off rack near entrance.",
         "inter": "CNA walked with her, redirected to activity room, gave photo album. Settled in 10 minutes.",
         "outcome": "resolved", "loc": "common_area", "dur": "minutes"},
        {"days": 5, "hour": 18, "min": 30, "cat": "refusing_care", "sev": "mild",
         "ante": "Evening medication pass during sundowning period", "ante_cat": "task_demand",
         "desc": "Refused evening medications, pushed cup away, said 'those aren't mine, you're trying to poison me.'",
         "inter": "Waited 30 minutes, came back with medications in applesauce. Accepted from different staff member.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes"},
        {"days": 2, "hour": 14, "min": 15, "cat": "repetitive_behavior", "sev": "mild",
         "ante": "No identifiable trigger — started after lunch", "ante_cat": "unknown",
         "desc": "Asked 'Where is my husband Tom?' 23 times in 45 minutes. Became tearful each time told he had passed.",
         "inter": "Stopped giving factual answers. Redirected: 'Tell me about Tom.' Showed photo album. Agitation decreased.",
         "outcome": "resolved", "loc": "common_area", "dur": "about_an_hour"},
        {"days": 0, "hour": 7, "min": 0, "cat": "aggression_anger", "sev": "moderate",
         "ante": "Woke disoriented after poor sleep", "ante_cat": "physical_state",
         "desc": "Accused night CNA of stealing wedding ring. Verbally aggressive, yelling in hallway.",
         "inter": "Found ring in soap dish. Showed it to her. Calmed immediately but remained suspicious.",
         "outcome": "partially_resolved", "loc": "bedroom", "dur": "minutes"},
    ],
    "BOBYCHEN": [
        {"days": 2, "hour": 8, "min": 30, "cat": "refusing_care", "sev": "severe",
         "ante": "Male CNA attempted to assist with shower", "ante_cat": "task_demand",
         "desc": "Struck CNA on forearm during morning bath. Clenched fists, shouted in Mandarin, tried to climb out of shower chair.",
         "inter": "CNA exited. Female CNA took over, played erhu music. Allowed sponge bath but not full shower.",
         "outcome": "partially_resolved", "loc": "bathroom", "dur": "minutes"},
        {"days": 4, "hour": 2, "min": 30, "cat": "sleep_problems", "sev": "moderate",
         "ante": "Woke with urinary urgency, could not find call button", "ante_cat": "physical_state",
         "desc": "Found standing at nurses station calling out in Mandarin. Disoriented. Had pulled out catheter.",
         "inter": "Nurse replaced catheter. CNA walked him back to room. Played soft music. 40 minutes to resettle.",
         "outcome": "resolved", "loc": "hallway", "dur": "about_an_hour"},
        {"days": 1, "hour": 11, "min": 0, "cat": "aggression_anger", "sev": "moderate",
         "ante": "Unfamiliar male visitor walking past his room", "ante_cat": "social",
         "desc": "Verbal aggression toward male visitor. Called him 'intruder' and blocked doorway.",
         "inter": "CNA redirected to activity room. Gave slide rule. Visitor escorted around other hallway.",
         "outcome": "resolved", "loc": "hallway", "dur": "minutes"},
        {"days": 0, "hour": 17, "min": 0, "cat": "repetitive_behavior", "sev": "mild",
         "ante": "CNA shift ending, replacement arriving", "ante_cat": "transition",
         "desc": "Shadowing behavior — followed CNA continuously for 2 hours, distressed when she went on break.",
         "inter": "Introduced replacement CNA before leaving. Initially agitated, accepted after 15 min with slide rule.",
         "outcome": "resolved", "loc": "common_area", "dur": "about_an_hour"},
    ],
    "DOTWASHN": [
        {"days": 1, "hour": 10, "min": 0, "cat": "other", "sev": "moderate",
         "ante": "Grimacing noted — possible pain from constipation (no BM in 3 days)", "ante_cat": "physical_state",
         "desc": "Repetitive calling out 'help me' for 90 minutes. Other residents and visitors distressed.",
         "inter": "PAINAD assessment (score 6). PRN Tylenol. Lavender hand massage. Vocalizations decreased 50% after 30 min.",
         "outcome": "partially_resolved", "loc": "bedroom", "dur": "longer"},
        {"days": 3, "hour": 15, "min": 0, "cat": "refusing_care", "sev": "moderate",
         "ante": "Scheduled 2-hour repositioning", "ante_cat": "task_demand",
         "desc": "Resistance and crying during repositioning. Stiffened body, pushed aide's hands away.",
         "inter": "Two-person repositioning. Played recorded message from daughter Yvonne. Completed but remained distressed.",
         "outcome": "partially_resolved", "loc": "bedroom", "dur": "minutes"},
        {"days": 5, "hour": 9, "min": 0, "cat": "other", "sev": "mild",
         "ante": "Daughter Yvonne visiting during breakfast", "ante_cat": "social",
         "desc": "Period of unusual lucidity — recognized daughter by name, asked about grandchildren. Lasted ~20 min.",
         "inter": "Staff documented lucid episode. Yvonne overjoyed. Returned to baseline confusion within 30 minutes.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes"},
        {"days": 2, "hour": 1, "min": 0, "cat": "sleep_problems", "sev": "severe",
         "ante": "No identifiable trigger — may be pain or nighttime confusion", "ante_cat": "unknown",
         "desc": "Loud vocalizations woke 4 other residents. Bed alarm triggered. Attempting to climb over side rail.",
         "inter": "Nurse found impacted stool. After treatment, vocalizations stopped. Gospel music played overnight.",
         "outcome": "resolved", "loc": "bedroom", "dur": "about_an_hour"},
    ],
    "FRNKKOWL": [
        {"days": 1, "hour": 15, "min": 30, "cat": "wandering_exit_seeking", "sev": "severe",
         "ante": "Visitor left through front door — Frank followed", "ante_cat": "transition",
         "desc": "Made it through first doors to vestibule before alarm. Said he needed to 'report for duty.' Physically resisted.",
         "inter": "Two staff redirected to snack area. Offered coffee, talked about police career. 25 min to de-escalate.",
         "outcome": "resolved", "loc": "exit_area", "dur": "minutes"},
        {"days": 3, "hour": 12, "min": 15, "cat": "refusing_care", "sev": "moderate",
         "ante": "Lunch served with medications crushed into pudding (visible)", "ante_cat": "task_demand",
         "desc": "Refused lunch, pushed tray off table. 'I'm not eating anything I didn't see made.'",
         "inter": "Kitchen let him watch tray being prepared. Ate full meal. Medication approach changed to un-crushed pills.",
         "outcome": "resolved", "loc": "dining_room", "dur": "minutes"},
        {"days": 4, "hour": 22, "min": 0, "cat": "aggression_anger", "sev": "severe",
         "ante": "Room door opened abruptly, hallway light spilled in", "ante_cat": "environmental",
         "desc": "Startled awake, swung fist connecting with CNA's shoulder. Yelling 'Get down!' — PTSD flashback.",
         "inter": "Staff retreated. Spoke calmly from doorway: 'Frank, you are safe.' 15 min. Night check protocol changed.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes"},
        {"days": 0, "hour": 16, "min": 0, "cat": "wandering_exit_seeking", "sev": "moderate",
         "ante": "Thunderstorm with loud thunder triggering anxiety", "ante_cat": "environmental",
         "desc": "Checking every door systematically. Tried fire exit, staff bathroom, utility closet. Growing frustrated.",
         "inter": "Walked with him, showed weather from window. Gave snack. Storm passed, behavior stopped.",
         "outcome": "resolved", "loc": "hallway", "dur": "about_an_hour"},
    ],
    "MARGUTRZ": [
        {"days": 2, "hour": 11, "min": 30, "cat": "wandering_exit_seeking", "sev": "moderate",
         "ante": "After activity ended, no structured activity before lunch", "ante_cat": "transition",
         "desc": "Found in commercial kitchen organizing pots and pans. Bypassed keypad when food worker exited.",
         "inter": "Escorted from kitchen. Given towels to fold. Added 'help set lunch tables' to daily schedule.",
         "outcome": "resolved", "loc": "kitchen", "dur": "minutes"},
        {"days": 5, "hour": 9, "min": 0, "cat": "confusion_disorientation", "sev": "mild",
         "ante": "New CNA unfamiliar with confabulation patterns", "ante_cat": "social",
         "desc": "Told detailed story about restaurant inspector coming today. Anxious when CNA didn't respond in Spanish.",
         "inter": "Spanish-speaking CNA took over. Validated: 'Everything looks perfect.' Maria relaxed, moved to breakfast.",
         "outcome": "resolved", "loc": "common_area", "dur": "minutes"},
        {"days": 1, "hour": 8, "min": 0, "cat": "aggression_anger", "sev": "moderate",
         "ante": "First morning after weekend family visit — Monday agitation pattern", "ante_cat": "physical_state",
         "desc": "Verbally aggressive during morning routine. Screamed 'No me toques!' Threw cup. Crying afterwards.",
         "inter": "Let her cry 5 min, sat nearby. Offered warm towel. Asked about weekend in Spanish. She calmed.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes"},
        {"days": 3, "hour": 14, "min": 0, "cat": "repetitive_behavior", "sev": "mild",
         "ante": "Unknown — likely related to organizing compulsion", "ante_cat": "unknown",
         "desc": "Hoarding napkins from dining room again. Counted 47 napkins in dresser drawer.",
         "inter": "Removed napkins without confrontation while at activity. Left 5 so drawer not empty.",
         "outcome": "resolved", "loc": "bedroom", "dur": "seconds"},
    ],
    "HARYJOHN": [
        {"days": 2, "hour": 20, "min": 0, "cat": "hallucinations", "sev": "mild",
         "ante": "Low lighting in room at dusk", "ante_cat": "environmental",
         "desc": "Talking and laughing with 'the children' in his room. Benign — pleasant and engaged.",
         "inter": "Staff checked in. He said 'the kids are playing nicely.' Staff: 'I'm glad.' No intervention needed.",
         "outcome": "resolved", "loc": "bedroom", "dur": "about_an_hour"},
        {"days": 1, "hour": 3, "min": 0, "cat": "sleep_problems", "sev": "severe",
         "ante": "REM sleep cycle — no controllable trigger", "ante_cat": "physical_state",
         "desc": "REM sleep behavior disorder. Acting out dream, fell from bed onto floor mat. Disoriented, right hip tender.",
         "inter": "Nurse assessed — no fracture, bruising on hip. Ice applied. Low bed in place. MD notified for AM review.",
         "outcome": "escalated", "loc": "bedroom", "dur": "minutes"},
        {"days": 3, "hour": 10, "min": 0, "cat": "confusion_disorientation", "sev": "moderate",
         "ante": "No trigger — typical Lewy body fluctuation", "ante_cat": "unknown",
         "desc": "Lucid at 8am (correct date and name). By 10am did not recognize room, thought he was in a barn.",
         "inter": "Oriented gently: 'This is your room, Harry, room 120.' Gave familiar blanket from home. Accepted after 20 min.",
         "outcome": "resolved", "loc": "bedroom", "dur": "minutes"},
        {"days": 0, "hour": 12, "min": 0, "cat": "hallucinations", "sev": "moderate",
         "ante": "Possible visual trigger from pattern on placemat", "ante_cat": "environmental",
         "desc": "Hallucinating insects on lunch plate. Refused to eat, tried to brush 'bugs' off table.",
         "inter": "Changed placemat to solid color. Brought new plate. Ate 75%. Note: avoid patterned placemats.",
         "outcome": "partially_resolved", "loc": "dining_room", "dur": "minutes"},
    ],
}

# Staff assignments: which CNA is primary for which patient
ASSIGNMENTS = {
    "PEGSULLY": [("Linda Reyes", "day"), ("Gabriela Moreno", "evening"), ("Rosalie Toussaint", "night")],
    "BOBYCHEN": [("Linda Reyes", "day"), ("Blessing Adeyemi", "evening"), ("Kevin Park", "night")],
    "DOTWASHN": [("Marie-Claire Beaumont", "day"), ("Blessing Adeyemi", "evening"), ("Rosalie Toussaint", "night")],
    "FRNKKOWL": [("Aisha Thompson", "day"), ("Gabriela Moreno", "evening"), ("Kevin Park", "night")],
    "MARGUTRZ": [("Aisha Thompson", "day"), ("Gabriela Moreno", "evening"), ("Rosalie Toussaint", "night")],
    "HARYJOHN": [("Marie-Claire Beaumont", "day"), ("Blessing Adeyemi", "evening"), ("Kevin Park", "night")],
}


async def seed():
    engine = get_engine()
    factory = get_session_factory(engine)

    created = {
        "b2c_codes": [],
        "facility_code": None,
        "staff_pins": [],
        "b2b_codes": [],
    }

    async with factory() as session:
        # ── Phase 0: Clean up previous demo data ──
        demo_codes = [hash_access_code(p["access_code"]) for p in B2C_PROFILES]
        demo_codes += [hash_access_code(p["access_code"]) for p in B2B_PROFILES]

        from sqlalchemy import delete, select as sa_select
        from app.models.audit_log import AuditLog

        # Find existing demo profiles
        existing_q = await session.execute(
            sa_select(Profile.id).where(Profile.access_code_hash.in_(demo_codes))
        )
        existing_ids = [r[0] for r in existing_q.all()]

        # Find existing demo facility
        existing_fac = await session.execute(
            sa_select(Facility.id).where(Facility.facility_code_hash == hash_access_code("SRSGARDN"))
        )
        fac_ids = [r[0] for r in existing_fac.all()]

        if existing_ids or fac_ids:
            print(f"Cleaning up {len(existing_ids)} existing demo profiles and {len(fac_ids)} facilities...")
            if existing_ids:
                from app.models.profile_insights import ProfileInsights
                from app.models.daily_checkin import DailyCheckin
                await session.execute(delete(BehavioralDossier).where(BehavioralDossier.profile_id.in_(existing_ids)))
                await session.execute(delete(Incident).where(Incident.profile_id.in_(existing_ids)))
                await session.execute(delete(Conversation).where(Conversation.profile_id.in_(existing_ids)))
                await session.execute(delete(ProfileInsights).where(ProfileInsights.profile_id.in_(existing_ids)))
                await session.execute(delete(DailyCheckin).where(DailyCheckin.profile_id.in_(existing_ids)))
                await session.execute(delete(StaffPatientAssignment).where(StaffPatientAssignment.profile_id.in_(existing_ids)))
                await session.execute(delete(FacilityPatientLink).where(FacilityPatientLink.profile_id.in_(existing_ids)))
                await session.execute(delete(CareChangeEvent).where(CareChangeEvent.profile_id.in_(existing_ids)))
            if fac_ids:
                await session.execute(delete(AuditLog).where(AuditLog.facility_id.in_(fac_ids)))
                await session.execute(delete(FacilityPatientLink).where(FacilityPatientLink.facility_id.in_(fac_ids)))
                await session.execute(delete(StaffPatientAssignment).where(StaffPatientAssignment.staff_id.in_(
                    sa_select(Staff.id).where(Staff.facility_id.in_(fac_ids))
                )))
                await session.execute(delete(Staff).where(Staff.facility_id.in_(fac_ids)))
                await session.execute(delete(Facility).where(Facility.id.in_(fac_ids)))
            if existing_ids:
                await session.execute(delete(Profile).where(Profile.id.in_(existing_ids)))
            await session.flush()
            print("Cleanup done.")

        # ── Phase 1: Parent entities (profiles, facility, staff) ──
        # These must be flushed before anything that references them via FK.

        b2c_profile_ids = {}
        for p in B2C_PROFILES:
            profile = Profile(
                id=str(uuid4()),
                access_code_hash=hash_access_code(p["access_code"]),
                disease_stage=p["disease_stage"],
                behavioral_patterns=encrypt(json.dumps(p["behavioral_patterns"])),
                calming_strategies=encrypt(json.dumps(p["calming_strategies"])),
                safety_concerns=encrypt(json.dumps(p["safety_concerns"])),
                previous_stage=p.get("previous_stage"),
                stage_changed_at=p.get("stage_changed_at"),
            )
            session.add(profile)
            b2c_profile_ids[p["access_code"]] = profile.id
            created["b2c_codes"].append((p["access_code"], p["disease_stage"]))

        facility = Facility(
            id=str(uuid4()),
            name=FACILITY["name"],
            facility_code_hash=hash_access_code(FACILITY["facility_code"]),
        )
        session.add(facility)
        created["facility_code"] = FACILITY["facility_code"]

        staff_ids = {}
        for s in STAFF:
            staff = Staff(
                id=str(uuid4()),
                facility_id=facility.id,
                name=s["name"],
                email=s.get("email"),
                role=s["role"],
                pin_hash=hash_pin(s["pin"]),
                password_hash=hash_password(s["password"]) if s.get("password") else None,
                language_preference=s["lang"],
            )
            session.add(staff)
            staff_ids[s["name"]] = staff.id
            created["staff_pins"].append((s["name"], s["role"], s["pin"], s.get("email", "—")))

        profile_ids = {}
        for p in B2B_PROFILES:
            profile = Profile(
                id=str(uuid4()),
                access_code_hash=hash_access_code(p["access_code"]),
                disease_stage=p["disease_stage"],
                behavioral_patterns=encrypt(json.dumps(p["behavioral_patterns"])),
                calming_strategies=encrypt(json.dumps(p["calming_strategies"])),
                safety_concerns=encrypt(json.dumps(p["safety_concerns"])),
            )
            session.add(profile)
            profile_ids[p["access_code"]] = profile.id
            created["b2b_codes"].append((p["access_code"], p.get("room", "—"), p["disease_stage"]))

        # Flush all parent entities so FKs resolve
        await session.flush()

        # ── Phase 2: Child entities (incidents, dossiers, links, assignments) ──

        for code, pid in b2c_profile_ids.items():
            session.add(BehavioralDossier(profile_id=pid, is_stale=True))
            if code in B2C_INCIDENT_DATA:
                for inc in B2C_INCIDENT_DATA[code]:
                    session.add(Incident(
                        profile_id=pid,
                        source=inc.get("source", "manual"),
                        incident_time=days_ago(inc["days"], inc["hour"], inc.get("min", 0)),
                        time_slot=time_slot_from_hour(inc["hour"]),
                        behavior_category=inc["cat"],
                        severity=inc["sev"],
                        antecedent_description=encrypt(inc["ante"]) if inc.get("ante") else None,
                        antecedent_category=inc.get("ante_cat", "unknown"),
                        behavior_description=encrypt(inc["desc"]),
                        intervention_description=encrypt(inc["inter"]) if inc.get("inter") else None,
                        intervention_outcome=inc.get("outcome"),
                        location=inc.get("loc"),
                        duration_category=inc.get("dur"),
                        caregiver_role=inc.get("role", "adult_child"),
                        extraction_confidence=inc.get("conf"),
                        recall_confidence=inc.get("recall", "high"),
                        verified_by_caregiver=inc.get("verified", False),
                    ))
            else:
                for inc_data in build_b2c_incidents(pid):
                    session.add(Incident(**inc_data))

        for p in B2B_PROFILES:
            pid = profile_ids[p["access_code"]]
            session.add(FacilityPatientLink(
                facility_id=facility.id,
                profile_id=pid,
                linked_by=staff_ids["Patricia Donnelly"],
                unit=p.get("unit"),
                room=p.get("room"),
                bed=p.get("bed"),
            ))
            session.add(BehavioralDossier(profile_id=pid, is_stale=True))

        for code, assigns in ASSIGNMENTS.items():
            pid = profile_ids[code]
            for staff_name, shift in assigns:
                sid = staff_ids[staff_name]
                session.add(StaffPatientAssignment(
                    staff_id=sid,
                    profile_id=pid,
                    facility_id=facility.id,
                    shift_pattern=shift,
                    is_primary=(shift == "day"),
                ))

        for code, incidents in INCIDENT_DATA.items():
            pid = profile_ids[code]
            for inc in incidents:
                session.add(Incident(
                    profile_id=pid,
                    facility_id=facility.id,
                    source="manual",
                    incident_time=days_ago(inc["days"], inc["hour"], inc["min"]),
                    time_slot=time_slot_from_hour(inc["hour"]),
                    behavior_category=inc["cat"],
                    severity=inc["sev"],
                    antecedent_description=encrypt(inc["ante"]),
                    antecedent_category=inc.get("ante_cat", "unknown"),
                    behavior_description=encrypt(inc["desc"]),
                    intervention_description=encrypt(inc["inter"]),
                    intervention_outcome=inc["outcome"],
                    location=inc.get("loc"),
                    duration_category=inc.get("dur"),
                    caregiver_role="paid_aide",
                ))

        # ── Phase 4: Pre-populate behavioral dossiers from demo data ──
        DOSSIER_DATA = {
            "PEGSULLY": {
                "what_not_to_do": [
                    {"description": "Don't tell her Tom has passed — escalates grief and agitation"},
                    {"description": "Don't force evening medications during sundowning peak (4-7pm)"},
                ],
                "what_works": [
                    {"intervention": "1960s folk music (Joan Baez) — calms sundowning agitation"},
                    {"intervention": "Photo album of school pictures — redirects from repetitive questioning"},
                    {"intervention": "Sorting colored buttons — provides purposeful activity"},
                    {"intervention": "Warm herbal tea with honey — settling routine before bed"},
                ],
                "escalation": "Sundowning peaks 4-7pm. Repetitive questioning about husband escalates if given factual answers. Theft accusations increase during shift changes.",
            },
            "BOBYCHEN": {
                "what_not_to_do": [
                    {"description": "Male staff must NOT assist with bathing — escalates to hitting"},
                    {"description": "Don't remove slide rule — it's his security object"},
                ],
                "what_works": [
                    {"intervention": "Female staff for personal care — prevents physical resistance"},
                    {"intervention": "Erhu music during bathing — significantly reduces agitation"},
                    {"intervention": "Warm washcloth before full bath — eases transition"},
                    {"intervention": "Holding engineering slide rule during transitions — security object"},
                ],
                "escalation": "Bathing triggers most severe episodes. Night calling (1-4am) correlates with catheter discomfort. Use simple Mandarin when agitated — doesn't respond to English.",
            },
            "DOTWASHN": {
                "what_not_to_do": [
                    {"description": "Don't assume vocalizations are 'just the dementia' — 3 of 4 severe episodes correlated with constipation. Always assess pain first (PAINAD scale)"},
                ],
                "what_works": [
                    {"intervention": "Gospel music (Amazing Grace) — reduces vocalization intensity"},
                    {"intervention": "Lavender hand massage — calming during repositioning"},
                    {"intervention": "Speaking close to right ear (better hearing)"},
                    {"intervention": "Daughter Yvonne's recorded voice message — most effective during distress"},
                ],
                "escalation": "Vocalizations correlate with constipation (3 of 4 severe episodes). Check bowel chart first when 'help me' starts. Aspiration risk — thickened liquids only.",
            },
            "FRNKKOWL": {
                "what_not_to_do": [
                    {"description": "NEVER approach from behind — PTSD startle response leads to combative episode"},
                    {"description": "NEVER corner him physically — triggers fight response"},
                    {"description": "Don't open room door abruptly at night"},
                ],
                "what_works": [
                    {"intervention": "Walk WITH him to the door, then redirect to snack area"},
                    {"intervention": "Male staff for redirection — responds better"},
                    {"intervention": "Let him watch food being prepared — resolves food refusal"},
                    {"intervention": "Calm low tones, approach from front — prevents startle"},
                    {"intervention": "Talk about his police career — effective redirect from exit-seeking"},
                ],
                "escalation": "Exit-seeking peaks after 3pm. PTSD startle at night if approached suddenly. Paranoid ideation about food increases when unfamiliar staff serve meals. Check nightstand daily for hoarded utensils.",
            },
            "MARGUTRZ": {
                "what_not_to_do": [
                    {"description": "Don't confront hoarding directly — triggers aggression"},
                    {"description": "Don't change her routine without warning"},
                    {"description": "Don't speak English-only when she's distressed — reverts to Spanish"},
                ],
                "what_works": [
                    {"intervention": "Give towels to fold or silverware to sort — purposeful activity"},
                    {"intervention": "Spanish conversation about cooking — calming and engaging"},
                    {"intervention": "Strict daily schedule in Spanish"},
                    {"intervention": "Help set tables before meals — channels organizing behavior"},
                ],
                "escalation": "Monday agitation spikes 2.3x after weekend family visits. Spanish-speaking CNA on Monday mornings prevents most episodes. Kitchen access is a safety risk (hot surfaces).",
            },
            "HARYJOHN": {
                "what_not_to_do": [
                    {"description": "NEVER give haloperidol or other antipsychotics — Lewy body patients have severe neuroleptic sensitivity (potentially fatal)"},
                    {"description": "Don't use patterned placemats — trigger visual hallucinations"},
                ],
                "what_works": [
                    {"intervention": "Don't contradict hallucinations — ask what the children are doing"},
                    {"intervention": "Schedule important decisions for morning hours (lucid period)"},
                    {"intervention": "Bed alarm + low bed + floor mat — fall prevention for REM sleep disorder"},
                    {"intervention": "Count 1-2-3 for movement initiation — helps with Parkinsonian freezing"},
                ],
                "escalation": "Fluctuating cognition: lucid mornings, confused afternoons. REM sleep behavior disorder causes falls at night. HIGH FALL RISK. Orthostatic hypotension — must stand slowly.",
            },
            "HELENCH3": {
                "what_not_to_do": [
                    {"description": "Do NOT use lavender products — allergic reaction", "count": 1},
                    {"description": "Do NOT tell her mother has passed — causes grief spiral each time", "count": 8},
                    {"description": "Do NOT give thin liquids — choking risk, use nectar-thick", "count": 1},
                    {"description": "Do NOT force morning showers — escalates to physical resistance", "count": 5},
                    {"description": "Do NOT introduce new caregivers without daughter present — triggers severe rejection", "count": 3},
                    {"description": "Do NOT discuss moving to memory care in her presence — triggers severe aggression", "count": 1},
                ],
                "what_works": [
                    {"intervention": "Cantonese opera playlist on tablet — primary calming tool", "count": 18},
                    {"intervention": "Jasmine tea with two sugars — settling ritual", "count": 22},
                    {"intervention": "Towel/napkin folding — redirects from agitation to purposeful activity", "count": 12},
                    {"intervention": "Dim sum family photos on iPad — redirects from confusion", "count": 9},
                    {"intervention": "Garden walk near rose bushes — de-escalation for exit-seeking", "count": 7},
                    {"intervention": "Mahjong tile sorting — extended calm activity for afternoons", "count": 6},
                    {"intervention": "Hair brushing — calming bedtime routine", "count": 8},
                    {"intervention": "Daughter Michelle's voice on speaker phone — most effective in crisis", "count": 5},
                    {"intervention": "Therapeutic fib about mother: 'Mama called, she loves you'", "count": 4},
                    {"intervention": "Medication in apple juice (better than applesauce)", "count": 3},
                ],
                "escalation": "DELIRIUM PATTERN: 2 UTI episodes caused sudden behavioral spikes (days 180 and 12). Current week shows elevated frequency — screen for UTI. PAIN PATTERN: grimacing and guarding right hip after fall (day 10). Stage transitioned early→middle 4 months ago — sundowning and wandering significantly worsened. Exit-seeking peaks after phone calls with siblings. Monday agitation not observed (no facility pattern). Reverts to Cantonese-only when severely distressed — ensure Cantonese-speaking support available.",
            },
        }

        # ── Phase 4b: Care Change Events for Helen Chen ──
        helen_pid = b2c_profile_ids.get("HELENCH3")
        if helen_pid:
            care_changes = [
                CareChangeEvent(
                    profile_id=helen_pid,
                    description="Medication: switched from pill to liquid after finding hidden pills in tissue box",
                    change_date=(NOW - timedelta(days=195)).date(),
                    observation_window_days=14,
                    is_active=False,
                ),
                CareChangeEvent(
                    profile_id=helen_pid,
                    description="Environment: door alarms installed on front and back doors after elopement incident",
                    change_date=(NOW - timedelta(days=179)).date(),
                    observation_window_days=30,
                    is_active=False,
                ),
                CareChangeEvent(
                    profile_id=helen_pid,
                    description="Stage transition: early to middle — significant increase in sundowning and wandering",
                    change_date=(NOW - timedelta(days=120)).date(),
                    observation_window_days=30,
                    is_active=False,
                ),
                CareChangeEvent(
                    profile_id=helen_pid,
                    description="Caregiver: new paid aide started — took 3 visits with daughter present for acceptance",
                    change_date=(NOW - timedelta(days=90)).date(),
                    observation_window_days=21,
                    is_active=False,
                ),
                CareChangeEvent(
                    profile_id=helen_pid,
                    description="Medication: started antibiotics for UTI — behavioral spike expected during treatment",
                    change_date=(NOW - timedelta(days=12)).date(),
                    observation_window_days=14,
                    is_active=True,
                ),
            ]
            for cc in care_changes:
                session.add(cc)

        for code, dossier_data in DOSSIER_DATA.items():
            code_hash = hash_access_code(code)
            result = await session.execute(
                sa_select(Profile.id).where(Profile.access_code_hash == code_hash)
            )
            row = result.first()
            if not row:
                continue
            pid = row[0]

            # Delete any existing dossier for this profile
            await session.execute(
                delete(BehavioralDossier).where(BehavioralDossier.profile_id == pid)
            )

            dossier = BehavioralDossier(
                id=str(uuid4()),
                profile_id=pid,
                is_stale=False,
                version=1,
                contraindicated_json=encrypt(json.dumps(dossier_data["what_not_to_do"])),
                effective_json=encrypt(json.dumps(dossier_data["what_works"])),
                escalation_pattern=encrypt(dossier_data.get("escalation", "")),
                computed_at=datetime.now(timezone.utc),
            )
            session.add(dossier)

        await session.commit()

    # ── Print summary ──
    print("\n" + "=" * 60)
    print("  CALMGUIDE DEMO DATA SEEDED SUCCESSFULLY")
    print("  All data is fictional — for demonstration only.")
    print("=" * 60)

    print("\n── B2C Family Caregiver Profiles ──")
    for code, stage in created["b2c_codes"]:
        print(f"  Access Code: {code}  |  Stage: {stage}")

    print(f"\n── B2B Facility ──")
    print(f"  Name: {FACILITY['name']}")
    print(f"  Facility Code: {created['facility_code']}")

    print(f"\n── B2B Staff (use PIN on shared tablet, email+password for admin) ──")
    print(f"  {'Name':<25} {'Role':<8} {'PIN':<6} {'Email'}")
    print(f"  {'─'*25} {'─'*8} {'─'*6} {'─'*35}")
    for name, role, pin, email in created["staff_pins"]:
        print(f"  {name:<25} {role:<8} {pin:<6} {email}")

    print(f"\n── B2B Patient Profiles (linked to facility) ──")
    print(f"  {'Access Code':<10} {'Room':<6} {'Stage'}")
    print(f"  {'─'*10} {'─'*6} {'─'*8}")
    for code, room, stage in created["b2b_codes"]:
        print(f"  {code:<10} {room:<6} {stage}")

    print(f"\n  Total: {len(created['b2c_codes'])} B2C profiles, {len(created['b2b_codes'])} B2B profiles,")
    print(f"         {len(created['staff_pins'])} staff, {sum(len(v) for v in INCIDENT_DATA.values())} B2B incidents,")
    print(f"         {len(B2C_PROFILES) * 4} B2C incidents")
    print(f"\n  Behavioral dossiers are stale — they will be computed on first Moment Coach request.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())
