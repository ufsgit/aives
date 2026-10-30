import { Component, computed, signal, inject } from '@angular/core';
import { course_Service } from '../../services/course.Service';
import { environment } from '../../../../environments/environment';
import { SharedModule } from '../../../shared/shared.module';
interface Review {
  Review_Id: number;
  Student_ID: number;
  Course_ID: number;
  Rating: number | null;
  Comments: string;
  Created_At: string;
  Delete_Status: number;
  Name: string;
  Course_Name: string;
  Profile_Photo_Path: string;
}
@Component({
    selector: 'app-reviews',
    standalone: true,
    imports: [SharedModule],
    templateUrl: './reviews.component.html',
    styleUrl: './reviews.component.scss'
})
export class ReviewsComponent {
  private courseService = inject(course_Service);

  studentId = signal<number>(0);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  
  reviews = signal<Review[]>([]);
  reviewCount = computed(() => this.reviews().length);

  ngOnInit() {
    this.fetchReviews();
  }

  private fetchReviews() {
    this.loading.set(true);
    this.error.set(null);

    this.courseService.Get_Course_Reviews().subscribe({
      next: (res: Review[]) => {
        console.log('res: ', res);
        this.reviews.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load reviews. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,  // Ensures 12-hour format (AM/PM)
      timeZone: 'UTC',  // Force time zone to UTC
    });
  }
  
  
  
  
  generateStarArray(rating: number | null): boolean[] {
    if (rating === null) return [];
    return Array(5).fill(0).map((_, i) => i < rating);
  }
  getFullImagePath(relativePath: string): string {
    if (!relativePath) return 'assets/images/logo2.svg';
    return `${environment.FilePath}${relativePath}`;
  }
}
