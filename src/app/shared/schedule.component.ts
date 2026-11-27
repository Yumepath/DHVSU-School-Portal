import { Component, input } from '@angular/core';
import { WEEKDAYS } from '../core/database';

export type ScheduleLine = { id: string; weekday: number; starts: string; ends: string; room: string; classLabel: string };

@Component({
  selector: 'app-schedule',
  template: `
    <div class="table-scroll">
      <table>
        <thead><tr><th>Day</th><th>Time</th><th>Class</th><th>Room</th></tr></thead>
        <tbody>
          @for (entry of entries(); track entry.id) {
            <tr><td>{{ weekdays[entry.weekday - 1] }}</td><td>{{ entry.starts }}–{{ entry.ends }}</td>
              <td>{{ entry.classLabel }}</td><td>{{ entry.room }}</td></tr>
          } @empty { <tr><td class="empty" colspan="4">No class meetings are scheduled for this term.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class ScheduleComponent {
  readonly entries = input.required<ScheduleLine[]>();
  readonly weekdays = WEEKDAYS;
}
