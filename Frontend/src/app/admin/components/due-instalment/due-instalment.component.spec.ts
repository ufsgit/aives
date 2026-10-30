import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DueInstalmentComponent } from './due-instalment.component';

describe('DueInstalmentComponent', () => {
  let component: DueInstalmentComponent;
  let fixture: ComponentFixture<DueInstalmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DueInstalmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DueInstalmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
