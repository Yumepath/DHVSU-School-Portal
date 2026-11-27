import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { PortalService } from '../core/portal.service';
import { AttendanceStatus } from '../core/database';
import { PageState } from '../shared/page-state';
import { AnnouncementsComponent } from '../shared/announcements.component';
import { CalendarComponent } from '../shared/calendar.component';
import { ScheduleComponent } from '../shared/schedule.component';
import { dateInTerm, sortSchedule, termName } from '../shared/academics';

@Component({
  imports: [FormsModule, RouterLink, DecimalPipe, AnnouncementsComponent, CalendarComponent, ScheduleComponent],
  templateUrl: './faculty.page.html',
})
export class FacultyPage {
  readonly auth = inject(AuthService);
  readonly state = new PageState();
  private readonly api = inject(PortalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly view = signal('overview');
  readonly classId = signal('');
  readonly attendanceDate = signal('');
  readonly gradePicks = signal<Partial<Record<string, string>>>({});
  readonly attendancePicks = signal<Partial<Record<string, AttendanceStatus>>>({});
  readonly statuses: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
  readonly data = signal<Awaited<ReturnType<FacultyPage['fetch']>> | null>(null);
  readonly announcements = signal<Awaited<ReturnType<typeof this.api.list<'announcements'>>>>([]);
  readonly classes = computed(() => {
    const data = this.data();
    return (data?.classes ?? []).map(assignment => {
      const subject = data?.subjects.find(entry => entry.id === assignment.subject_id);
      const section = data?.sections.find(entry => entry.id === assignment.section_id);
      const term = data?.semesters.find(entry => entry.id === assignment.semester_id);
      return { assignment, subject, section, term, termLabel: termName(term, data?.years ?? []),
        label: (subject?.code ?? 'Class') + ' · ' + (section?.name ?? 'Section') };
    }).sort((a, b) => (b.term?.start_on ?? '').localeCompare(a.term?.start_on ?? '') || a.label.localeCompare(b.label));
  });
  readonly selected = computed(() => this.classes().find(entry => entry.assignment.id === this.classId()));
  readonly scale = computed(() => [...(this.data()?.scale ?? [])].sort((a, b) => a.grade - b.grade));
  readonly roster = computed(() => {
    const data = this.data();
    return (data?.enrollments ?? []).filter(e => e.class_id === this.classId()).map(enrollment => {
      const grade = data?.grades.find(entry => entry.enrollment_id === enrollment.id);
      const student = data?.students.find(entry => entry.id === enrollment.student_id);
      const name = data?.directory.find(entry => entry.id === enrollment.student_id)?.full_name ?? 'Student';
      const attendance = data?.attendance.find(entry => entry.enrollment_id === enrollment.id && entry.attended_on === this.attendanceDate());
      const scale = this.scale().find(entry => entry.id === grade?.scale_id);
      return { enrollment, grade, student, name, attendance, scale };
    }).sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly results = computed(() => {
    const published = this.roster().filter(row => row.grade?.status === 'published' && row.scale);
    return {
      published: published.length,
      passing: published.filter(row => row.scale?.passing).length,
      mean: published.length ? published.reduce((sum, row) => sum + (row.scale?.grade ?? 0), 0) / published.length : null,
    };
  });
  readonly schedules = computed(() => sortSchedule(this.data()?.schedules ?? [])
    .filter(row => !this.classId() || this.view() === 'schedule' || row.class_id === this.classId())
    .map(row => ({
      id: row.id, weekday: row.weekday, starts: row.starts_at.slice(0, 5), ends: row.ends_at.slice(0, 5),
      room: row.room, classLabel: this.classes().find(entry => entry.assignment.id === row.class_id)?.label ?? 'Class',
    })));
  readonly studentCount = computed(() => new Set(this.data()?.enrollments.map(row => row.student_id)).size);
  readonly awaitingReview = computed(() => this.data()?.grades.filter(row => row.status === 'submitted').length ?? 0);

  constructor() {
    const views = ['overview', 'classes', 'schedule', 'grades', 'attendance', 'announcements', 'calendar'];
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const view = params.get('view') ?? '';
      if (!views.includes(view)) { void this.router.navigate(['/portal/faculty/overview'], { replaceUrl: true }); return; }
      this.state.error.set('');
      this.view.set(view);
    });
    void this.reload();
    const channel = this.api.client.channel('faculty-campus-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        void this.api.list('announcements').then(rows => this.announcements.set(rows)).catch(() => undefined);
      }).subscribe();
    inject(DestroyRef).onDestroy(() => { void this.api.client.removeChannel(channel); });
  }

  private async fetch() {
    const [classes, subjects, sections, semesters, years, enrollments, students, grades, scale, attendance,
      schedules, announcements, events, directory] = await Promise.all([
      this.api.list('class_assignments'), this.api.list('subjects'), this.api.list('sections'),
      this.api.list('semesters'), this.api.list('academic_years'), this.api.list('enrollments'),
      this.api.list('students'), this.api.list('grades'), this.api.list('grading_scales'), this.api.list('attendance'),
      this.api.list('class_schedules'), this.api.list('announcements'), this.api.list('calendar_events'), this.api.directory(),
    ]);
    return { classes, subjects, sections, semesters, years, enrollments, students, grades, scale, attendance,
      schedules, announcements, events, directory };
  }

  reload(showLoading = true): Promise<void> {
    return this.state.load(() => this.fetch(), data => {
      this.data.set(data);
      this.announcements.set(data.announcements);
      if (!this.selected()) this.selectClass(this.classes()[0]?.assignment.id ?? '');
    }, showLoading);
  }

  selectClass(classId: string): void {
    this.classId.set(classId);
    this.gradePicks.set({});
    this.setDate(dateInTerm(this.selected()?.term));
  }

  setDate(date: string): void {
    this.attendanceDate.set(date);
    this.attendancePicks.set({});
  }

  pickGrade(id: string, scale: string): void {
    this.gradePicks.update(picks => ({ ...picks, [id]: scale }));
  }

  pickAttendance(id: string, status: AttendanceStatus): void {
    this.attendancePicks.update(picks => ({ ...picks, [id]: status }));
  }

  saveGrade(id: string, scaleId: string): void {
    void this.state.write(async () => {
      await this.api.encodeGrade(id, scaleId);
      await this.reload(false);
    }, 'Draft grade saved');
  }

  submitGrade(id: string): void {
    void this.state.write(async () => {
      await this.api.gradeStatus(id, 'draft', 'submitted');
      await this.reload(false);
    }, 'Grade submitted for publication');
  }

  saveAttendance(id: string, status: AttendanceStatus): void {
    void this.state.write(async () => {
      await this.api.recordAttendance(id, this.attendanceDate(), status);
      await this.reload(false);
    }, 'Attendance saved');
  }
}
