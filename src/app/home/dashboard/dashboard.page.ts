import { Component } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  imports: [IonicModule, CommonModule, FullCalendarModule],
})
export class DashboardPage {
  isSidebarOpen = true;
  studentDropdownOpen = false;

  // Calendar 
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin],
    events: [
      { title: 'Math Exam', date: '2025-03-10' },
      { title: 'Title Defense 3A', date: '2025-03-20' },
      { title: 'Title Defense 3B', date: '2025-03-19' }
    ],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    height: 'auto',
  };

  constructor(private navCtrl: NavController) {}

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleStudentDropdown() {
    this.studentDropdownOpen = !this.studentDropdownOpen;
  }

  // Logout function
  logout() {
    console.log('User logged out');
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    this.navCtrl.navigateRoot('/home');
  }

  goToSubjects() {
    this.navCtrl.navigateForward('/subjects');
  }

  goToGrades() {
    this.navCtrl.navigateForward('/grades');
  }
}
