import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { debounceTime, groupBy, mergeMap } from 'rxjs/operators';

@Injectable()
export class DebounceInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Generate a key based on the request URL and method
    const key = request.url + request.method;
    
    return new Observable(subscriber => {
      return next.handle(request).pipe(
        // Group requests by the key
        groupBy(req => key),
        // Apply debounce to each group
        mergeMap(group => group.pipe(
          debounceTime(300) // Adjust time as needed (300ms here)
        ))
      ).subscribe(subscriber);
    });
  }
}