import { Table } from '../core/database';

interface Field {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime-local' | 'boolean' | 'select';
  required?: boolean;
  choices?: readonly string[];
  lookup?: Table;
  optional?: boolean;
  step?: string;
  editable?: 'create' | 'update';
}

interface Resource {
  fields: Field[];
  extra?: Field[];
  description: string;
  create?: boolean;
  delete?: boolean;
  readOnly?: boolean;
}

const text = (key: string, label: string): Field => ({ key, label, required: true });
const lookup = (key: string, label: string, table: Table, optional = false): Field =>
  ({ key, label, lookup: table, type: 'select', required: !optional, optional });
const select = (key: string, label: string, choices: readonly string[], optional = false): Field =>
  ({ key, label, choices, type: 'select', required: !optional, optional });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', required: true });
const time = (key: string, label: string): Field => ({ key, label, type: 'time', required: true });
const period: Field[] = [date('start_on', 'Start date'), date('end_on', 'End date')];
const codeName = [text('code', 'Code'), text('name', 'Name')];
const audience = select('audience', 'Audience', ['student', 'faculty', 'admin'], true);

export const RESOURCES = {
  profiles: {
    description: 'Provision accounts and control access to the portal.',
    create: false, delete: false,
    fields: [text('full_name', 'Full name'), { key: 'active', label: 'Active', type: 'boolean' }],
    extra: [{ key: 'email', label: 'Email' }, select('role', 'Role', ['student', 'faculty', 'admin'])],
  },
  students: {
    description: 'Assign student identifiers and academic programs.',
    create: false, delete: false,
    fields: [{ key: 'student_number', label: 'Student number', optional: true }, lookup('program_id', 'Program', 'programs', true)],
    extra: [lookup('id', 'Student', 'profiles')],
  },
  faculty: {
    description: 'Assign faculty identifiers and teaching departments.',
    create: false, delete: false,
    fields: [{ key: 'employee_number', label: 'Employee number', optional: true }, lookup('department_id', 'Department', 'departments', true)],
    extra: [lookup('id', 'Faculty member', 'profiles')],
  },
  departments: { description: 'Maintain the department catalog.', fields: codeName },
  programs: { description: 'Manage degree programs and their departments.', fields: [...codeName, lookup('department_id', 'Department', 'departments')] },
  subjects: {
    description: 'Manage subject codes, titles, credit units, and departments.',
    fields: [...codeName, { key: 'units', label: 'Credit units', type: 'number', step: '0.1', required: true }, lookup('department_id', 'Department', 'departments')],
  },
  sections: { description: 'Maintain sections within each degree program.', fields: [text('name', 'Section name'), lookup('program_id', 'Program', 'programs')] },
  academic_years: { description: 'Set the dates for non-overlapping academic years.', fields: [text('label', 'Year'), ...period] },
  semesters: { description: 'Set semesters and term dates within each academic year.', fields: [text('name', 'Semester'), lookup('year_id', 'Academic year', 'academic_years'), ...period] },
  class_assignments: {
    description: 'Assign faculty to teach a subject and section in a semester.',
    fields: [lookup('semester_id', 'Semester', 'semesters'), lookup('subject_id', 'Subject', 'subjects'),
      lookup('section_id', 'Section', 'sections'), lookup('faculty_id', 'Faculty member', 'faculty')],
  },
  class_schedules: {
    description: 'Schedule weekly meetings and prevent faculty, section, and room conflicts.',
    fields: [lookup('class_id', 'Class', 'class_assignments'), select('weekday', 'Day', ['1', '2', '3', '4', '5', '6', '7']),
      time('starts_at', 'Start time'), time('ends_at', 'End time'), text('room', 'Room')],
  },
  enrollments: {
    description: 'Place students into classes and manage their enrollment status.',
    fields: [{ ...lookup('student_id', 'Student', 'students'), editable: 'create' },
      { ...lookup('class_id', 'Class', 'class_assignments'), editable: 'create' },
      select('status', 'Status', ['enrolled', 'completed', 'withdrawn'])],
  },
  grades: {
    description: 'Review submitted grades, publish results, or return grades to draft.',
    fields: [{ ...lookup('enrollment_id', 'Enrollment', 'enrollments'), editable: 'create' },
      lookup('scale_id', 'Grade', 'grading_scales')],
    extra: [select('status', 'Status', ['draft', 'submitted', 'published'])],
  },
  grading_scales: {
    description: 'Configure the grading options used during encoding.',
    fields: [text('label', 'Label'), { key: 'grade', label: 'Numeric value', type: 'number', step: '0.01', required: true },
      { key: 'passing', label: 'Passing grade', type: 'boolean' }],
  },
  attendance: {
    description: 'Review, record, or correct class attendance.',
    fields: [{ ...lookup('enrollment_id', 'Enrollment', 'enrollments'), editable: 'create' },
      { ...date('attended_on', 'Meeting date'), editable: 'create' },
      select('status', 'Status', ['present', 'late', 'absent', 'excused'])],
  },
  announcements: {
    description: 'Write campus notices and choose when each audience can see them.',
    fields: [text('title', 'Title'), { key: 'body', label: 'Message', type: 'textarea', required: true },
      audience, { key: 'published_at', label: 'Publish date and time (Philippine time)', type: 'datetime-local', optional: true }],
  },
  calendar_events: {
    description: 'Maintain campus events and academic deadlines.',
    fields: [text('title', 'Title'), { key: 'description', label: 'Description', type: 'textarea' }, date('starts_on', 'Start date'),
      date('ends_on', 'End date'), audience],
  },
  audit_logs: {
    description: 'Review who added, changed, or removed tracked records.',
    readOnly: true,
    fields: [lookup('actor_id', 'Actor', 'profiles', true), text('action', 'Action'), text('entity', 'Resource'),
      text('entity_id', 'Record ID'), { key: 'created_at', label: 'Recorded at', type: 'datetime-local' }],
  },
} satisfies Partial<Record<Table, Resource>>;

export type ResourceKey = keyof typeof RESOURCES;
export function resource(key: ResourceKey): Resource { return RESOURCES[key]; }
export type { Field };
