import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { Changes, PortalService } from '../core/portal.service';
import { GradeStatus, ROLE_LABEL, Role, Table, WEEKDAYS } from '../core/database';
import { PageState } from '../shared/page-state';
import { downloadCsv } from '../shared/csv';
import { NAVIGATION } from '../shell/navigation';
import { Field, RESOURCES, ResourceKey, resource } from './resources';

type Cell = string | number | boolean | null;
type Row = Changes & { id: string };
type DialogType = 'record' | 'delete' | 'account';

const related: Partial<Record<Table, Table[]>> = {
  faculty: ['profiles'], students: ['profiles'],
  class_assignments: ['subjects', 'sections', 'semesters'],
  enrollments: ['class_assignments', 'students'], semesters: ['academic_years'],
};
const emptyAccount = { full_name: '', email: '', role: 'student' as Role, password: '' };
const yearTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const numericSort = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.page.html',
})
export class AdminPage {
  readonly auth = inject(AuthService);
  readonly state = new PageState();
  private readonly api = inject(PortalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly view = signal<ResourceKey | 'overview'>('overview');
  readonly title = computed(() => NAVIGATION.admin.flatMap(group => group.links).find(link => link.view === this.view())?.label ?? 'Overview');
  readonly config = computed(() => this.view() === 'overview' ? null : resource(this.view() as ResourceKey));
  readonly columns = computed(() => {
    const config = this.config();
    if (!config) return [];
    const extra = config.extra ?? [];
    return ['students', 'faculty'].includes(this.view()) ? [...extra, ...config.fields] : [...config.fields, ...extra];
  });
  readonly data = signal<Partial<Record<Table, Row[]>>>({});
  readonly rows = computed(() => this.view() === 'overview' ? [] : this.data()[this.view() as ResourceKey] ?? []);
  readonly query = signal('');
  readonly statusFilter = signal('');
  readonly sort = signal<{ key: string; ascending: boolean } | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly mode = signal<DialogType>('record');
  readonly editing = signal<Row | null>(null);
  readonly modal = viewChild.required<ElementRef<HTMLDialogElement>>('editor');
  readonly roleLabel = ROLE_LABEL;
  model: Changes = {};
  account = { ...emptyAccount };

  readonly fields = computed(() => this.config()?.fields.filter(field =>
    field.editable !== (this.editing() ? 'create' : 'update')) ?? []);
  readonly statusColumn = computed(() => this.columns().find(col => ['status', 'active', 'audience', 'role'].includes(col.key)));
  readonly filterOptions = computed(() => {
    const col = this.statusColumn();
    if (!col) return [];
    return [...new Set(this.rows().map(row => this.cell(row, col)))].sort(numericSort.compare);
  });
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    const columns = this.columns();
    const status = this.statusColumn();
    const output = this.rows().filter(row =>
      (!this.statusFilter() || !status || this.cell(row, status) === this.statusFilter()) &&
      (!query || columns.some(column => this.cell(row, column).toLowerCase().includes(query))));
    const sort = this.sort();
    const col = columns.find(column => column.key === sort?.key);
    return !col ? output : [...output].sort((a, b) =>
      numericSort.compare(this.cell(a, col), this.cell(b, col)) * (sort?.ascending ? 1 : -1));
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  readonly pageRows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize(), this.page() * this.pageSize()));
  readonly summary = computed(() => {
    const data = this.data();
    const accounts = data.profiles ?? [];
    return {
      students: accounts.filter(row => row['role'] === 'student' && row['active']).length,
      faculty: accounts.filter(row => row['role'] === 'faculty' && row['active']).length,
      classes: data.class_assignments?.length ?? 0,
      enrolled: data.enrollments?.filter(row => row['status'] === 'enrolled').length ?? 0,
      grades: ['draft', 'submitted', 'published'].map(status => ({
        status, count: data.grades?.filter(row => row['status'] === status).length ?? 0,
      })),
      activity: [...(data.audit_logs ?? [])].sort((a, b) => String(b['created_at']).localeCompare(String(a['created_at']))).slice(0, 6),
    };
  });
  readonly gradeTotal = computed(() => this.summary().grades.reduce((sum, item) => sum + item.count, 0));

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const view = params.get('view') ?? '';
      if (view !== 'overview' && !Object.hasOwn(RESOURCES, view)) {
        void this.router.navigate(['/portal/admin/overview'], { replaceUrl: true });
        return;
      }
      this.view.set(view as ResourceKey | 'overview');
      this.query.set('');
      this.statusFilter.set('');
      this.sort.set(view === 'audit_logs' ? { key: 'created_at', ascending: false } : null);
      this.page.set(1);
      void this.reload();
    });
  }

  reload(showLoading = true): Promise<void> {
    const current = this.view();
    return this.state.load(async () => {
      if (current === 'overview') {
        const tables: Table[] = ['profiles', 'class_assignments', 'enrollments', 'grades', 'audit_logs'];
        return this.fetchTables(tables);
      }
      const required = new Set<Table>();
      const add = (table: Table): void => {
        if (required.has(table)) return;
        required.add(table);
        for (const resource of related[table] ?? []) add(resource);
      };
      add(current);
      for (const field of this.columns()) if (field.lookup) add(field.lookup);
      return this.fetchTables([...required]);
    }, result => {
      this.data.set(result);
      this.page.set(Math.min(this.page(), this.pageCount()));
    }, showLoading);
  }

  private async fetchTables(tables: Table[]): Promise<Partial<Record<Table, Row[]>>> {
    const entries = await Promise.all(tables.map(async table => [table, await this.api.list(table)] as const));
    return Object.fromEntries(entries);
  }

  private label(table: Table, row: Row): string {
    const name = (key: string) => String(row[key] ?? '');
    const rel = (target: Table, key: string) => this.reference(target, name(key));
    switch (table) {
      case 'profiles': return name('full_name') || row.id;
      case 'faculty':
      case 'students': return this.reference('profiles', row.id) + (name(table === 'students' ? 'student_number' : 'employee_number')
        ? ' · ' + name(table === 'students' ? 'student_number' : 'employee_number') : '');
      case 'enrollments': return rel('students', 'student_id') + ' / ' + rel('class_assignments', 'class_id');
      case 'class_assignments': return [rel('subjects', 'subject_id'), rel('sections', 'section_id'), rel('semesters', 'semester_id')].join(' · ');
      case 'semesters': return rel('academic_years', 'year_id') + ' · ' + name('name');
      case 'sections': return name('name');
      case 'academic_years':
      case 'grading_scales': return name('label');
      default: return [name('code'), name('name')].filter(Boolean).join(' · ') || row.id;
    }
  }

  reference(table: Table, id: string): string {
    const row = this.data()[table]?.find(row => row.id === id);
    return row ? this.label(table, row) : id || '—';
  }

  choices(field: Field): { id: string; title: string }[] {
    if (field.lookup) {
      const table = field.lookup;
      return (this.data()[table] ?? []).map(row => ({ id: row.id, title: this.label(table, row) }))
        .sort((a, b) => numericSort.compare(a.title, b.title));
    }
    return (field.choices ?? []).map(id => ({ id, title: this.display(field, id) }));
  }

  private display(field: Field, value: Cell): string {
    if (typeof value === 'boolean') return field.key === 'active' ? (value ? 'Active' : 'Inactive') : (value ? 'Yes' : 'No');
    if ((value === '' || value == null) && field.key === 'audience') return 'Everyone';
    if ((value === '' || value == null) && field.key === 'published_at') return 'Draft';
    if (value === '' || value == null) return '—';
    if (field.lookup) return this.reference(field.lookup, String(value));
    if (field.type === 'datetime-local') return yearTime.format(new Date(String(value)));
    if (field.type === 'time') return String(value).slice(0, 5);
    if (field.key === 'weekday') return WEEKDAYS[Number(value) - 1];
    if (field.key === 'audience' || field.key === 'role') return ROLE_LABEL[value as Role];
    return String(value);
  }

  cell(row: Row, column: Field): string { return this.display(column, row[column.key]); }

  setSort(key: string): void {
    this.sort.set({ key, ascending: this.sort()?.key !== key || !this.sort()?.ascending });
    this.page.set(1);
  }

  exportCsv(): void {
    const columns = this.columns();
    downloadCsv('dhvsu-' + this.view() + '.csv', [
      columns.map(column => column.label), ...this.filtered().map(row => columns.map(column => this.cell(row, column))),
    ]);
  }

  open(row: Row | null, mode: DialogType = 'record'): void {
    this.state.error.set('');
    this.editing.set(row);
    this.mode.set(mode);
    this.account = { ...emptyAccount };
    this.model = Object.fromEntries(this.fields().map(field => {
      const original = row?.[field.key];
      if (field.type === 'datetime-local' && original) return [field.key, yearTime.format(new Date(String(original))).replace(' ', 'T')];
      if (field.type === 'time' && original) return [field.key, String(original).slice(0, 5)];
      if (field.type === 'boolean') return [field.key, original ?? false];
      if (field.key === 'status' && !row && this.view() === 'enrollments') return [field.key, 'enrolled'];
      return [field.key, original ?? ''];
    }));
    this.modal().nativeElement.showModal();
  }

  setPublishNow(): void {
    this.model['published_at'] = yearTime.format(new Date()).replace(' ', 'T');
  }

  close(): void { this.modal().nativeElement.close(); }

  save(): void {
    const mode = this.mode();
    const row = this.editing();
    const table = this.view();
    if (table === 'overview') return;
    void this.state.write(async () => {
      if (mode === 'delete' && row) {
        await this.api.remove(table, row.id);
      } else if (mode === 'account') {
        await this.api.provision({ ...this.account, email: this.account.email.trim(), full_name: this.account.full_name.trim() });
      } else {
        const values: Changes = {};
        for (const field of this.fields()) {
          const raw = this.model[field.key];
          let value: Cell = typeof raw === 'string' && field.type !== 'textarea' ? raw.trim() : raw;
          if (field.optional && value === '') value = null;
          if (field.type === 'datetime-local' && value) value = new Date(String(value) + '+08:00').toISOString();
          if (field.key === 'weekday' && value !== '') value = Number(value);
          values[field.key] = value;
        }
        await this.api.change(table, values, row?.id);
      }
      this.account = { ...emptyAccount };
      this.close();
      await this.reload(false);
    }, mode === 'delete' ? 'Record deleted' : mode === 'account' ? 'Account provisioned' : 'Record saved');
  }

  changeGrade(row: Row, status: GradeStatus): void {
    void this.state.write(async () => {
      await this.api.gradeStatus(row.id, row['status'] as GradeStatus, status);
      await this.reload(false);
    }, status === 'published' ? 'Grade published' : status === 'submitted' ? 'Grade submitted' : 'Grade returned to draft');
  }
}
