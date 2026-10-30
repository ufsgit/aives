import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseCategoryComponent } from './expense-category.component';

describe('ExpenseCategoryComponent', () => {
  let component: ExpenseCategoryComponent;
  let fixture: ComponentFixture<ExpenseCategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseCategoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpenseCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
