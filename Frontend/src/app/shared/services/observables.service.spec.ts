import { TestBed } from '@angular/core/testing';

import { ObservablesService } from './observables.service';

describe('ObservablesService', () => {
  let service: ObservablesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ObservablesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
