import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { PortalService } from '../core/portal.service';
import { PageState } from '../shared/page-state';
import { defaultSemester, sortSchedule, termName, upcomingEvents, weightedAverage } from '../shared/academics';
import { AnnouncementsComponent } from '../shared/announcements.component';
import { CalendarComponent } from '../shared/calendar.component';
import { ScheduleComponent } from '../shared/schedule.component';

@Component({
  imports: [FormsModule, DatePipe, DecimalPipe, NgTemplateOutlet, RouterLink, AnnouncementsComponent, CalendarComponent, ScheduleComponent],
  templateUrl: './student.page.html',
})
export class StudentPage {
  readonly auth = inject(AuthService);
  readonly state = new PageState();
  private readonly api = inject(PortalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly view = signal('overview');
  readonly termId = signal('');
  readonly data = signal<Awaited<ReturnType<StudentPage['fetch']>> | null>(null);
  readonly announcements = signal<Awaited<ReturnType<typeof this.api.list<'announcements'>>>>([]);
  readonly notifications = signal<Awaited<ReturnType<typeof this.api.list<'notifications'>>>>([]);

  readonly unread = computed(() => this.notifications().filter(item => !item.read_at).length);
  readonly profile = computed(() => this.auth.profile());
  readonly schoolProfile = computed(() => this.data()?.students.find(student => student.id === this.profile()?.id));
  readonly program = computed(() => this.data()?.programs.find(program => program.id === this.schoolProfile()?.program_id));
  readonly terms = computed(() => [...(this.data()?.semesters ?? [])].sort((a, b) => b.start_on.localeCompare(a.start_on)));
  readonly selectedTerm = computed(() => this.terms().find(term => term.id === this.termId()));
  readonly termLabel = computed(() => termName(this.selectedTerm(), this.data()?.years ?? []));
  readonly records = computed(() => {
    const data = this.data();
    if (!data) return [];
    return data.enrollments.filter(e => !this.termId() || e.semester_id === this.termId()).map(enrollment => {
      const assignment = data.classes.find(entry => entry.id === enrollment.class_id);
      const grade = data.grades.find(entry => entry.enrollment_id === enrollment.id);
      return {
        enrollment, assignment, grade,
        subject: data.subjects.find(entry => entry.id === enrollment.subject_id),
        section: data.sections.find(entry => entry.id === assignment?.section_id),
        instructor: data.directory.find(entry => entry.id === assignment?.faculty_id)?.full_name,
        scale: data.scale.find(entry => entry.id === grade?.scale_id),
        term: termName(data.semesters.find(entry => entry.id === enrollment.semester_id), data.years),
      };
    }).sort((a, b) => (a.subject?.code ?? '').localeCompare(b.subject?.code ?? ''));
  });
  readonly activeRecords = computed(() => this.records().filter(row => row.enrollment.status !== 'withdrawn'));
  readonly gradeRows = computed(() => this.records().filter(row => row.grade));
  readonly gwa = computed(() => weightedAverage(this.gradeRows().map(row => ({ scale: row.scale, units: row.subject?.units ?? 0 }))));
  readonly units = computed(() => this.activeRecords().reduce((sum, row) => sum + (row.subject?.units ?? 0), 0));
  readonly attendance = computed(() => (this.data()?.attendance ?? []).flatMap(entry => {
    const row = this.records().find(item => item.enrollment.id === entry.enrollment_id);
    return row ? [{ entry, subject: row.subject?.code ?? 'Subject' }] : [];
  }).sort((a, b) => b.entry.attended_on.localeCompare(a.entry.attended_on)));
  readonly schedules = computed(() => sortSchedule(this.data()?.schedules ?? []).flatMap(schedule => {
    const record = this.activeRecords().find(row => row.enrollment.class_id === schedule.class_id);
    return record ? [{
      id: schedule.id, weekday: schedule.weekday, starts: schedule.starts_at.slice(0, 5), ends: schedule.ends_at.slice(0, 5),
      room: schedule.room, classLabel: (record.subject?.code ?? '') + ' · ' + (record.section?.name ?? ''),
    }] : [];
  }));
  readonly events = computed(() => upcomingEvents(this.data()?.events ?? []));

  constructor() {
    const valid = ['overview', 'profile', 'notifications', 'subjects', 'schedule', 'grades', 'attendance', 'calendar', 'announcements'];
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const view = params.get('view') ?? '';
      if (!valid.includes(view)) { void this.router.navigate(['/portal/student/overview'], { replaceUrl: true }); return; }
      if (view !== this.view()) this.state.error.set('');
      this.view.set(view);
    });
    void this.reload();
    const channel = this.api.client.channel('student-campus-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => this.refreshAnnouncements())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + this.profile()?.id,
      }, () => this.refreshNotifications())
      .subscribe();
    inject(DestroyRef).onDestroy(() => { void this.api.client.removeChannel(channel); });
  }

  private async fetch() {
    const [
      students, programs, years, semesters, subjects, sections, classes, enrollments, schedules,
      grades, scale, attendance, announcements, events, notifications, directory,
    ] = await Promise.all([
      this.api.list('students'), this.api.list('programs'), this.api.list('academic_years'), this.api.list('semesters'),
      this.api.list('subjects'), this.api.list('sections'), this.api.list('class_assignments'), this.api.list('enrollments'),
      this.api.list('class_schedules'), this.api.list('grades'), this.api.list('grading_scales'), this.api.list('attendance'),
      this.api.list('announcements'), this.api.list('calendar_events'), this.api.list('notifications'), this.api.directory(),
    ]);
    return { students, programs, years, semesters, subjects, sections, classes, enrollments, schedules,
      grades, scale, attendance, announcements, events, notifications, directory };
  }

  reload(): Promise<void> {
    return this.state.load(() => this.fetch(), data => {
      if (!this.data()) this.termId.set(defaultSemester(data.semesters, data.enrollments.map(e => e.semester_id)));
      this.data.set(data);
      this.announcements.set(data.announcements);
      this.setNotifications(data.notifications);
    });
  }

  private refreshAnnouncements(): void {
    void this.api.list('announcements').then(rows => this.announcements.set(rows)).catch(() => undefined);
  }

  private setNotifications(rows: Awaited<ReturnType<typeof this.api.list<'notifications'>>>): void {
    this.notifications.set(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }

  private refreshNotifications(): void {
    void this.api.list('notifications').then(rows => this.setNotifications(rows)).catch(() => undefined);
  }

  markRead(id: string): void {
    void this.state.write(async () => {
      await this.api.change('notifications', { read_at: new Date().toISOString() }, id);
      this.setNotifications(await this.api.list('notifications'));
    }, 'Notification marked as read');
  }

  print(): void {
    window.print();
  }

  termText(term: (typeof this.terms extends () => (infer T)[] ? T : never)): string {
    return termName(term, this.data()?.years ?? []);
  }
}
