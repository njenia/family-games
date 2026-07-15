window.EXERCISES_CONFIG = {
  "title": "Gabby's Physio Adventure",
  "celebrationMs": 8000,
  "betweenSeconds": 8,
  "defaults": {
    "reps": 10,
    "workSeconds": 5,
    "restSeconds": 4
  },
  "exercises": [
    {
      "id": "elbow-bending",
      "name": "Elbow Bending",
      "hint": "Hold forearm folded up to your shoulder, then hold it stretched down fully open. That is one rep.",
      "emoji": "💪",
      "picture": null,
      "mode": "dual",
      "reps": 10,
      "restSeconds": 0,
      "phases": [
        {
          "label": "Hold Up",
          "seconds": 5,
          "video": "video/elbow-bending up.mov"
        },
        {
          "label": "Hold Down",
          "seconds": 5,
          "video": "video/elbow-bending down.mov"
        }
      ]
    },
    {
      "id": "wrist-bend-down",
      "name": "Wrist Bend Down",
      "hint": "Hand on table or pillow, wrist hanging off the edge. Bend your closed hand down.",
      "emoji": "⬇️",
      "picture": null,
      "mode": "timed",
      "reps": 10,
      "workSeconds": 5,
      "restSeconds": 4,
      "videos": {
        "work": "video/wrist-bend-down work.mov",
        "rest": "video/wrist-bend-down rest.mov"
      }
    },
    {
      "id": "wrist-bend-up",
      "name": "Wrist Bend Up",
      "hint": "Hand on table or pillow, wrist hanging off the edge. Bend your closed hand upwards.",
      "emoji": "⬆️",
      "picture": null,
      "mode": "timed",
      "reps": 10,
      "workSeconds": 5,
      "restSeconds": 4,
      "videos": {
        "work": "video/wrist-bend-up work.mov",
        "rest": "video/wrist-bend-up rest.mov"
      }
    },
    {
      "id": "thumb-slide",
      "name": "Thumb Slide",
      "hint": "Palm on the table. Slide your thumb away from your hand.",
      "emoji": "👍",
      "picture": null,
      "mode": "timed",
      "reps": 10,
      "workSeconds": 5,
      "restSeconds": 4,
      "videos": {
        "work": "video/thumb-slide work.mov",
        "rest": "video/thumb-slide rest.mov"
      }
    },
    {
      "id": "ulnar-deviation",
      "name": "Bend Toward Little Finger",
      "hint": "Bend your hand toward your little finger.",
      "emoji": "👈",
      "picture": null,
      "mode": "timed",
      "reps": 10,
      "workSeconds": 5,
      "restSeconds": 4,
      "videos": {
        "work": "video/ulnar-deviation work.mov",
        "rest": "video/ulnar-deviation rest.mov"
      }
    },
    {
      "id": "thumb-to-pinky",
      "name": "Thumb to Little Finger",
      "hint": "Touch your thumb to the base of your little finger.",
      "emoji": "🤞",
      "picture": null,
      "mode": "timed",
      "reps": 10,
      "workSeconds": 5,
      "restSeconds": 4,
      "videos": {
        "work": "video/thumb-to-pinky work.mov",
        "rest": "video/thumb-to-pinky rest.mov"
      }
    },
    {
      "id": "thumb-l",
      "name": "Cup Hold",
      "hint": "Move your thumb away from your hand to form an \"L\" — like holding a cup.",
      "emoji": "🤟",
      "picture": null,
      "mode": "timed",
      "reps": 10,
      "workSeconds": 5,
      "restSeconds": 4,
      "videos": {
        "work": "video/cup-hold work.mov",
        "rest": "video/cup-hold rest.mov"
      }
    },
    {
      "id": "thumb-circles",
      "name": "Thumb Circles",
      "hint": "Make large circles with your thumb — clockwise, then counter-clockwise. Two sets.",
      "emoji": "🔄",
      "picture": null,
      "mode": "dual",
      "reps": 2,
      "restSeconds": 0,
      "phases": [
        {
          "label": "Clockwise",
          "seconds": 10,
          "video": "video/thumb-circles clockwise.mov"
        },
        {
          "label": "Counter-clockwise",
          "seconds": 10,
          "video": "video/thumb-circles counterclockwise.mov"
        }
      ]
    },
    {
      "id": "fist-and-open",
      "name": "Fist & Open",
      "hint": "Make a fist and hold, then open with straight fingers and hold. That is one rep.",
      "emoji": "✊",
      "picture": null,
      "mode": "dual",
      "reps": 10,
      "restSeconds": 0,
      "phases": [
        {
          "label": "Fist",
          "seconds": 5,
          "video": "video/fist-and-open close.mov"
        },
        {
          "label": "Open",
          "seconds": 5,
          "video": "video/fist-and-open open.mov"
        }
      ]
    },
    {
      "id": "finger-spread",
      "name": "Finger Spread & Squeeze",
      "hint": "Spread fingers apart and hold, then squeeze them together and hold. That is one rep.",
      "emoji": "🖐️",
      "picture": null,
      "mode": "dual",
      "reps": 10,
      "restSeconds": 0,
      "phases": [
        {
          "label": "Spread",
          "seconds": 5,
          "video": "video/finger-spread spread.mov"
        },
        {
          "label": "Squeeze",
          "seconds": 5,
          "video": "video/finger-spread close.mov"
        }
      ]
    }
  ]
};
