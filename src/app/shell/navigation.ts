import { Role } from '../core/database';

export const NAVIGATION: Record<Role, { label: string; links: { view: string; label: string; icon: string }[] }[]> = {
  student: [
    { label: 'Workspace', links: [{ view: 'overview', label: 'Overview', icon: 'grid' },
      { view: 'profile', label: 'My profile', icon: 'person-circle' }, { view: 'notifications', label: 'Notifications', icon: 'notifications' }] },
    { label: 'Academics', links: [{ view: 'subjects', label: 'Enrolled subjects', icon: 'book' }, { view: 'schedule', label: 'Class schedule', icon: 'time' },
      { view: 'grades', label: 'Grades & history', icon: 'school' }, { view: 'attendance', label: 'Attendance', icon: 'checkbox' }] },
    { label: 'Campus', links: [{ view: 'calendar', label: 'Academic calendar', icon: 'calendar' },
      { view: 'announcements', label: 'Announcements', icon: 'megaphone' }] },
  ],
  faculty: [
    { label: 'Workspace', links: [{ view: 'overview', label: 'Overview', icon: 'grid' }, { view: 'classes', label: 'Assigned classes', icon: 'book' },
      { view: 'schedule', label: 'Class schedule', icon: 'time' }] },
    { label: 'Teaching', links: [{ view: 'grades', label: 'Grade encoding', icon: 'school' }, { view: 'attendance', label: 'Attendance', icon: 'checkbox' }] },
    { label: 'Campus', links: [{ view: 'calendar', label: 'Academic calendar', icon: 'calendar' },
      { view: 'announcements', label: 'Announcements', icon: 'megaphone' }] },
  ],
  admin: [
    { label: 'Workspace', links: [{ view: 'overview', label: 'Overview', icon: 'grid' }, { view: 'profiles', label: 'User accounts', icon: 'people' },
      { view: 'students', label: 'Students', icon: 'school' }, { view: 'faculty', label: 'Faculty', icon: 'person-circle' }] },
    { label: 'Academics', links: [{ view: 'departments', label: 'Departments', icon: 'business' },
      { view: 'programs', label: 'Programs', icon: 'layers' }, { view: 'subjects', label: 'Subjects', icon: 'book' },
      { view: 'sections', label: 'Sections', icon: 'list' }, { view: 'academic_years', label: 'Academic years', icon: 'calendar' },
      { view: 'semesters', label: 'Semesters', icon: 'calendar' }, { view: 'class_assignments', label: 'Class assignments', icon: 'clipboard' },
      { view: 'class_schedules', label: 'Class schedules', icon: 'time' }, { view: 'enrollments', label: 'Enrollments', icon: 'people' },
      { view: 'grades', label: 'Grades', icon: 'school' }, { view: 'grading_scales', label: 'Grade scale', icon: 'options' },
      { view: 'attendance', label: 'Attendance', icon: 'checkbox' }] },
    { label: 'Campus', links: [{ view: 'announcements', label: 'Announcements', icon: 'megaphone' },
      { view: 'calendar_events', label: 'Calendar events', icon: 'calendar' }, { view: 'audit_logs', label: 'Audit log', icon: 'document-text' }] },
  ],
};
