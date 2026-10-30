import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowUpReportsComponent } from './follow-up-reports.component';

describe('FollowUpReportsComponent', () => {
  let component: FollowUpReportsComponent;
  let fixture: ComponentFixture<FollowUpReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FollowUpReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowUpReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
