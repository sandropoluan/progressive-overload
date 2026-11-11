#!/usr/bin/env node
/**
 * Generates src/data/presets.ts, src/data/instructions.ts and public/exercises/<id>/{start,end}.webp.
 *
 * Illustrations: open-exercise-illustrations (CC0) https://github.com/hitmanrepo/open-exercise-illustrations
 * Instructions:  free-exercise-db (public domain)   https://github.com/yuhonas/free-exercise-db
 *
 * Usage:  node scripts/build-exercises.mjs [--skip-images]
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OEI = 'https://raw.githubusercontent.com/hitmanrepo/open-exercise-illustrations/main/'
const FED = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
// Portrait/square renders are scaled to 480px tall; the wide lying-down renders (3:1) to 320px tall.
const IMG_HEIGHT = 480
const WIDE_HEIGHT = 320
const WIDE_RATIO = 1.6
const WEBP_QUALITY = 70

// [id, name, muscle group, equipment, repMin, repMax, sets, illustration id, instructions id | null]
// Rep ranges: heavy barbell compounds 5–8 / 6–10, machine & dumbbell compounds 8–12,
// isolation 10–15, calves / abs / small muscles 12–20, olympic lifts 3–5.
const C = [
  // ---- Chest ----
  ['bench-press', 'Bench Press', 'Chest', 'Barbell', 6, 10, 4, 'bench-press', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['incline-bench-press', 'Incline Bench Press', 'Chest', 'Barbell', 6, 10, 4, 'incline-bench-press', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['decline-bench-press', 'Decline Bench Press', 'Chest', 'Barbell', 6, 10, 3, 'decline-bench-press', 'Decline_Barbell_Bench_Press'],
  ['wide-grip-bench-press', 'Wide-Grip Bench Press', 'Chest', 'Barbell', 6, 10, 3, 'wide-grip-bench-press', 'Wide-Grip_Barbell_Bench_Press'],
  ['db-bench-press', 'Dumbbell Bench Press', 'Chest', 'Dumbbell', 8, 12, 3, 'dumbbell-chest-press', 'Dumbbell_Bench_Press'],
  ['incline-db-press', 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 8, 12, 3, 'incline-dumbbell-press', 'Incline_Dumbbell_Press'],
  ['decline-db-press', 'Decline Dumbbell Press', 'Chest', 'Dumbbell', 8, 12, 3, 'dumbbell-decline-press', 'Decline_Dumbbell_Bench_Press'],
  ['db-floor-press', 'Dumbbell Floor Press', 'Chest', 'Dumbbell', 8, 12, 3, 'dumbbell-floor-press', 'Dumbbell_Floor_Press'],
  ['db-fly', 'Dumbbell Fly', 'Chest', 'Dumbbell', 10, 15, 3, 'dumbbell-fly', 'Dumbbell_Flyes'],
  ['incline-db-fly', 'Incline Dumbbell Fly', 'Chest', 'Dumbbell', 10, 15, 3, 'incline-dumbbell-fly', 'Incline_Dumbbell_Flyes'],
  ['db-pullover', 'Dumbbell Pullover', 'Chest', 'Dumbbell', 10, 15, 3, 'dumbbell-pullover', 'Straight-Arm_Dumbbell_Pullover'],
  ['chest-press-machine', 'Chest Press Machine', 'Chest', 'Machine', 8, 12, 3, 'chest-press-machine', 'Machine_Bench_Press'],
  ['incline-chest-press-machine', 'Incline Chest Press Machine', 'Chest', 'Machine', 8, 12, 3, 'plate-loaded-incline-chest-press', 'Leverage_Incline_Chest_Press'],
  ['decline-chest-press-machine', 'Decline Chest Press Machine', 'Chest', 'Machine', 8, 12, 3, 'chest-press-machine', 'Leverage_Decline_Chest_Press'],
  ['pec-deck', 'Pec Deck / Chest Fly Machine', 'Chest', 'Machine', 10, 15, 3, 'pec-deck', 'Butterfly'],
  ['cable-fly', 'Cable Crossover', 'Chest', 'Cable', 10, 15, 3, 'cable-crossover', 'Cable_Crossover'],
  ['low-cable-fly', 'Low-to-High Cable Fly', 'Chest', 'Cable', 10, 15, 3, 'cable-fly-low-to-high', 'Low_Cable_Crossover'],
  ['high-cable-fly', 'High-to-Low Cable Fly', 'Chest', 'Cable', 10, 15, 3, 'cable-fly-high-to-low', null],
  ['incline-cable-fly', 'Incline Cable Fly', 'Chest', 'Cable', 10, 15, 3, 'cable-fly-low-to-high', 'Incline_Cable_Flye'],
  ['cable-chest-press', 'Cable Chest Press', 'Chest', 'Cable', 10, 15, 3, 'standing-cable-chest-press', 'Standing_Cable_Chest_Press'],
  ['smith-bench-press', 'Smith Machine Bench Press', 'Chest', 'Smith', 8, 12, 3, 'smith-machine-bench-press', 'Smith_Machine_Bench_Press'],
  ['smith-incline-press', 'Smith Machine Incline Press', 'Chest', 'Smith', 8, 12, 3, 'smith-machine-incline-press', 'Smith_Machine_Incline_Bench_Press'],
  ['push-up', 'Push-Up', 'Chest', 'Bodyweight', 10, 20, 3, 'push-up', 'Pushups'],
  ['wide-push-up', 'Wide Push-Up', 'Chest', 'Bodyweight', 10, 20, 3, 'wide-push-up', 'Push-Up_Wide'],
  ['decline-push-up', 'Decline Push-Up', 'Chest', 'Bodyweight', 8, 15, 3, 'decline-push-up', 'Push-Ups_With_Feet_Elevated'],
  ['chest-dip', 'Chest Dips', 'Chest', 'Bodyweight', 8, 12, 3, 'dips', 'Dips_-_Chest_Version'],
  // ---- Back ----
  ['deadlift', 'Deadlift', 'Back', 'Barbell', 5, 8, 3, 'deadlift', 'Barbell_Deadlift'],
  ['sumo-deadlift', 'Sumo Deadlift', 'Back', 'Barbell', 5, 8, 3, 'sumo-deadlift', 'Sumo_Deadlift'],
  ['trap-bar-deadlift', 'Trap Bar Deadlift', 'Back', 'Barbell', 6, 10, 3, 'trap-bar-deadlift', 'Trap_Bar_Deadlift'],
  ['rack-pull', 'Rack Pull', 'Back', 'Barbell', 5, 8, 3, 'rack-pull', 'Rack_Pulls'],
  ['barbell-row', 'Barbell Row', 'Back', 'Barbell', 6, 10, 4, 'bent-over-row', 'Bent_Over_Barbell_Row'],
  ['pendlay-row', 'Pendlay Row', 'Back', 'Barbell', 5, 8, 4, 'pendlay-row', null],
  ['reverse-grip-row', 'Reverse Grip Barbell Row', 'Back', 'Barbell', 8, 12, 3, 'reverse-grip-barbell-row', 'Reverse_Grip_Bent-Over_Rows'],
  ['t-bar-row', 'T-Bar Row', 'Back', 'Barbell', 8, 12, 3, 't-bar-row', 'T-Bar_Row_with_Handle'],
  ['chest-supported-t-bar-row', 'Chest-Supported T-Bar Row', 'Back', 'Machine', 8, 12, 3, 'chest-supported-t-bar-row', 'Lying_T-Bar_Row'],
  ['db-row', 'One-Arm Dumbbell Row', 'Back', 'Dumbbell', 8, 12, 3, 'dumbbell-row', 'One-Arm_Dumbbell_Row'],
  ['chest-supported-db-row', 'Chest-Supported Dumbbell Row', 'Back', 'Dumbbell', 8, 12, 3, 'chest-supported-dumbbell-row', 'Dumbbell_Incline_Row'],
  ['lat-pulldown', 'Lat Pulldown', 'Back', 'Cable', 8, 12, 3, 'lat-pulldown', 'Wide-Grip_Lat_Pulldown'],
  ['close-grip-pulldown', 'Close-Grip Lat Pulldown', 'Back', 'Cable', 8, 12, 3, 'close-grip-lat-pulldown', 'Close-Grip_Front_Lat_Pulldown'],
  ['v-bar-pulldown', 'V-Bar Pulldown', 'Back', 'Cable', 8, 12, 3, 'close-grip-lat-pulldown', 'V-Bar_Pulldown'],
  ['single-arm-pulldown', 'One-Arm Lat Pulldown', 'Back', 'Cable', 10, 12, 3, 'lat-pulldown', 'One_Arm_Lat_Pulldown'],
  ['underhand-pulldown', 'Underhand Pulldown', 'Back', 'Cable', 8, 12, 3, 'reverse-grip-lat-pulldown', 'Underhand_Cable_Pulldowns'],
  ['straight-arm-pulldown', 'Straight-Arm Pulldown', 'Back', 'Cable', 12, 15, 3, 'straight-arm-pulldown', 'Straight-Arm_Pulldown'],
  ['seated-cable-row', 'Seated Cable Row', 'Back', 'Cable', 8, 12, 3, 'seated-cable-row', 'Seated_Cable_Rows'],
  ['one-arm-cable-row', 'One-Arm Cable Row', 'Back', 'Cable', 10, 12, 3, 'single-arm-cable-row', 'Seated_One-arm_Cable_Pulley_Rows'],
  ['row-machine', 'Row Machine', 'Back', 'Machine', 8, 12, 3, 'machine-row', 'Leverage_Iso_Row'],
  ['high-row-machine', 'High Row Machine', 'Back', 'Machine', 8, 12, 3, 'machine-high-row', 'Leverage_High_Row'],
  ['pullover-machine', 'Pullover Machine', 'Back', 'Machine', 10, 15, 3, 'machine-pullover', null],
  ['smith-row', 'Smith Machine Row', 'Back', 'Smith', 8, 12, 3, 'smith-machine-bent-over-row', 'Smith_Machine_Bent_Over_Row'],
  ['pull-up', 'Pull-Up', 'Back', 'Bodyweight', 6, 12, 3, 'pull-up', 'Pullups'],
  ['wide-grip-pull-up', 'Wide-Grip Pull-Up', 'Back', 'Bodyweight', 5, 10, 3, 'wide-grip-pull-up', null],
  ['neutral-grip-pull-up', 'Neutral-Grip Pull-Up', 'Back', 'Bodyweight', 6, 12, 3, 'neutral-grip-pull-up', 'V-Bar_Pullup'],
  ['chin-up', 'Chin-Up', 'Back', 'Bodyweight', 6, 12, 3, 'chin-up', 'Chin-Up'],
  ['weighted-pull-up', 'Weighted Pull-Up', 'Back', 'Bodyweight', 5, 8, 3, 'pull-up', 'Weighted_Pull_Ups'],
  ['assisted-pull-up', 'Assisted Pull-Up Machine', 'Back', 'Machine', 8, 12, 3, 'assisted-pull-up', null],
  ['inverted-row', 'Inverted Row', 'Back', 'Bodyweight', 8, 15, 3, 'inverted-row', 'Inverted_Row_with_Straps'],
  ['back-extension', 'Back Extension', 'Back', 'Bodyweight', 12, 15, 3, 'back-extensions', 'Hyperextensions_Back_Extensions'],
  ['good-morning', 'Good Morning', 'Back', 'Barbell', 8, 12, 3, 'good-morning', 'Good_Morning'],
  ['barbell-shrug', 'Barbell Shrug', 'Back', 'Barbell', 10, 15, 3, 'shrugs', 'Barbell_Shrug'],
  ['db-shrug', 'Dumbbell Shrug', 'Back', 'Dumbbell', 10, 15, 3, 'dumbbell-shrug', 'Dumbbell_Shrug'],
  ['smith-shrug', 'Smith Machine Shrug', 'Back', 'Smith', 10, 15, 3, 'smith-machine-shrug', null],
  ['shrug-machine', 'Shrug Machine', 'Back', 'Machine', 10, 15, 3, 'smith-machine-shrug', 'Leverage_Shrug'],
  // ---- Shoulders ----
  ['overhead-press', 'Overhead Press', 'Shoulders', 'Barbell', 6, 10, 4, 'overhead-press', 'Standing_Military_Press'],
  ['seated-barbell-press', 'Seated Barbell Press', 'Shoulders', 'Barbell', 6, 10, 3, 'overhead-press', 'Seated_Barbell_Military_Press'],
  ['push-press', 'Push Press', 'Shoulders', 'Barbell', 5, 8, 3, 'push-press', 'Push_Press'],
  ['landmine-press', 'Landmine Press', 'Shoulders', 'Barbell', 8, 12, 3, 'landmine-press', null],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 8, 12, 3, 'dumbbell-shoulder-press', 'Seated_Dumbbell_Press'],
  ['standing-db-press', 'Standing Dumbbell Press', 'Shoulders', 'Dumbbell', 8, 12, 3, 'dumbbell-push-press', 'Standing_Dumbbell_Press'],
  ['arnold-press', 'Arnold Press', 'Shoulders', 'Dumbbell', 8, 12, 3, 'arnold-press', 'Arnold_Dumbbell_Press'],
  ['shoulder-press-machine', 'Shoulder Press Machine', 'Shoulders', 'Machine', 8, 12, 3, 'shoulder-press-machine', 'Machine_Shoulder_Military_Press'],
  ['smith-shoulder-press', 'Smith Machine Shoulder Press', 'Shoulders', 'Smith', 8, 12, 3, 'smith-machine-overhead-press', 'Smith_Machine_Overhead_Shoulder_Press'],
  ['lateral-raise', 'Lateral Raise', 'Shoulders', 'Dumbbell', 12, 20, 3, 'lateral-raises', 'Side_Lateral_Raise'],
  ['seated-lateral-raise', 'Seated Lateral Raise', 'Shoulders', 'Dumbbell', 12, 20, 3, 'lateral-raises', 'Seated_Side_Lateral_Raise'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'Shoulders', 'Cable', 12, 20, 3, 'cable-lateral-raise', 'Standing_Low-Pulley_Deltoid_Raise'],
  ['lateral-raise-machine', 'Lateral Raise Machine', 'Shoulders', 'Machine', 12, 20, 3, 'machine-lateral-raise', null],
  ['front-raise', 'Front Raise', 'Shoulders', 'Dumbbell', 10, 15, 3, 'front-raises', 'Front_Dumbbell_Raise'],
  ['plate-front-raise', 'Plate Front Raise', 'Shoulders', 'Barbell', 10, 15, 3, 'plate-front-raise', 'Front_Plate_Raise'],
  ['cable-front-raise', 'Cable Front Raise', 'Shoulders', 'Cable', 10, 15, 3, 'cable-front-raise', 'Front_Cable_Raise'],
  ['face-pull', 'Face Pull', 'Shoulders', 'Cable', 12, 20, 3, 'face-pulls', 'Face_Pull'],
  ['rear-delt-fly', 'Reverse Pec Deck', 'Shoulders', 'Machine', 12, 20, 3, 'reverse-pec-deck', 'Reverse_Machine_Flyes'],
  ['db-rear-delt-fly', 'Bent-Over Rear Delt Fly', 'Shoulders', 'Dumbbell', 12, 20, 3, 'rear-delt-fly', 'Reverse_Flyes'],
  ['cable-rear-delt-fly', 'Cable Rear Delt Fly', 'Shoulders', 'Cable', 12, 20, 3, 'rear-delt-fly', 'Cable_Rear_Delt_Fly'],
  ['upright-row', 'Upright Row', 'Shoulders', 'Barbell', 8, 12, 3, 'upright-row', 'Upright_Barbell_Row'],
  ['db-upright-row', 'Dumbbell Upright Row', 'Shoulders', 'Dumbbell', 10, 15, 3, 'dumbbell-upright-row', 'Standing_Dumbbell_Upright_Row'],
  ['cable-upright-row', 'Cable Upright Row', 'Shoulders', 'Cable', 10, 15, 3, 'cable-upright-row', 'Upright_Cable_Row'],
  // ---- Biceps ----
  ['barbell-curl', 'Barbell Curl', 'Biceps', 'Barbell', 8, 12, 3, 'barbell-curl', 'Barbell_Curl'],
  ['ez-bar-curl', 'EZ-Bar Curl', 'Biceps', 'Barbell', 8, 12, 3, 'ez-bar-curl', 'EZ-Bar_Curl'],
  ['db-curl', 'Dumbbell Curl', 'Biceps', 'Dumbbell', 8, 12, 3, 'biceps-curl', 'Dumbbell_Bicep_Curl'],
  ['alternating-db-curl', 'Alternating Dumbbell Curl', 'Biceps', 'Dumbbell', 8, 12, 3, 'alternating-dumbbell-curl', 'Dumbbell_Alternate_Bicep_Curl'],
  ['seated-db-curl', 'Seated Dumbbell Curl', 'Biceps', 'Dumbbell', 8, 12, 3, 'seated-dumbbell-curl', 'Seated_Dumbbell_Curl'],
  ['hammer-curl', 'Hammer Curl', 'Biceps', 'Dumbbell', 8, 12, 3, 'hammer-curls', 'Hammer_Curls'],
  ['cross-body-hammer-curl', 'Cross-Body Hammer Curl', 'Biceps', 'Dumbbell', 8, 12, 3, 'cross-body-hammer-curl', 'Cross_Body_Hammer_Curl'],
  ['incline-db-curl', 'Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 10, 15, 3, 'incline-dumbbell-curl', 'Incline_Dumbbell_Curl'],
  ['concentration-curl', 'Concentration Curl', 'Biceps', 'Dumbbell', 10, 15, 3, 'concentration-curl', 'Concentration_Curls'],
  ['preacher-curl', 'Preacher Curl', 'Biceps', 'Barbell', 10, 12, 3, 'preacher-curl', 'Preacher_Curl'],
  ['db-preacher-curl', 'Dumbbell Preacher Curl', 'Biceps', 'Dumbbell', 10, 15, 3, 'dumbbell-preacher-curl', 'One_Arm_Dumbbell_Preacher_Curl'],
  ['preacher-curl-machine', 'Preacher Curl Machine', 'Biceps', 'Machine', 10, 15, 3, 'machine-preacher-curl', 'Machine_Preacher_Curls'],
  ['bicep-curl-machine', 'Bicep Curl Machine', 'Biceps', 'Machine', 10, 15, 3, 'machine-preacher-curl', 'Machine_Bicep_Curl'],
  ['cable-curl', 'Cable Curl', 'Biceps', 'Cable', 10, 15, 3, 'cable-curl', 'Standing_Biceps_Cable_Curl'],
  ['single-arm-cable-curl', 'One-Arm Cable Curl', 'Biceps', 'Cable', 10, 15, 3, 'single-arm-cable-curl', 'Standing_One-Arm_Cable_Curl'],
  ['high-cable-curl', 'High Cable Curl', 'Biceps', 'Cable', 10, 15, 3, 'cable-curl', 'High_Cable_Curls'],
  ['cable-hammer-curl', 'Rope Hammer Curl', 'Biceps', 'Cable', 10, 15, 3, 'rope-hammer-curl', 'Cable_Hammer_Curls_-_Rope_Attachment'],
  ['spider-curl', 'Spider Curl', 'Biceps', 'Barbell', 10, 15, 3, 'spider-curl', 'Spider_Curl'],
  ['zottman-curl', 'Zottman Curl', 'Biceps', 'Dumbbell', 10, 12, 3, 'zottman-curl', 'Zottman_Curl'],
  // ---- Triceps ----
  ['triceps-pushdown', 'Triceps Pushdown', 'Triceps', 'Cable', 10, 15, 3, 'tricep-pushdowns', 'Triceps_Pushdown'],
  ['rope-pushdown', 'Rope Pushdown', 'Triceps', 'Cable', 10, 15, 3, 'tricep-pushdowns', 'Triceps_Pushdown_-_Rope_Attachment'],
  ['v-bar-pushdown', 'V-Bar Pushdown', 'Triceps', 'Cable', 10, 15, 3, 'tricep-pushdowns', 'Triceps_Pushdown_-_V-Bar_Attachment'],
  ['reverse-grip-pushdown', 'Reverse Grip Pushdown', 'Triceps', 'Cable', 12, 15, 3, 'tricep-pushdowns', 'Reverse_Grip_Triceps_Pushdown'],
  ['single-arm-pushdown', 'One-Arm Cable Pushdown', 'Triceps', 'Cable', 12, 15, 3, 'tricep-pushdowns', 'Cable_One_Arm_Tricep_Extension'],
  ['overhead-triceps-ext', 'Overhead Cable Extension', 'Triceps', 'Cable', 10, 15, 3, 'cable-overhead-triceps-extension', 'Cable_Rope_Overhead_Triceps_Extension'],
  ['cable-kickback', 'Cable Triceps Kickback', 'Triceps', 'Cable', 12, 15, 3, 'cable-triceps-kickback', null],
  ['overhead-db-extension', 'Overhead Dumbbell Extension', 'Triceps', 'Dumbbell', 10, 15, 3, 'overhead-triceps-extension', 'Standing_Dumbbell_Triceps_Extension'],
  ['skull-crusher', 'Skull Crusher', 'Triceps', 'Barbell', 8, 12, 3, 'skull-crushers', 'EZ-Bar_Skullcrusher'],
  ['db-skull-crusher', 'Dumbbell Skull Crusher', 'Triceps', 'Dumbbell', 10, 15, 3, 'dumbbell-skull-crusher', 'Lying_Dumbbell_Tricep_Extension'],
  ['close-grip-bench', 'Close-Grip Bench Press', 'Triceps', 'Barbell', 6, 10, 3, 'close-grip-bench-press', 'Close-Grip_Barbell_Bench_Press'],
  ['jm-press', 'JM Press', 'Triceps', 'Barbell', 8, 12, 3, 'close-grip-bench-press', 'JM_Press'],
  ['dip', 'Dips', 'Triceps', 'Bodyweight', 8, 12, 3, 'dips', 'Dips_-_Triceps_Version'],
  ['bench-dip', 'Bench Dips', 'Triceps', 'Bodyweight', 10, 15, 3, 'bench-dip', 'Bench_Dips'],
  ['dip-machine', 'Seated Dip Machine', 'Triceps', 'Machine', 8, 12, 3, 'seated-dip-machine', 'Dip_Machine'],
  ['assisted-dip', 'Assisted Dip Machine', 'Triceps', 'Machine', 8, 12, 3, 'assisted-dip-machine', null],
  ['triceps-machine', 'Triceps Extension Machine', 'Triceps', 'Machine', 10, 15, 3, 'machine-triceps-extension', 'Machine_Triceps_Extension'],
  ['kickback', 'Dumbbell Kickback', 'Triceps', 'Dumbbell', 12, 15, 3, 'dumbbell-kickback', 'Tricep_Dumbbell_Kickback'],
  ['diamond-push-up', 'Diamond Push-Up', 'Triceps', 'Bodyweight', 10, 20, 3, 'diamond-push-up', 'Push-Ups_-_Close_Triceps_Position'],
  // ---- Forearms ----
  ['wrist-curl', 'Wrist Curl', 'Forearms', 'Barbell', 12, 20, 3, 'wrist-curl', 'Seated_Palm-Up_Barbell_Wrist_Curl'],
  ['reverse-wrist-curl', 'Reverse Wrist Curl', 'Forearms', 'Barbell', 12, 20, 3, 'reverse-wrist-curl', 'Seated_Palms-Down_Barbell_Wrist_Curl'],
  ['db-wrist-curl', 'Dumbbell Wrist Curl', 'Forearms', 'Dumbbell', 12, 20, 3, 'dumbbell-wrist-curl', 'Seated_Dumbbell_Palms-Up_Wrist_Curl'],
  ['reverse-curl', 'Reverse Curl', 'Forearms', 'Barbell', 10, 15, 3, 'reverse-curl', 'Reverse_Barbell_Curl'],
  ['wrist-roller', 'Wrist Roller', 'Forearms', 'Barbell', 2, 4, 3, 'wrist-roller', 'Wrist_Roller'],
  ['farmers-walk', "Farmer's Walk (reps = seconds)", 'Forearms', 'Dumbbell', 30, 60, 3, 'farmers-walk', 'Farmers_Walk'],
  // ---- Legs ----
  ['squat', 'Back Squat', 'Legs', 'Barbell', 5, 8, 4, 'squat', 'Barbell_Squat'],
  ['front-squat', 'Front Squat', 'Legs', 'Barbell', 6, 10, 3, 'front-squat', 'Front_Barbell_Squat'],
  ['box-squat', 'Box Squat', 'Legs', 'Barbell', 5, 8, 3, 'box-squat', 'Box_Squat'],
  ['zercher-squat', 'Zercher Squat', 'Legs', 'Barbell', 6, 10, 3, 'zercher-squat', 'Zercher_Squats'],
  ['goblet-squat', 'Goblet Squat', 'Legs', 'Dumbbell', 10, 15, 3, 'goblet-squat', 'Goblet_Squat'],
  ['db-squat', 'Dumbbell Squat', 'Legs', 'Dumbbell', 10, 15, 3, 'dumbbell-squat', 'Dumbbell_Squat'],
  ['bodyweight-squat', 'Bodyweight Squat', 'Legs', 'Bodyweight', 15, 20, 3, 'bodyweight-squat', 'Bodyweight_Squat'],
  ['leg-press', 'Leg Press', 'Legs', 'Machine', 8, 12, 3, 'leg-press', 'Leg_Press'],
  ['seated-leg-press', 'Seated Leg Press', 'Legs', 'Machine', 8, 12, 3, 'seated-leg-press', 'Leg_Press'],
  ['hack-squat', 'Hack Squat', 'Legs', 'Machine', 8, 12, 3, 'hack-squat', 'Hack_Squat'],
  ['v-squat', 'V-Squat Machine', 'Legs', 'Machine', 8, 12, 3, 'v-squat', null],
  ['pendulum-squat', 'Pendulum Squat', 'Legs', 'Machine', 8, 12, 3, 'pendulum-squat', null],
  ['smith-squat', 'Smith Machine Squat', 'Legs', 'Smith', 8, 12, 3, 'smith-machine-squat', 'Smith_Machine_Squat'],
  ['leg-extension', 'Leg Extension', 'Legs', 'Machine', 10, 15, 3, 'leg-extension', 'Leg_Extensions'],
  ['leg-curl', 'Lying Leg Curl', 'Legs', 'Machine', 10, 15, 3, 'leg-curl', 'Lying_Leg_Curls'],
  ['seated-leg-curl', 'Seated Leg Curl', 'Legs', 'Machine', 10, 15, 3, 'seated-leg-curl', 'Seated_Leg_Curl'],
  ['standing-leg-curl', 'Standing Leg Curl', 'Legs', 'Machine', 10, 15, 3, 'standing-leg-curl-machine', 'Standing_Leg_Curl'],
  ['nordic-curl', 'Nordic Hamstring Curl', 'Legs', 'Bodyweight', 5, 8, 3, 'nordic-hamstring-curl', 'Natural_Glute_Ham_Raise'],
  ['romanian-deadlift', 'Romanian Deadlift', 'Legs', 'Barbell', 8, 12, 3, 'romanian-deadlift', 'Romanian_Deadlift'],
  ['db-rdl', 'Dumbbell Romanian Deadlift', 'Legs', 'Dumbbell', 10, 12, 3, 'dumbbell-romanian-deadlift', 'Stiff-Legged_Dumbbell_Deadlift'],
  ['stiff-leg-deadlift', 'Stiff-Leg Deadlift', 'Legs', 'Barbell', 8, 12, 3, 'romanian-deadlift', 'Stiff-Legged_Barbell_Deadlift'],
  ['single-leg-rdl', 'Single-Leg Romanian Deadlift', 'Legs', 'Dumbbell', 8, 12, 3, 'single-leg-romanian-deadlift', null],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'Legs', 'Dumbbell', 8, 12, 3, 'bulgarian-split-squat', 'Split_Squat_with_Dumbbells'],
  ['lunge', 'Dumbbell Lunge', 'Legs', 'Dumbbell', 10, 12, 3, 'dumbbell-lunge', 'Dumbbell_Lunges'],
  ['reverse-lunge', 'Reverse Lunge', 'Legs', 'Dumbbell', 10, 12, 3, 'dumbbell-reverse-lunge', 'Dumbbell_Rear_Lunge'],
  ['barbell-lunge', 'Barbell Lunge', 'Legs', 'Barbell', 8, 12, 3, 'barbell-lunge', 'Barbell_Lunge'],
  ['walking-lunge', 'Barbell Walking Lunge', 'Legs', 'Barbell', 8, 12, 3, 'barbell-lunge', 'Barbell_Walking_Lunge'],
  ['step-up', 'Dumbbell Step-Up', 'Legs', 'Dumbbell', 10, 12, 3, 'dumbbell-step-up', 'Dumbbell_Step_Ups'],
  ['glute-ham-raise', 'Glute Ham Raise', 'Legs', 'Machine', 8, 12, 3, 'glute-ham-raise', 'Glute_Ham_Raise'],
  ['sissy-squat', 'Sissy Squat', 'Legs', 'Bodyweight', 10, 15, 3, 'sissy-squat', 'Weighted_Sissy_Squat'],
  ['calf-raise', 'Standing Calf Raise', 'Legs', 'Machine', 12, 20, 4, 'standing-calf-raise-machine', 'Standing_Calf_Raises'],
  ['seated-calf-raise', 'Seated Calf Raise', 'Legs', 'Machine', 12, 20, 4, 'seated-calf-raise-machine', 'Seated_Calf_Raise'],
  ['leg-press-calf-raise', 'Calf Press on Leg Press', 'Legs', 'Machine', 12, 20, 4, 'leg-press-calf-raise', 'Calf_Press_On_The_Leg_Press_Machine'],
  ['smith-calf-raise', 'Smith Machine Calf Raise', 'Legs', 'Smith', 12, 20, 4, 'smith-machine-calf-raise', 'Smith_Machine_Calf_Raise'],
  ['db-calf-raise', 'Dumbbell Calf Raise', 'Legs', 'Dumbbell', 15, 20, 4, 'dumbbell-calf-raise', 'Standing_Dumbbell_Calf_Raise'],
  ['tibialis-raise', 'Tibialis Raise Machine', 'Legs', 'Machine', 15, 20, 3, 'tibialis-raise-machine', null],
  // ---- Glutes ----
  ['hip-thrust', 'Barbell Hip Thrust', 'Glutes', 'Barbell', 8, 12, 3, 'hip-thrusts', 'Barbell_Hip_Thrust'],
  ['hip-thrust-machine', 'Hip Thrust Machine', 'Glutes', 'Machine', 8, 12, 3, 'hip-thrust-machine', null],
  ['smith-hip-thrust', 'Smith Machine Hip Thrust', 'Glutes', 'Smith', 8, 12, 3, 'smith-machine-hip-thrust', null],
  ['glute-bridge', 'Barbell Glute Bridge', 'Glutes', 'Barbell', 10, 15, 3, 'barbell-glute-bridge', 'Barbell_Glute_Bridge'],
  ['bw-glute-bridge', 'Glute Bridge', 'Glutes', 'Bodyweight', 15, 20, 3, 'glute-bridge', 'Butt_Lift_Bridge'],
  ['single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'Glutes', 'Bodyweight', 12, 15, 3, 'single-leg-glute-bridge', 'Single_Leg_Glute_Bridge'],
  ['glute-kickback', 'Cable Glute Kickback', 'Glutes', 'Cable', 12, 15, 3, 'cable-kickback', 'One-Legged_Cable_Kickback'],
  ['glute-kickback-machine', 'Glute Kickback Machine', 'Glutes', 'Machine', 12, 15, 3, 'machine-glute-kickback', null],
  ['bw-glute-kickback', 'Glute Kickback', 'Glutes', 'Bodyweight', 15, 20, 3, 'donkey-kicks', 'Glute_Kickback'],
  ['cable-pull-through', 'Cable Pull-Through', 'Glutes', 'Cable', 12, 15, 3, 'cable-pull-through', 'Pull_Through'],
  ['hip-abduction', 'Hip Abduction Machine (legs apart)', 'Glutes', 'Machine', 12, 20, 3, 'hip-abduction-machine', 'Thigh_Abductor'],
  ['hip-adduction', 'Hip Adduction Machine (legs together)', 'Glutes', 'Machine', 12, 20, 3, 'hip-adduction-machine', 'Thigh_Adductor'],
  ['sumo-squat', 'Sumo Dumbbell Squat', 'Glutes', 'Dumbbell', 10, 15, 3, 'sumo-squat', 'Plie_Dumbbell_Squat'],
  ['kettlebell-swing', 'Kettlebell Swing', 'Glutes', 'Kettlebell', 12, 20, 3, 'kettlebell-swing', 'One-Arm_Kettlebell_Swings'],
  ['reverse-hyper', 'Reverse Hyperextension', 'Glutes', 'Machine', 12, 15, 3, 'reverse-hyperextension', 'Reverse_Hyperextension'],
  // ---- Core ----
  ['cable-crunch', 'Cable Crunch', 'Core', 'Cable', 12, 20, 3, 'cable-crunch', 'Cable_Crunch'],
  ['ab-machine', 'Ab Crunch Machine', 'Core', 'Machine', 12, 20, 3, 'machine-abdominal-crunch', 'Ab_Crunch_Machine'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'Core', 'Bodyweight', 10, 15, 3, 'hanging-leg-raise', 'Hanging_Leg_Raise'],
  ['hanging-knee-raise', 'Hanging Knee Raise', 'Core', 'Bodyweight', 12, 15, 3, 'hanging-knee-raise', 'Hanging_Leg_Raise'],
  ['captains-chair', "Captain's Chair Knee Raise", 'Core', 'Bodyweight', 12, 15, 3, 'captains-chair-knee-raise', 'Knee_Hip_Raise_On_Parallel_Bars'],
  ['lying-leg-raise', 'Lying Leg Raise', 'Core', 'Bodyweight', 12, 20, 3, 'leg-raises', 'Flat_Bench_Lying_Leg_Raise'],
  ['crunch', 'Crunch', 'Core', 'Bodyweight', 15, 25, 3, 'crunches', 'Crunches'],
  ['sit-up', 'Sit-Up', 'Core', 'Bodyweight', 15, 25, 3, 'sit-up', 'Sit-Up'],
  ['decline-sit-up', 'Decline Sit-Up', 'Core', 'Bodyweight', 12, 20, 3, 'decline-sit-up', 'Decline_Crunch'],
  ['decline-crunch', 'Decline Crunch', 'Core', 'Bodyweight', 12, 20, 3, 'decline-crunch', 'Decline_Crunch'],
  ['reverse-crunch', 'Reverse Crunch', 'Core', 'Bodyweight', 15, 20, 3, 'reverse-crunch', 'Reverse_Crunch'],
  ['bicycle-crunch', 'Bicycle Crunch', 'Core', 'Bodyweight', 15, 25, 3, 'bicycle-crunch', 'Air_Bike'],
  ['plank', 'Plank (reps = seconds)', 'Core', 'Bodyweight', 30, 60, 3, 'plank', 'Plank'],
  ['side-plank', 'Side Plank (reps = seconds)', 'Core', 'Bodyweight', 30, 60, 3, 'side-plank', 'Side_Bridge'],
  ['russian-twist', 'Russian Twist', 'Core', 'Bodyweight', 15, 20, 3, 'russian-twists', 'Russian_Twist'],
  ['ab-wheel', 'Ab Wheel Rollout', 'Core', 'Bodyweight', 8, 15, 3, 'ab-wheel-rollout', 'Ab_Roller'],
  ['cable-woodchop', 'Cable Woodchop', 'Core', 'Cable', 12, 15, 3, 'cable-woodchopper', 'Standing_Cable_Wood_Chop'],
  ['pallof-press', 'Pallof Press', 'Core', 'Cable', 10, 15, 3, 'pallof-press', 'Pallof_Press'],
  ['db-side-bend', 'Dumbbell Side Bend', 'Core', 'Dumbbell', 12, 20, 3, 'dumbbell-side-bend', 'Dumbbell_Side_Bend'],
  ['dead-bug', 'Dead Bug', 'Core', 'Bodyweight', 10, 15, 3, 'dead-bug', 'Dead_Bug'],
  ['v-up', 'V-Up', 'Core', 'Bodyweight', 10, 15, 3, 'v-up', 'Jackknife_Sit-Up'],
  ['toes-to-bar', 'Toes to Bar', 'Core', 'Bodyweight', 8, 12, 3, 'toes-to-bar', 'Hanging_Pike'],
  ['dragon-flag', 'Dragon Flag', 'Core', 'Bodyweight', 5, 8, 3, 'dragon-flag', null],
  // ---- Full body ----
  ['power-clean', 'Power Clean', 'Full body', 'Barbell', 3, 5, 5, 'power-clean', 'Power_Clean'],
  ['clean-and-press', 'Clean & Press', 'Full body', 'Barbell', 5, 8, 4, 'power-clean', 'Clean_and_Press'],
  ['clean-and-jerk', 'Clean & Jerk', 'Full body', 'Barbell', 3, 5, 5, 'push-jerk', 'Clean_and_Jerk'],
  ['hang-clean', 'Hang Clean', 'Full body', 'Barbell', 3, 5, 5, 'hang-clean', 'Hang_Clean'],
  ['push-jerk', 'Push Jerk', 'Full body', 'Barbell', 3, 5, 5, 'push-jerk', 'Power_Jerk'],
  ['snatch', 'Snatch', 'Full body', 'Barbell', 3, 5, 5, 'snatch', 'Snatch'],
  ['overhead-squat', 'Overhead Squat', 'Full body', 'Barbell', 5, 8, 3, 'overhead-squat', 'Overhead_Squat'],
  ['barbell-thruster', 'Barbell Thruster', 'Full body', 'Barbell', 6, 10, 3, 'thruster', null],
  ['thruster', 'Kettlebell Thruster', 'Full body', 'Kettlebell', 8, 12, 3, 'dumbbell-thruster', 'Kettlebell_Thruster'],
  ['db-thruster', 'Dumbbell Thruster', 'Full body', 'Dumbbell', 8, 12, 3, 'dumbbell-thruster', 'Kettlebell_Thruster'],
  ['kettlebell-clean', 'Kettlebell Clean', 'Full body', 'Kettlebell', 6, 10, 3, 'kettlebell-clean', 'One-Arm_Kettlebell_Clean'],
  ['db-clean', 'Dumbbell Clean', 'Full body', 'Dumbbell', 6, 10, 3, 'kettlebell-clean', 'Dumbbell_Clean'],
  ['kettlebell-snatch', 'Kettlebell Snatch', 'Full body', 'Kettlebell', 6, 10, 3, 'kettlebell-snatch', 'One-Arm_Kettlebell_Snatch'],
  ['turkish-get-up', 'Turkish Get-Up', 'Full body', 'Kettlebell', 3, 5, 3, 'turkish-get-up', 'Kettlebell_Turkish_Get-Up_Squat_style'],
  ['renegade-row', 'Renegade Row', 'Full body', 'Dumbbell', 8, 12, 3, 'renegade-row', 'Alternating_Renegade_Row'],
  ['burpee', 'Burpee', 'Full body', 'Bodyweight', 10, 20, 3, 'burpees', null],
]

// Written for exercises the instruction dataset does not cover.
const INLINE = {
  'cable-fly-high-to-low': ['Set both pulleys above shoulder height and grab a handle in each hand.', 'Step forward into a staggered stance with a slight forward lean and a soft bend in the elbows.', 'Sweep the handles down and together in front of your hips, squeezing the lower chest.', 'Return slowly along the same arc and repeat.'],
  'pendlay-row': ['Load a barbell on the floor and stand with your shins close to it, feet hip-width apart.', 'Hinge until your torso is parallel to the floor and grip the bar a little wider than shoulder width.', 'Keeping your back flat and torso still, row the bar explosively to your lower chest.', 'Lower the bar back to a dead stop on the floor before the next rep.'],
  'machine-pullover': ['Adjust the seat so your shoulders line up with the pivot point and grip the bar or pads overhead.', 'Keeping your arms slightly bent, pull the bar down in an arc until it reaches your thighs.', 'Squeeze your lats at the bottom, then return under control to the stretched position.'],
  'wide-grip-pull-up': ['Hang from a bar with an overhand grip well outside shoulder width.', 'Pull your chest toward the bar by driving your elbows down and back.', 'Pause with your chin over the bar, then lower slowly to a full hang.'],
  'assisted-pull-up': ['Set the counterweight, kneel or stand on the platform and take an overhand grip.', 'Pull your chest toward the handles, driving the elbows down.', 'Lower under control to a full stretch. Reduce the assistance weight over time.'],
  'smith-machine-shrug': ['Set the bar at thigh height and stand upright holding it with an overhand grip.', 'Shrug your shoulders straight up toward your ears without rolling them.', 'Hold the top for a second, then lower slowly.'],
  'landmine-press': ['Anchor a barbell in a landmine and hold the end at shoulder height with one or both hands.', 'Brace your core and press the bar up and forward until your arm is extended.', 'Lower slowly back to the shoulder and repeat.'],
  'machine-lateral-raise': ['Sit with the pads against the outside of your upper arms and grip the handles.', 'Raise your arms out to the sides until your elbows reach shoulder height.', 'Pause briefly, then lower under control.'],
  'cable-triceps-kickback': ['Hold a low pulley handle, hinge forward and pin your upper arm beside your torso.', 'Extend your elbow until your arm is straight behind you.', 'Squeeze the triceps, then return slowly.'],
  'assisted-dip-machine': ['Set the counterweight, kneel on the platform and grip the dip handles.', 'Lower yourself until your upper arms are parallel to the floor.', 'Press back up to full extension. Reduce the assistance over time.'],
  'v-squat': ['Stand on the platform with your back against the pad and shoulders under the supports.', 'Unlock the safeties and lower by bending your knees until your thighs are parallel or lower.', 'Drive through your whole foot to return to the start.'],
  'pendulum-squat': ['Stand on the platform with your shoulders under the pads and feet in the middle of the plate.', 'Lower under control, letting the arc guide your knees forward.', 'Drive back up without locking out aggressively.'],
  'single-leg-romanian-deadlift': ['Hold a dumbbell in one hand and stand on the opposite leg with a soft knee.', 'Hinge at the hip, letting the free leg extend behind you and the weight travel down your shin.', 'Keep your back flat, then drive the hip forward to stand tall.'],
  'tibialis-raise-machine': ['Sit with your feet under the pad and heels on the platform.', 'Pull your toes up toward your shins as far as possible.', 'Lower slowly and repeat.'],
  'hip-thrust-machine': ['Sit with your upper back against the pad and the belt or pad across your hips.', 'Drive your hips up until your torso is parallel to the floor, squeezing your glutes.', 'Lower under control and repeat.'],
  'smith-machine-hip-thrust': ['Sit with your upper back on a bench and the Smith bar across your hips.', 'Drive your hips up until your body forms a straight line from shoulders to knees.', 'Squeeze the glutes at the top, then lower under control.'],
  'machine-glute-kickback': ['Stand on the platform, hold the handles and place one foot on the pedal.', 'Push the pedal back and up by extending your hip, squeezing the glute.', 'Return slowly and repeat before switching legs.'],
  'dragon-flag': ['Lie on a bench and hold behind your head.', 'Raise your body as one straight line from shoulders to toes, supported only by your upper back.', 'Lower slowly without letting your hips sag, stopping just above the bench.'],
  'thruster': ['Hold a barbell in the front-rack position and squat to full depth.', 'Drive up out of the squat and use the momentum to press the bar overhead in one motion.', 'Lower the bar to your shoulders and go straight into the next squat.'],
  'burpees': ['From standing, squat down and place your hands on the floor.', 'Jump your feet back into a plank and perform a push-up.', 'Jump your feet back in and explode up into a jump, then repeat.'],
}

// open-exercise-illustrations muscle vocabulary -> react-body-highlighter slugs
const MUSCLE_MAP = {
  glutes: ['gluteal'], quads: ['quadriceps'], core: ['abs'], triceps: ['triceps'],
  shoulders: ['front-deltoids', 'back-deltoids'], chest: ['chest'], lats: ['upper-back'], back: ['upper-back'],
  hamstrings: ['hamstring'], biceps: ['biceps'], obliques: ['obliques'], traps: ['trapezius'],
  calves: ['calves', 'left-soleus', 'right-soleus'], forearms: ['forearm'], lower_back: ['lower-back'], neck: ['neck'], tibialis: [],
}

// Per-exercise muscle overrides where the dataset's tags are too coarse.
const MUSCLE_OVERRIDES = {
  'hip-abduction': { primary: ['abductors', 'gluteal'], secondary: ['abs'] },
  'hip-adduction': { primary: ['adductor'], secondary: ['gluteal'] },
}

// Frames to use where the dataset's own frames are wrong. A single frame renders as a held pose.
// hip-abduction: the dataset's "end" frame shows the pads inside the knees (adduction geometry).
const FRAME_OVERRIDES = {
  'hip-abduction': ['start'],
}
// Caption shown on a single-frame illustration (defaults to "Hold").
const CAPTIONS = {
  'hip-abduction': 'Start · push the pads outward',
}

const fetchJson = async (url) => (await fetch(url)).json()
const ts = (v) => JSON.stringify(v)

async function main() {
  const skipImages = process.argv.includes('--skip-images')
  const [oei, fed] = await Promise.all([fetchJson(OEI + 'exercises.json'), fetchJson(FED)])
  const illu = new Map(oei.exercises.map((e) => [e.id, e]))
  for (const v of oei.variants) if (!illu.has(v.id)) illu.set(v.id, illu.get(v.imageOf))
  const instr = new Map(fed.map((e) => [e.id, e.instructions]))

  const ids = C.map((c) => c[0])
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dup.length) throw new Error('duplicate ids: ' + dup)
  const missingIllu = C.filter((c) => !illu.has(c[7])).map((c) => c[7])
  if (missingIllu.length) throw new Error('illustrations not found: ' + missingIllu)
  const missingInstr = C.filter((c) => (c[8] ? !instr.has(c[8]) : !INLINE[c[7]])).map((c) => c[0])
  if (missingInstr.length) throw new Error('instructions missing: ' + missingInstr)

  const toSlugs = (list) => [...new Set(list.flatMap((m) => MUSCLE_MAP[m] ?? []))]
  const presets = C.map(([id, name, muscle, equipment, repMin, repMax, sets, oid]) => {
    const e = illu.get(oid)
    const primary = MUSCLE_OVERRIDES[id]?.primary ?? toSlugs(e.muscles.primary)
    const secondary = (MUSCLE_OVERRIDES[id]?.secondary ?? toSlugs(e.muscles.secondary)).filter((m) => !primary.includes(m))
    return { id, name, muscle, equipment, repMin, repMax, sets, custom: false, image: true,
      ...((FRAME_OVERRIDES[id] ?? e.frames).length === 1 ? { single: true } : {}),
      ...(CAPTIONS[id] ? { caption: CAPTIONS[id] } : {}),
      ...(e.width / e.height > WIDE_RATIO ? { wide: true } : {}),
      primary, secondary }
  })
  const presetsTs = ['// GENERATED by scripts/build-exercises.mjs — do not edit by hand.',
    "import type { Exercise } from '../types'", '', 'export const PRESET_EXERCISES: Exercise[] = [',
    ...presets.map((p) => `  ${ts(p)},`), ']', ''].join('\n')
  await writeFile(join(ROOT, 'src/data/presets.ts'), presetsTs)

  const instrTs = ['// GENERATED by scripts/build-exercises.mjs — do not edit by hand.',
    '// Instructions from free-exercise-db (public domain) plus a few written for this app.', '',
    'export const INSTRUCTIONS: Record<string, string[]> = {',
    ...C.map(([id, , , , , , , oid, fid]) => `  ${ts(id)}: ${ts((fid ? instr.get(fid) : INLINE[oid]).map((s) => s.trim()).filter(Boolean))},`),
    '}', ''].join('\n')
  await writeFile(join(ROOT, 'src/data/instructions.ts'), instrTs)
  console.log(`wrote ${C.length} exercises`)
  if (skipImages) return

  const outRoot = join(ROOT, 'public/exercises')
  const manifestPath = join(ROOT, 'scripts/image-sources.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}'))
  const jobs = []
  for (const [id, , , , , , , oid] of C) {
    const e = illu.get(oid)
    const height = e.width / e.height > WIDE_RATIO ? WIDE_HEIGHT : IMG_HEIGHT
    // Most exercises have start/end frames; a few are single-pose (one frame) or use other names.
    const keys = FRAME_OVERRIDES[id] ?? (e.frames.length ? e.frames : Object.keys(e.images))
    const pick = { start: keys[0], end: keys[keys.length - 1] }
    for (const frame of ['start', 'end']) {
      const out = join(outRoot, id, `${frame}.webp`)
      // The manifest records which dataset image each cached file came from, so a
      // changed mapping re-downloads instead of silently reusing the old render.
      jobs.push({ url: OEI + e.images[pick[frame]], out, height, src: e.images[pick[frame]] })
    }
  }
  let done = 0; const errors = []
  const worker = async () => {
    while (jobs.length) {
      const { url, out, height, src } = jobs.shift()
      const rel = out.slice(outRoot.length + 1)
      try {
        await access(out)
        if (manifest[rel] === src) { done++; continue }
      } catch { /* not cached */ }
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        await mkdir(dirname(out), { recursive: true })
        await sharp(buf).resize({ height }).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(out)
        manifest[rel] = src
        done++
      } catch (err) { errors.push(`${url}: ${err.message}`) }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  await writeFile(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n')
  console.log(`images: ${done} ok, ${errors.length} errors`)
  errors.forEach((e) => console.log('  ' + e))
  if (errors.length) process.exitCode = 1
}

main().catch((e) => { console.error(e.message); process.exit(1) })
