import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BatchMailReportComponent } from './batch-mail-report.component';

describe('BatchMailReportComponent', () => {
  let component: BatchMailReportComponent;
  let fixture: ComponentFixture<BatchMailReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BatchMailReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BatchMailReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
