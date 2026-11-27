import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { AttendanceStatus, Database, GradeStatus, Records, Role, Table } from './database';

type Value = string | number | boolean | null;
export type Changes = Record<string, Value>;

@Injectable({ providedIn: 'root' })
export class PortalService {
  readonly client = inject(AuthService).client;

  async list<K extends Table>(table: K): Promise<Records[K][]> {
    const rows: Records[K][] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await this.client.from(table)
        .select('*').order('id').range(offset, offset + size - 1).overrideTypes<Records[K][], { merge: false }>();
      if (error) throw error;
      rows.push(...data);
      if (data.length < size) return rows;
    }
  }

  async directory() {
    const rows: { id: string; full_name: string | null }[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.client.rpc('portal_directory').order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }

  async change(table: Table, values: Changes, id?: string): Promise<void> {
    const base = this.client.from(table);
    type TableSpec = Database['public']['Tables'][Table];
    const request = id ? base.update(values as TableSpec['Update']).eq('id', id) : base.insert<TableSpec['Insert']>(values as TableSpec['Insert']);
    const { error } = await request.select('id').single();
    if (error) throw error;
  }

  async remove(table: Table, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq('id', id).select('id').single();
    if (error) throw error;
  }

  async encodeGrade(enrollmentId: string, scaleId: string): Promise<void> {
    const { error } = await this.client.from('grades').upsert(
      { enrollment_id: enrollmentId, scale_id: scaleId, status: 'draft', published_at: null },
      { onConflict: 'enrollment_id' },
    ).select('id').single();
    if (error) throw error;
  }

  async gradeStatus(id: string, previous: GradeStatus, status: GradeStatus): Promise<void> {
    const { error } = await this.client.from('grades').update({ status })
      .eq('id', id).eq('status', previous).select('id').single();
    if (error) throw error;
  }

  async recordAttendance(enrollmentId: string, attendedOn: string, status: AttendanceStatus): Promise<void> {
    const { error } = await this.client.from('attendance').upsert(
      { enrollment_id: enrollmentId, attended_on: attendedOn, status },
      { onConflict: 'enrollment_id,attended_on' },
    ).select('id').single();
    if (error) throw error;
  }

  async provision(values: { email: string; full_name: string; role: Role; password: string }): Promise<void> {
    const { error } = await this.client.functions.invoke('portal-accounts', { body: values });
    if (error) {
      if ('context' in error && error.context instanceof Response) {
        const body = await error.context.json().catch(() => null);
        if (typeof body?.error === 'string') throw new Error(body.error);
      }
      throw error;
    }
  }
}
