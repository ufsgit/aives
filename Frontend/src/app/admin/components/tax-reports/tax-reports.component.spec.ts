import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxReportsComponent } from './tax-reports.component';

describe('TaxReportsComponent', () => {
  let component: TaxReportsComponent;
  let fixture: ComponentFixture<TaxReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaxReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
