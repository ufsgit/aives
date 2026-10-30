import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogBox_Component } from './DialogBox.component';

describe('DialogBox_Component', () => {
  let component: DialogBox_Component;
  let fixture: ComponentFixture<DialogBox_Component>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [DialogBox_Component]
})
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogBox_Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
