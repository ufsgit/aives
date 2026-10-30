import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrationreportComponent } from './registrationreport.component';

describe('RegistrationreportComponent', () => {
  let component: RegistrationreportComponent;
  let fixture: ComponentFixture<RegistrationreportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationreportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrationreportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
