import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamImportComponent } from './exam-import.component';

describe('ExamImportComponent', () => {
  let component: ExamImportComponent;
  let fixture: ComponentFixture<ExamImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
