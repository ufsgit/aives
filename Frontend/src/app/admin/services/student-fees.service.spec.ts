import { TestBed } from '@angular/core/testing';

import { StudentFeesService } from './student-fees.service';

describe('StudentFeesService', () => {
  let service: StudentFeesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StudentFeesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
