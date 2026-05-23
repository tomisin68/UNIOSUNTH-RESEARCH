import { ScaleItem } from '../types';

// Compliance with Standard Precautions Scale (CSPS) — Lam (2004)
// Adapted version validated in African/Nigerian settings.
// Reference: Lam SC (2014). Validation of the Compliance with Standard Precautions Scale.
// Response: 1=Never  2=Rarely  3=Sometimes  4=Always
// Reverse-scored items (marked reversed:true): scoring is inverted (Never=4, Always=1)
// Higher total score = better compliance

export const IPC_ITEMS: ScaleItem[] = [
  // Subscale 1: Personal Protective Equipment (PPE) Use — items 1–7
  {
    id: 1,
    subscale: 'Personal Protective Equipment',
    reversed: false,
    text: 'I wear disposable gloves when there is any risk of contact with blood, body fluids, secretions, or excretions.',
  },
  {
    id: 2,
    subscale: 'Personal Protective Equipment',
    reversed: false,
    text: 'I change gloves and perform hand hygiene between caring for different patients.',
  },
  {
    id: 3,
    subscale: 'Personal Protective Equipment',
    reversed: true,
    text: 'I reuse single-use gloves after cleaning or disinfecting them.',
  },
  {
    id: 4,
    subscale: 'Personal Protective Equipment',
    reversed: false,
    text: 'I wear a protective gown or apron when there is a risk of splashing of blood or body fluids onto my clothing.',
  },
  {
    id: 5,
    subscale: 'Personal Protective Equipment',
    reversed: false,
    text: 'I wear a surgical mask when performing procedures that risk splashing of blood or body fluids to my face.',
  },
  {
    id: 6,
    subscale: 'Personal Protective Equipment',
    reversed: false,
    text: 'I wear eye protection (goggles or face shield) during procedures with a risk of splashing to my eyes.',
  },
  {
    id: 7,
    subscale: 'Personal Protective Equipment',
    reversed: false,
    text: 'I remove PPE appropriately and perform hand hygiene immediately after removing it.',
  },
  // Subscale 2: Safe Handling & Disposal of Sharps — items 8–12
  {
    id: 8,
    subscale: 'Sharps Safety',
    reversed: true,
    text: 'I recap used needles using a two-handed technique.',
  },
  {
    id: 9,
    subscale: 'Sharps Safety',
    reversed: false,
    text: 'I dispose of used needles and sharps directly into a puncture-resistant container immediately after use.',
  },
  {
    id: 10,
    subscale: 'Sharps Safety',
    reversed: true,
    text: 'I bend or break used needles before disposing of them.',
  },
  {
    id: 11,
    subscale: 'Sharps Safety',
    reversed: true,
    text: 'I pass used sharps or instruments directly from hand to hand to another person.',
  },
  {
    id: 12,
    subscale: 'Sharps Safety',
    reversed: false,
    text: 'I report needlestick injuries or sharps injuries to the appropriate authority promptly.',
  },
  // Subscale 3: Decontamination & Waste Management — items 13–16
  {
    id: 13,
    subscale: 'Decontamination & Waste',
    reversed: false,
    text: 'I clean blood or body fluid spills promptly using the appropriate disinfectant and procedure.',
  },
  {
    id: 14,
    subscale: 'Decontamination & Waste',
    reversed: false,
    text: 'I ensure reusable patient-care equipment is cleaned and decontaminated before use on another patient.',
  },
  {
    id: 15,
    subscale: 'Decontamination & Waste',
    reversed: false,
    text: 'I handle soiled linen carefully, without shaking it, and place it in a designated bag.',
  },
  {
    id: 16,
    subscale: 'Decontamination & Waste',
    reversed: false,
    text: 'I segregate and dispose of clinical/infectious waste in the appropriate colour-coded containers.',
  },
  // Subscale 4: Hand Hygiene & Prevention of Cross-Infection — items 17–20
  {
    id: 17,
    subscale: 'Hand Hygiene & Cross-Infection Prevention',
    reversed: false,
    text: 'I perform hand hygiene (wash with soap and water or use alcohol-based hand rub) before direct patient contact.',
  },
  {
    id: 18,
    subscale: 'Hand Hygiene & Cross-Infection Prevention',
    reversed: false,
    text: 'I perform hand hygiene after direct patient contact or after touching patient surroundings.',
  },
  {
    id: 19,
    subscale: 'Hand Hygiene & Cross-Infection Prevention',
    reversed: false,
    text: 'I apply standard precautions consistently for ALL patients, regardless of their known or suspected infectious status.',
  },
  {
    id: 20,
    subscale: 'Hand Hygiene & Cross-Infection Prevention',
    reversed: false,
    text: 'I ensure that aseptic technique is maintained during invasive procedures (e.g., IV insertion, wound care, catheterisation).',
  },
];

export const IPC_LABELS: Record<number, string> = {
  1: 'Never',
  2: 'Rarely',
  3: 'Sometimes',
  4: 'Always',
};

export const IPC_SUBSCALES = [
  'Personal Protective Equipment',
  'Sharps Safety',
  'Decontamination & Waste',
  'Hand Hygiene & Cross-Infection Prevention',
];
