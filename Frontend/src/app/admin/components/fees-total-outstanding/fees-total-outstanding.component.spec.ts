import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeesTotalOutstandingComponent } from './fees-total-outstanding.component';

describe('FeesTotalOutstandingComponent', () => {
  let component: FeesTotalOutstandingComponent;
  let fixture: ComponentFixture<FeesTotalOutstandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeesTotalOutstandingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeesTotalOutstandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
