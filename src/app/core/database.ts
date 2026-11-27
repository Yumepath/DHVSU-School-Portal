export type Role = 'student' | 'faculty' | 'admin';
export type EnrollmentStatus = 'enrolled' | 'completed' | 'withdrawn';
export type GradeStatus = 'draft' | 'submitted' | 'published';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

type RecordBase = { id: string; created_at: string };
export type Profile = RecordBase & { full_name: string; email: string; role: Role; active: boolean };
export type Department = RecordBase & { code: string; name: string };
export type Program = Department & { department_id: string };
export type Student = RecordBase & { student_number: string | null; program_id: string | null };
export type Faculty = RecordBase & { employee_number: string | null; department_id: string | null };
export type Year = RecordBase & { label: string; start_on: string; end_on: string };
export type Semester = RecordBase & { year_id: string; name: string; start_on: string; end_on: string };
export type Subject = Program & { units: number };
export type Section = RecordBase & { name: string; program_id: string };
export type ClassAssignment = RecordBase & { semester_id: string; subject_id: string; section_id: string; faculty_id: string };
export type Enrollment = RecordBase & {
  student_id: string; class_id: string; semester_id: string; subject_id: string; status: EnrollmentStatus;
};
export type Schedule = RecordBase & {
  class_id: string; semester_id: string; faculty_id: string; section_id: string; weekday: number;
  starts_at: string; ends_at: string; room: string; room_key: string; slot: string;
};
export type GradeScale = RecordBase & { label: string; grade: number; passing: boolean };
export type Grade = RecordBase & { enrollment_id: string; scale_id: string; status: GradeStatus; published_at: string | null };
export type Attendance = RecordBase & { enrollment_id: string; attended_on: string; status: AttendanceStatus };
export type Announcement = RecordBase & { title: string; body: string; audience: Role | null; published_at: string | null };
export type CalendarEvent = RecordBase & { title: string; description: string; starts_on: string; ends_on: string; audience: Role | null };
export type Notification = RecordBase & { user_id: string; title: string; body: string; read_at: string | null };
export type Audit = RecordBase & { actor_id: string | null; entity: string; entity_id: string; action: string };
export type DirectoryEntry = { id: string; full_name: string | null };

export interface Records {
  profiles: Profile; departments: Department; programs: Program; students: Student; faculty: Faculty;
  academic_years: Year; semesters: Semester; subjects: Subject; sections: Section;
  class_assignments: ClassAssignment; enrollments: Enrollment; class_schedules: Schedule;
  grading_scales: GradeScale; grades: Grade; attendance: Attendance; announcements: Announcement;
  calendar_events: CalendarEvent; notifications: Notification; audit_logs: Audit;
}

export type Table = keyof Records;
type Insert<Row> = Partial<Pick<Row, Extract<keyof Row, keyof RecordBase>>> & Omit<Row, keyof RecordBase>;
export interface Database {
  public: {
    Tables: { [K in Table]: { Row: Records[K]; Insert: Insert<Records[K]>; Update: Partial<Records[K]>; Relationships: [] } };
    Views: Record<never, never>;
    Functions: { portal_directory: { Args: never; Returns: DirectoryEntry[] } };
    Enums: { portal_role: Role; enrollment_status: EnrollmentStatus; grade_status: GradeStatus; attendance_status: AttendanceStatus };
    CompositeTypes: Record<never, never>;
  };
}

export const ROLE_LABEL: Record<Role, string> = { student: 'Student', faculty: 'Faculty', admin: 'Administrator' };
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
