import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateExamDialogComponentComponent } from './create-exam-dialog-component.component';

describe('CreateExamDialogComponentComponent', () => {
  let component: CreateExamDialogComponentComponent;
  let fixture: ComponentFixture<CreateExamDialogComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateExamDialogComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateExamDialogComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
