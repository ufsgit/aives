import { ComponentFixture, TestBed } from '@angular/core/testing';

import { payment_installment_file_importComponent } from './payment_installment_file_import.component';

describe('payment_installment_file_importComponent', () => {
  let component: payment_installment_file_importComponent;
  let fixture: ComponentFixture<payment_installment_file_importComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [payment_installment_file_importComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(payment_installment_file_importComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
