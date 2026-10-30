import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentAppinfoComponent } from './student-appinfo.component';

describe('StudentAppinfoComponent', () => {
  let component: StudentAppinfoComponent;
  let fixture: ComponentFixture<StudentAppinfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentAppinfoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentAppinfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
