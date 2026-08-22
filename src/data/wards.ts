// Clinical areas of UNIOSUN Teaching Hospital (UNIOSUNTH), Osogbo.
// This is the authoritative list used by the intake form, the analysis
// stratification, and the security rules' ward validation.
//
// `group` collapses the 18 units into 6 service areas. Per-ward cell counts are
// small in a study of this size, so ward-level tests lose power quickly; the
// grouped variable keeps the between-unit comparison interpretable.

export interface Ward {
  name: string;
  group: WardGroup;
}

export type WardGroup =
  | 'Medical'
  | 'Surgical'
  | 'Paediatric & Neonatal'
  | 'Critical & Peri-operative'
  | 'Obstetrics & Gynaecology'
  | 'Emergency';

export const WARDS: Ward[] = [
  { name: 'Male Medical Ward',            group: 'Medical' },
  { name: 'Female Medical Ward',          group: 'Medical' },
  { name: 'Renal Unit',                   group: 'Medical' },
  { name: 'Male Surgical Ward',           group: 'Surgical' },
  { name: 'Female Surgical Ward',         group: 'Surgical' },
  { name: 'Orthopaedic Ward',             group: 'Surgical' },
  { name: 'Burns Unit',                   group: 'Surgical' },
  { name: 'Paediatric Medical Ward 1',    group: 'Paediatric & Neonatal' },
  { name: 'Paediatric Medical Ward 2',    group: 'Paediatric & Neonatal' },
  { name: 'Paediatric Surgical Ward',     group: 'Paediatric & Neonatal' },
  { name: 'Special Care Baby Unit (SCBU)', group: 'Paediatric & Neonatal' },
  { name: 'Intensive Care Unit (ICU)',    group: 'Critical & Peri-operative' },
  { name: 'Theatre',                      group: 'Critical & Peri-operative' },
  { name: 'Labour Ward',                  group: 'Obstetrics & Gynaecology' },
  { name: 'Post-Natal Ward',              group: 'Obstetrics & Gynaecology' },
  { name: 'Gynaecology Ward',             group: 'Obstetrics & Gynaecology' },
  { name: 'Accident & Emergency (A&E)',   group: 'Emergency' },
  { name: 'Children Emergency Unit (CEU)', group: 'Emergency' },
];

export const WARD_NAMES: string[] = WARDS.map(w => w.name);

export const WARD_GROUPS: WardGroup[] = [
  'Medical',
  'Surgical',
  'Paediatric & Neonatal',
  'Critical & Peri-operative',
  'Obstetrics & Gynaecology',
  'Emergency',
];

const GROUP_BY_NAME = new Map(WARDS.map(w => [w.name, w.group] as const));

/** Service area for a ward name; records collected before a ward was renamed
 *  fall through to 'Medical' rather than being dropped from the analysis. */
export function wardGroup(name: string): WardGroup {
  return GROUP_BY_NAME.get(name) ?? 'Medical';
}

/** Compact label for axis ticks and table cells, where the full name wraps. */
export function shortWard(name: string): string {
  return name
    .replace(/\s*\((SCBU|ICU|A&E|CEU)\)/, ' $1')
    .replace(/ Ward$/, '')
    .replace(/ Unit$/, '');
}
