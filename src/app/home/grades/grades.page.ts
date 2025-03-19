import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-grades',
  standalone: true,
  templateUrl: './grades.page.html',
  styleUrls: ['./grades.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule], // ✅ Import FormsModule
})
export class GradesPage {
  selectedSemester: string = '2024-2025 1st Semester';

  grades = [
    { code: 'SOCSCI 313', descriptive: 'Science, Technology, and Society', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.00, remarks: 'Passed' },
    { code: 'NET 313', descriptive: 'Advanced Networking', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.50, remarks: 'Passed' },
    { code: 'CC 313(F)', descriptive: 'Applications Development', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.00, remarks: 'Passed' },
    { code: 'IAS 313', descriptive: 'Informative Assurance', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.00, remarks: 'Passed' },
    { code: 'IPT 313', descriptive: 'Integrated Programming Tech', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.50, remarks: 'Passed' },
    { code: 'ITELEC 3', descriptive: 'Platform Technologies', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.00, remarks: 'Passed' },
    { code: 'ITELEC 2', descriptive: 'Web System Technologies', units: 3, section: 'BSIT 3B DMC', finalAverage: 1.00, remarks: 'Passed' },
  ];

  changeSemester(event: any) {
    console.log('Semester changed:', this.selectedSemester);
  }

  getGradeColor(finalAverage: number): string {
    if (finalAverage <= 1.50) return 'success';
    if (finalAverage <= 2.00) return 'warning';
    return 'danger';
  }
}
