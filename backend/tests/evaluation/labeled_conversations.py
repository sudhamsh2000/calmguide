"""Manually labeled conversations for extraction evaluation.

Each entry contains conversation messages and the expected extraction output.
Target: 50-100 labeled conversations for statistically meaningful F1 scores.
Start with 10 seed examples covering the main behavior categories.

F1 targets per field (from spec Section 4.7):
  - behavior_category: >= 0.80
  - antecedent: >= 0.65
  - intervention: >= 0.70
  - outcome: >= 0.75
"""

LABELED_CONVERSATIONS = [
    {
        "id": "eval_001",
        "description": "Nighttime wandering resolved with music",
        "messages": [
            {
                "role": "user",
                "content": "Mom keeps trying to leave at 2am. She's very confused and keeps saying she needs to go to work.",
            },
            {
                "role": "assistant",
                "content": "I understand this is frightening. Let me help you through this right now.",
            },
            {
                "role": "user",
                "content": "I played Sinatra and she calmed down after about 10 minutes.",
            },
            {"role": "assistant", "content": "That's wonderful that the music worked."},
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["sundowning", "wandering"],
            "calming_strategies": ["Sinatra music", "warm milk"],
        },
        "patient_name": "Mom",
        "expected": {
            "behavior_category": "wandering_exit_seeking",
            "severity": "moderate",
            "antecedent_category": "physical_state",
            "behavior_description_contains": "leave",
            "intervention_outcome": "resolved",
        },
    },
    {
        "id": "eval_002",
        "description": "Aggression during bathing",
        "messages": [
            {
                "role": "user",
                "content": "Dad hit me when I tried to help him shower. He looks scared and angry.",
            },
            {
                "role": "assistant",
                "content": "Your safety comes first. Step back and give him space.",
            },
            {
                "role": "user",
                "content": "I backed off and tried warm towels first. He eventually let me help.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["aggression during care"],
            "calming_strategies": ["warm towels", "gentle music"],
        },
        "patient_name": "Dad",
        "expected": {
            "behavior_category": "aggression_anger",
            "severity": "severe",
            "antecedent_category": "task_demand",
            "intervention_outcome": "partially_resolved",
        },
    },
    {
        "id": "eval_003",
        "description": "Refusing medication",
        "messages": [
            {
                "role": "user",
                "content": "She won't take her evening pills. She keeps pushing the cup away and saying I'm trying to poison her.",
            },
            {"role": "assistant", "content": "I understand how frustrating this must be."},
            {
                "role": "user",
                "content": "I tried crushing them in applesauce but she still refuses.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["paranoia", "refusing medication"],
            "calming_strategies": ["tea", "distraction"],
        },
        "patient_name": "Margaret",
        "expected": {
            "behavior_category": "refusing_care",
            "severity": "moderate",
            "antecedent_category": "task_demand",
            "intervention_outcome": "unresolved",
        },
    },
    {
        "id": "eval_004",
        "description": "Repetitive questioning",
        "messages": [
            {
                "role": "user",
                "content": "She keeps asking when her mother is coming. I've told her a hundred times her mother passed away years ago.",
            },
            {
                "role": "assistant",
                "content": "I know this is exhausting. The key is to avoid correcting her.",
            },
            {
                "role": "user",
                "content": "I tried redirecting to her photo album and that distracted her for a while.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["repetitive questions"],
            "calming_strategies": ["photo album", "reminiscence"],
        },
        "patient_name": "Mom",
        "expected": {
            "behavior_category": "repetitive_behavior",
            "severity": "mild",
            "antecedent_category": "unknown",
            "intervention_outcome": "partially_resolved",
        },
    },
    {
        "id": "eval_005",
        "description": "Sundowning with hallucinations",
        "messages": [
            {
                "role": "user",
                "content": "It's 7pm and Dad is seeing people in the room who aren't there. He's getting agitated and won't sit down.",
            },
            {
                "role": "assistant",
                "content": "Visual hallucinations can be very distressing for both of you.",
            },
            {
                "role": "user",
                "content": "I turned up the lights and put on his favorite TV show. He finally sat down.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["sundowning", "hallucinations"],
            "calming_strategies": ["bright lighting", "familiar TV shows"],
        },
        "patient_name": "Dad",
        "expected": {
            "behavior_category": "hallucinations",
            "severity": "moderate",
            "antecedent_category": "environmental",
            "intervention_outcome": "resolved",
        },
    },
    {
        "id": "eval_006",
        "description": "Sleep disturbance - up all night",
        "messages": [
            {
                "role": "user",
                "content": "Mom has been up since 1am. She's pacing around the house and rearranging furniture. I can't get her back to bed.",
            },
            {
                "role": "assistant",
                "content": "Nighttime wakefulness is very common in middle-stage dementia.",
            },
            {
                "role": "user",
                "content": "I gave her warm milk and sat with her. She fell asleep on the couch around 3am.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["sleep disruption", "pacing"],
            "calming_strategies": ["warm milk", "sitting together"],
        },
        "patient_name": "Mom",
        "expected": {
            "behavior_category": "sleep_problems",
            "severity": "moderate",
            "duration_category": "longer",
            "intervention_outcome": "resolved",
        },
    },
    {
        "id": "eval_007",
        "description": "Confusion and disorientation",
        "messages": [
            {
                "role": "user",
                "content": "Dad doesn't know where he is. He keeps asking to go home even though he IS home. He's very upset.",
            },
            {"role": "assistant", "content": "This is a very common experience in dementia."},
            {
                "role": "user",
                "content": "I showed him family photos and he seemed to settle a bit.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["confusion", "wanting to go home"],
            "calming_strategies": ["family photos", "reassurance"],
        },
        "patient_name": "Dad",
        "expected": {
            "behavior_category": "confusion_disorientation",
            "severity": "moderate",
            "antecedent_category": "unknown",
            "intervention_outcome": "partially_resolved",
        },
    },
    {
        "id": "eval_008",
        "description": "Aggression escalated to ER",
        "messages": [
            {
                "role": "user",
                "content": "Mom threw a plate at me during dinner. She's been escalating all day.",
            },
            {"role": "assistant", "content": "Your safety is the priority right now."},
            {
                "role": "user",
                "content": "I had to call the ambulance. She was completely out of control. Nothing I tried worked.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["aggression", "property damage"],
            "calming_strategies": ["music", "quiet space"],
        },
        "patient_name": "Mom",
        "expected": {
            "behavior_category": "aggression_anger",
            "severity": "severe",
            "intervention_outcome": "escalated",
        },
    },
    {
        "id": "eval_009",
        "description": "Mild repetitive behavior quickly resolved",
        "messages": [
            {
                "role": "user",
                "content": "Dad keeps picking at his clothes and folding the same napkin over and over.",
            },
            {
                "role": "assistant",
                "content": "Repetitive actions can be soothing for some patients.",
            },
            {
                "role": "user",
                "content": "I gave him a basket of towels to fold and he seems content now.",
            },
        ],
        "profile": {
            "disease_stage": "late",
            "behavioral_patterns": ["repetitive actions"],
            "calming_strategies": ["purposeful tasks", "sorting activities"],
        },
        "patient_name": "Dad",
        "expected": {
            "behavior_category": "repetitive_behavior",
            "severity": "mild",
            "antecedent_category": "unknown",
            "intervention_outcome": "resolved",
        },
    },
    {
        "id": "eval_010",
        "description": "Wandering with no resolution",
        "messages": [
            {
                "role": "user",
                "content": "She's been trying to leave through every door for the past hour. I've redirected her 5 times but she keeps going back.",
            },
            {"role": "assistant", "content": "Persistent exit-seeking can be very challenging."},
            {
                "role": "user",
                "content": "Nothing is working. Music didn't help, snacks didn't help. She's still at it.",
            },
        ],
        "profile": {
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering", "exit-seeking"],
            "calming_strategies": ["music", "snacks", "walks"],
        },
        "patient_name": "Mom",
        "expected": {
            "behavior_category": "wandering_exit_seeking",
            "severity": "moderate",
            "duration_category": "about_an_hour",
            "intervention_outcome": "unresolved",
        },
    },
]
