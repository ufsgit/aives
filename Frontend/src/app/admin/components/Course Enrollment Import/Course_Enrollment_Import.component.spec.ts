import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Course_Enrollment_ImportComponent } from './Course_Enrollment_Import.component';

describe('Course_Enrollment_ImportComponent', () => {
  let component: Course_Enrollment_ImportComponent;
  let fixture: ComponentFixture<Course_Enrollment_ImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Course_Enrollment_ImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Course_Enrollment_ImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
