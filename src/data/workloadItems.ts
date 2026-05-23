import { ScaleItem } from '../types';

// Adapted Nursing Workload Scale for Medical Ward Nurses (12 items)
// Adapted from: NAS (Miranda et al., 2003), NASA-TLX (Hart & Staveland, 1988),
// and workload studies in Nigerian/African medical wards.
// Response: 1=Not at all  2=Slightly  3=Moderately  4=Very much  5=Extremely
// Higher score = higher workload

export const WORKLOAD_ITEMS: ScaleItem[] = [
  // Subscale A: Physical & Task Demands (items 1–4)
  {
    id: 1,
    subscale: 'Physical & Task Demands',
    reversed: false,
    text: 'The physical demands (lifting, moving, repositioning patients) of my work during this shift were burdensome.',
  },
  {
    id: 2,
    subscale: 'Physical & Task Demands',
    reversed: false,
    text: 'The number of patients I was responsible for exceeded what I could comfortably manage.',
  },
  {
    id: 3,
    subscale: 'Physical & Task Demands',
    reversed: false,
    text: 'I had to perform complex or multiple nursing procedures simultaneously or in rapid succession.',
  },
  {
    id: 4,
    subscale: 'Physical & Task Demands',
    reversed: false,
    text: 'I experienced time pressure — there was not enough time to complete all required nursing tasks.',
  },
  // Subscale B: Cognitive & Emotional Demands (items 5–8)
  {
    id: 5,
    subscale: 'Cognitive & Emotional Demands',
    reversed: false,
    text: 'The mental concentration required to monitor my patients and make clinical decisions was high.',
  },
  {
    id: 6,
    subscale: 'Cognitive & Emotional Demands',
    reversed: false,
    text: 'I experienced emotional stress related to patient conditions or family interactions during this shift.',
  },
  {
    id: 7,
    subscale: 'Cognitive & Emotional Demands',
    reversed: false,
    text: 'I was frequently interrupted or distracted while performing nursing tasks.',
  },
  {
    id: 8,
    subscale: 'Cognitive & Emotional Demands',
    reversed: false,
    text: 'Unexpected emergencies or deteriorating patients increased my workload significantly.',
  },
  // Subscale C: Administrative & Resource Burden (items 9–12)
  {
    id: 9,
    subscale: 'Administrative & Resource Burden',
    reversed: false,
    text: 'Documentation, records, and administrative tasks consumed a considerable portion of my shift.',
  },
  {
    id: 10,
    subscale: 'Administrative & Resource Burden',
    reversed: false,
    text: 'Inadequate supplies, equipment, or resources made it harder to carry out nursing care.',
  },
  {
    id: 11,
    subscale: 'Administrative & Resource Burden',
    reversed: false,
    text: 'Coordination with other health team members (doctors, pharmacists, lab) added to my workload.',
  },
  {
    id: 12,
    subscale: 'Administrative & Resource Burden',
    reversed: false,
    text: 'Overall, I felt that today\'s workload was excessive relative to available nursing staff.',
  },
];

export const WORKLOAD_LABELS: Record<number, string> = {
  1: 'Not at all',
  2: 'Slightly',
  3: 'Moderately',
  4: 'Very much',
  5: 'Extremely',
};

export const WORKLOAD_SUBSCALES = [
  'Physical & Task Demands',
  'Cognitive & Emotional Demands',
  'Administrative & Resource Burden',
];
