import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentLeadComponent } from './student-lead.component';

describe('StudentLeadComponent', () => {
  let component: StudentLeadComponent;
  let fixture: ComponentFixture<StudentLeadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentLeadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentLeadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
