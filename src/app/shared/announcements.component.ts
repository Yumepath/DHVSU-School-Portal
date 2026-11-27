import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Announcement } from '../core/database';

@Component({
  selector: 'app-announcements',
  imports: [DatePipe],
  template: `
    <div class="announcement-list">
      @for (entry of visible(); track entry.id) {
        <article>
          <div class="announcement-date">
            <time [attr.datetime]="entry.published_at">{{ entry.published_at | date:'MMM d, y':'+0800' }}</time>
          </div>
          <div><h3>{{ entry.title }}</h3><p class="wrapped">{{ entry.body }}</p></div>
        </article>
      } @empty { <p class="empty">There are no published announcements yet.</p> }
    </div>
  `,
})
export class AnnouncementsComponent {
  readonly entries = input.required<Announcement[]>();
  readonly limit = input<number>();
  readonly visible = computed(() => {
    const sorted = [...this.entries()].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
    return this.limit() === undefined ? sorted : sorted.slice(0, this.limit());
  });
}
