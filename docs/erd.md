# Database entity relationships

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : authenticates
    PROFILES ||--o| STUDENTS : identifies
    PROFILES ||--o| FACULTY : identifies
    PROFILES ||--o{ NOTIFICATIONS : receives
    PROFILES o|..o{ AUDIT_LOGS : acts
    DEPARTMENTS ||--o{ PROGRAMS : offers
    DEPARTMENTS ||--o{ SUBJECTS : maintains
    DEPARTMENTS o|--o{ FACULTY : employs
    PROGRAMS o|--o{ STUDENTS : admits
    PROGRAMS ||--o{ SECTIONS : organizes
    ACADEMIC_YEARS ||--o{ SEMESTERS : contains
    SEMESTERS ||--o{ CLASS_ASSIGNMENTS : offers
    SUBJECTS ||--o{ CLASS_ASSIGNMENTS : covers
    SECTIONS ||--o{ CLASS_ASSIGNMENTS : attends
    FACULTY ||--o{ CLASS_ASSIGNMENTS : teaches
    CLASS_ASSIGNMENTS ||--o{ CLASS_SCHEDULES : meets
    CLASS_ASSIGNMENTS ||--o{ ENROLLMENTS : registers
    STUDENTS ||--o{ ENROLLMENTS : holds
    ENROLLMENTS ||--o| GRADES : earns
    GRADING_SCALES ||--o{ GRADES : defines
    ENROLLMENTS ||--o{ ATTENDANCE : records
    PROFILES }o..o{ ANNOUNCEMENTS : reads_by_role
    PROFILES }o..o{ CALENDAR_EVENTS : views_by_role
```

- All application tables have a UUID primary key. Student and faculty primary keys also reference a profile. Administrator identity lives in the profile role.
- A class assignment belongs to a semester, subject, section, and instructor. Unique assignment keys bind enrollment rows to their class subject and term and bind schedule rows to the instructor and section used by conflict constraints.
- A grade is unique per enrollment. Attendance is unique per enrollment and date. Grades reference configurable grading options.
- Dotted announcement, calendar, and audit relationships describe access or retained actor identity. Audience is an optional role enum. A nullable audit actor UUID remains readable after an account is removed by an operator.
- The database implements role and row permissions in [the migrations](../supabase/migrations).
