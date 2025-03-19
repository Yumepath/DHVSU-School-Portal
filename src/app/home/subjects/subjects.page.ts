import { Component } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms'; // ✅ Import FormsModule


@Component({
  selector: 'app-subjects',
  templateUrl: './subjects.page.html',
  styleUrls: ['./subjects.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class SubjectsPage {
  selectedSemester = '2024-2025 2nd Semester';

  subjects = [
    { 
      name: 'MOBDEV 223', description: 'Mobile Application Development', 
      section: 'BSIT 2A DMC', teacher: 'DEL ROSARIO, NHICA Q', credit: 3, 
      status: 'Regular Load', icon: 'calculator-outline' 
    },
    { 
      name: 'SAD 223', description: 'Systems Analysis and Design', 
      section: 'BSIT 2B DMC', teacher: 'MANALO, DYAN LAURICE L', credit: 3, 
      status: 'Regular Load', icon: 'flask-outline' 
    },
    { 
      name: 'ITMATH 223', description: 'Probability and Statistics', 
      section: 'BSIT 2B DMC', teacher: 'TORRES, RUSSELL JOHN M', credit: 3, 
      status: 'Regular Load', icon: 'book-outline' 
    }
  ];

  selectedSubject: any = null;
  isModalOpen = false;

  constructor(private modalController: ModalController) {}

  viewSubject(subject: any) {
    this.selectedSubject = subject;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  changeSemester(event: any) {
    console.log('Semester changed to:', event.detail.value);
    this.selectedSemester = event.detail.value;
  }

  // 🔥 Download Certificate Function
  downloadCertificate() {
    const link = document.createElement('a');
    link.href = 'assets/Certificate_of_Registration.pdf'; // Update with actual file path
    link.download = 'Certificate_of_Registration.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 🔥 Download Actual Load Function
  downloadActualLoad() {
    const link = document.createElement('a');
    link.href = 'assets/Actual_Load.pdf'; // Update with actual file path
    link.download = 'Actual_Load.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
