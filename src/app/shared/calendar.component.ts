import { Component, computed, input } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { CalendarEvent } from '../core/database';

@Component({
  selector: 'app-calendar',
  imports: [FullCalendarModule],
  template: '<full-calendar [options]="options()" />',
})
export class CalendarComponent {
  readonly events = input.required<CalendarEvent[]>();
  readonly options = computed<CalendarOptions>(() => ({
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin],
    firstDay: 1,
    headerToolbar: { left: 'title', center: '', right: 'prev,next today' },
    height: 'auto',
    dayMaxEvents: true,
    events: this.events().map(event => {
      const end = new Date(event.ends_on + 'T00:00:00Z');
      end.setUTCDate(end.getUTCDate() + 1);
      return { title: event.title, start: event.starts_on, end: end.toISOString().slice(0, 10), allDay: true };
    }),
  }));
}
