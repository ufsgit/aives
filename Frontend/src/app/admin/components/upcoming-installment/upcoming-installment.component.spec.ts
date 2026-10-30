import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpcomingInstallmentComponent } from './upcoming-installment.component';

describe('UpcomingInstallmentComponent', () => {
  let component: UpcomingInstallmentComponent;
  let fixture: ComponentFixture<UpcomingInstallmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcomingInstallmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpcomingInstallmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
